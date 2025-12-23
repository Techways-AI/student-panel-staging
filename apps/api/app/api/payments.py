from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import logging
from pydantic import BaseModel
from typing import Optional, List
from ..db.session import get_db
from ..models.user import User
from ..models.subscription import Subscription
from ..models.offer import Offer
from ..core.config import settings
from ..api.auth import get_current_user
from ..utils.semester_access_utils import get_semester_access_info
import razorpay
import hmac
import hashlib
import json

from ..services.analytics.posthog_client import capture_event, is_enabled

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize Razorpay client
razorpay_client = razorpay.Client(
    auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
)

TWO_DECIMAL_PLACES = Decimal('0.01')


def _quantize_decimal(value: Decimal) -> Decimal:
    return value.quantize(TWO_DECIMAL_PLACES, rounding=ROUND_HALF_UP)


def _parse_amount_to_decimal(value) -> Optional[Decimal]:
    if value is None:
        return None
    try:
        decimal_value = Decimal(str(value))
        return _quantize_decimal(decimal_value)
    except (InvalidOperation, TypeError, ValueError):
        return None


def _decimal_to_float(value: Optional[Decimal]) -> Optional[float]:
    return float(value) if value is not None else None


def _fetch_payment_amount_rupees(payment_id: str) -> Optional[Decimal]:
    if not payment_id:
        return None
    try:
        payment_details = razorpay_client.payment.fetch(payment_id)
        amount_paise = payment_details.get('amount')
        if amount_paise is None:
            return None
        amount_rupees = Decimal(amount_paise) / Decimal(100)
        return _quantize_decimal(amount_rupees)
    except Exception as fetch_error:
        logger.warning("Unable to fetch Razorpay payment amount for %s: %s", payment_id, fetch_error)
        return None


def _allocate_subject_payment_amounts(subject_count: int, total_paid: Optional[Decimal], requested_amounts: List[Optional[Decimal]]) -> List[Optional[Decimal]]:
    if subject_count == 0:
        return []

    allocations: List[Optional[Decimal]] = []
    total_requested = sum((amt for amt in requested_amounts if amt is not None), Decimal('0')) if requested_amounts else Decimal('0')
    remaining = total_paid

    for idx in range(subject_count):
        requested = requested_amounts[idx] if idx < len(requested_amounts) else None

        if total_paid is not None:
            if total_requested > 0 and requested is not None:
                allocation = _quantize_decimal((requested / total_requested) * total_paid)
            else:
                allocation = _quantize_decimal(total_paid / Decimal(subject_count))

            if remaining is not None:
                if idx == subject_count - 1:
                    allocation = remaining
                else:
                    remaining -= allocation
        else:
            allocation = requested

        allocations.append(allocation)

    return allocations

# Request/Response Models
class CreateOrderRequest(BaseModel):
    amount: int  # Amount in rupees
    currency: str = "INR"
    plan_id: str
    plan_name: str
    plan_type: str  # 'semester', 'yearly', or 'subject-based'
    duration_months: int
    subject_code: Optional[str] = None  # For single subject-based plans (backward compatibility)
    subjects: Optional[List[dict]] = None  # For multiple subject-based plans


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    receipt: str


class ApplyCouponRequest(BaseModel):
    code: str
    original_amount: int
    plan_id: str
    plan_name: str
    plan_type: Optional[str] = None


class ApplyCouponResponse(BaseModel):
    code: str
    title: str
    description: Optional[str]
    original_amount: int
    discounted_amount: int
    discount_amount: int
    message: str


@router.post("/apply-coupon", response_model=ApplyCouponResponse)
async def apply_coupon(
    payload: ApplyCouponRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Validate a coupon code against the offers table and calculate discounted amount."""
    now = datetime.utcnow()

    code = (payload.code or "").strip().upper()
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Coupon code is required",
        )

    offer = db.query(Offer).filter(Offer.code == code).first()
    if not offer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid coupon code",
        )

    # Check offer active window
    if offer.start_date and now < offer.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This offer is not active yet",
        )

    if offer.end_date and now > offer.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This offer has expired",
        )

    # Global usage limit
    if (
        offer.usage_limit is not None
        and offer.usage_count is not None
        and offer.usage_count >= offer.usage_limit
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This offer has reached its maximum usage limit",
        )

    # First-time buyers only: user should not have any subscription yet
    if getattr(offer, "first_time_buyers_only", False):
        existing_sub = db.query(Subscription).filter(
            Subscription.user_id == current_user.id
        ).first()
        if existing_sub:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This coupon is only for first-time buyers",
            )

    # Check applicability to this plan
    if offer.applicable_to:
        try:
            applicable = json.loads(offer.applicable_to)
            if isinstance(applicable, str):
                applicable = [applicable]
        except Exception:
            applicable = [
                item.strip()
                for item in offer.applicable_to.split(",")
                if item.strip()
            ]

        tags = {str(item).lower() for item in applicable}
        if "all" not in tags:
            plan_name_raw = (payload.plan_name or "").lower()
            plan_type = (payload.plan_type or "").lower()
            plan_id = (payload.plan_id or "").lower()

            plan_name = plan_name_raw.strip()

            # Primary: simple substring matching (backwards compatible)
            name_match = any(
                t and (t in plan_name or plan_name in t)
                for t in tags
            )

            # Secondary: word/token-based matching that ignores order and
            # generic brand words like "pharma" and "plan". This lets
            # values like "Pharma Plus Semester" match "Semester Plus".
            token_match = False
            if not name_match and plan_name:

                def _normalize_tokens(value: str):
                    value = value.lower()
                    for ch in [",", "_", "-", "/"]:
                        value = value.replace(ch, " ")
                    value = (
                        value.replace("pharma", "")
                        .replace("plan", "")
                    )
                    return {part for part in value.split() if part}

                plan_tokens = _normalize_tokens(plan_name_raw)
                if plan_tokens:
                    for t in tags:
                        tag_tokens = _normalize_tokens(t)
                        if not tag_tokens:
                            continue
                        # Consider a match if one token set is a subset of the other,
                        # e.g. {"semester", "plus"} vs {"pharma", "semester", "plus"}.
                        if plan_tokens.issubset(tag_tokens) or tag_tokens.issubset(plan_tokens):
                            token_match = True
                            break

            if not (
                name_match
                or token_match
                or plan_type in tags
                or plan_id in tags
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This coupon is not applicable for the selected plan",
                )

    original_amount = payload.original_amount
    if original_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid original amount",
        )

    # Min purchase requirement
    if offer.min_purchase and original_amount < offer.min_purchase:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum purchase amount for this offer is ₹{offer.min_purchase}",
        )

    original_dec = _parse_amount_to_decimal(original_amount) or Decimal("0")

    # Calculate raw discount
    offer_type = (offer.type or "").lower()
    if offer_type == "percentage":
        discount_dec = _quantize_decimal(
            original_dec * Decimal(offer.value or 0) / Decimal(100)
        )
    else:
        discount_dec = _parse_amount_to_decimal(offer.value or 0) or Decimal("0")

    # Cap discount by max_discount if configured
    if offer.max_discount:
        max_disc_dec = _parse_amount_to_decimal(offer.max_discount)
        if max_disc_dec is not None and discount_dec > max_disc_dec:
            discount_dec = max_disc_dec

    if discount_dec <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This coupon does not provide any discount for the selected plan",
        )

    final_dec = original_dec - discount_dec
    if final_dec < Decimal("1"):
        final_dec = Decimal("1")

    discounted_amount = int(final_dec)
    discount_amount = int(original_dec - final_dec)

    message = f"Coupon applied! You save ₹{discount_amount}."

    return ApplyCouponResponse(
        code=offer.code,
        title=getattr(offer, "title", offer.code),
        description=getattr(offer, "description", None),
        original_amount=original_amount,
        discounted_amount=discounted_amount,
        discount_amount=discount_amount,
        message=message,
    )

class OfferResponse(BaseModel):
    code: str
    title: str
    description: Optional[str]
    type: str
    value: int
    min_purchase: Optional[int]
    applicable_to: Optional[str]
    visible_to_students: Optional[bool]


@router.get("/available-offers")
async def get_available_offers(
    plan_id: Optional[str] = None,
    plan_name: Optional[str] = None,
    plan_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get all available offers that are currently active and visible to students"""
    now = datetime.utcnow()
    
    # Query active offers that are marked visible_to_students
    query = db.query(Offer).filter(
        ((Offer.start_date == None) | (Offer.start_date <= now)),
        ((Offer.end_date == None) | (Offer.end_date >= now)),
        (Offer.visible_to_students == True)
    )
    
    # Check usage limit
    offers = []
    for offer in query.all():
        # Skip if usage limit reached
        if (
            offer.usage_limit is not None
            and offer.usage_count is not None
            and offer.usage_count >= offer.usage_limit
        ):
            continue
        
        # If plan filters provided, check applicability
        if plan_id or plan_name or plan_type:
            if offer.applicable_to:
                try:
                    applicable = json.loads(offer.applicable_to)
                    if isinstance(applicable, str):
                        applicable = [applicable]
                except Exception:
                    applicable = [
                        item.strip()
                        for item in offer.applicable_to.split(",")
                        if item.strip()
                    ]

                tags = {str(item).lower() for item in applicable}

                # If "all" is in tags, include this offer for every plan
                if "all" not in tags:
                    # Check if offer applies to this plan
                    plan_name_raw = plan_name or ""
                    plan_name_lower = plan_name_raw.lower()
                    plan_type_lower = (plan_type or "").lower()
                    plan_id_lower = (plan_id or "").lower()

                    match_found = False

                    # 1) Simple substring matching on name / type / id
                    for tag in tags:
                        if (
                            tag in plan_name_lower
                            or tag in plan_type_lower
                            or tag in plan_id_lower
                        ):
                            match_found = True
                            break

                    # 2) Fallback token-based matching (similar to apply_coupon),
                    #    so values like "Subject Plan" can match "Subject Pack" names.
                    if not match_found and plan_name_raw:

                        def _normalize_tokens(value: str):
                            value = value.lower()
                            for ch in [",", "_", "-", "/"]:
                                value = value.replace(ch, " ")
                            value = (
                                value.replace("pharma", "")
                                .replace("plan", "")
                            )
                            return {part for part in value.split() if part}

                        plan_tokens = _normalize_tokens(plan_name_raw)
                        if plan_tokens:
                            for tag in tags:
                                tag_tokens = _normalize_tokens(tag)
                                if not tag_tokens:
                                    continue
                                # Consider a match if one token set is a subset of the other,
                                # e.g. {"subject"} vs {"subject", "pack", "2", "subjects"}.
                                if plan_tokens.issubset(tag_tokens) or tag_tokens.issubset(plan_tokens):
                                    match_found = True
                                    break

                    # 3) Extra safety for subject-based plans: treat any tag containing
                    #    both "subject" and "plan" as applicable.
                    if not match_found and plan_type_lower == "subject-based":
                        for tag in tags:
                            if "subject" in tag and "plan" in tag:
                                match_found = True
                                break

                    if not match_found:
                        continue
        
        offers.append({
            "code": offer.code,
            "title": offer.title,
            "description": offer.description,
            "type": offer.type,
            "value": offer.value,
            "min_purchase": offer.min_purchase,
            "applicable_to": offer.applicable_to,
            "visible_to_students": getattr(offer, "visible_to_students", True),
        })
    
    return {"offers": offers}


@router.post("/create-order", response_model=CreateOrderResponse)
async def create_order(
    request: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    response: Response = None
):
    """Create Razorpay order for subscription payment"""
    try:
        # Validate Razorpay configuration
        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Razorpay configuration missing"
            )
        
        # Convert amount to paise (multiply by 100)
        amount_in_paise = request.amount * 100
        
        # Create receipt ID with user info (shortened for Razorpay 40-char limit)
        timestamp_short = str(int(datetime.utcnow().timestamp()))[-6:]  # Last 6 digits of timestamp
        receipt_id = f"r{current_user.id}_{request.plan_id[:15]}_{timestamp_short}"
        
        # Handle subject-based plans validation
        if request.plan_type == "subject-based":
            # Check if we have subjects data (for multiple subjects) or subject_code (for single subject)
            if not request.subjects and not request.subject_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Subject data is required for subject-based plans"
                )
            
            # For multiple subjects, check each one
            if request.subjects:
                for subject_data in request.subjects:
                    subject_code = subject_data.get('subject_code')
                    if not subject_code:
                        continue
                    
                    # Check if user already has this subject subscription
                    existing_subject_sub = db.query(Subscription).filter(
                        Subscription.user_id == current_user.id,
                        Subscription.plan_id == f"subject_{subject_code}",
                        Subscription.status == "active",
                        Subscription.end_date > datetime.utcnow()
                    ).first()
                    
                    if existing_subject_sub:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST, 
                            detail=f"You already have an active subscription for {subject_code}"
                        )
            else:
                # Single subject validation (backward compatibility)
                existing_subject_sub = db.query(Subscription).filter(
                    Subscription.user_id == current_user.id,
                    Subscription.plan_id == f"subject_{request.subject_code}",
                    Subscription.status == "active",
                    Subscription.end_date > datetime.utcnow()
                ).first()
                
                if existing_subject_sub:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST, 
                        detail=f"You already have an active subscription for {request.subject_code}"
                    )
        
        # Create Razorpay order
        order_data = {
            "amount": amount_in_paise,
            "currency": request.currency,
            "receipt": receipt_id,
            "payment_capture": 1,  # Auto-capture payment
            "notes": {
                "user_id": str(current_user.id),
                "plan_id": request.plan_id,
                "plan_name": request.plan_name,
                "plan_type": request.plan_type,
                "duration_months": request.duration_months,
                "subject_code": request.subject_code,
                "subjects": str(request.subjects) if request.subjects else None,
                "created_at": datetime.utcnow().isoformat()
            }
        }
        
        logger.info(f"🔍 DEBUG - Order creation request received:")
        logger.info(f"🔍 DEBUG - Amount: {request.amount}")
        logger.info(f"🔍 DEBUG - Plan type: {request.plan_type}")
        logger.info(f"🔍 DEBUG - Subject code: {request.subject_code}")
        logger.info(f"🔍 DEBUG - Subjects array: {request.subjects}")
        logger.info(f"🔍 DEBUG - Amount in paise: {amount_in_paise}")
        
        order = razorpay_client.order.create(order_data)

        logger.info(f"Razorpay order created successfully: {order['id']}")

        if is_enabled():
            try:
                capture_event(
                    current_user.mobile,  # Use mobile number as distinct_id instead of user.id
                    "payment_order_created",
                    {
                        "order_id": order['id'],
                        "plan_id": request.plan_id,
                        "plan_name": request.plan_name,
                        "plan_type": request.plan_type,
                        "duration_months": request.duration_months,
                        "amount": request.amount,
                        "user_id": current_user.id,  # Include user_id in properties for reference
                    },
                )
            except Exception as analytics_error:
                logger.debug("PostHog capture failed for order creation: %s", analytics_error)
        
        # Add CORS headers for payment-related responses
        if response:
            response.headers["Access-Control-Expose-Headers"] = "x-rtb-fingerprint-id, X-RTB-Fingerprint-ID"
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Requested-With, Accept, X-API-Key, X-Device-UUID, Origin, X-RTB-Fingerprint-ID"
        
        return CreateOrderResponse(
            order_id=order['id'],
            amount=request.amount,
            currency=request.currency,
            receipt=receipt_id
        )
        
    except Exception as e:
        logger.error(f"Error creating Razorpay order: {str(e)}")
        if is_enabled():
            try:
                capture_event(
                    current_user.mobile if 'current_user' in locals() and current_user else "anonymous",  # Use mobile number as distinct_id
                    "payment_order_failed",
                    {
                        "plan_id": request.plan_id,
                        "plan_name": request.plan_name,
                        "reason": str(e),
                        "user_id": current_user.id if 'current_user' in locals() and current_user else None,  # Include user_id in properties for reference
                    },
                )
            except Exception as analytics_error:
                logger.debug("PostHog capture failed for order error: %s", analytics_error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create order: {str(e)}"
        )

def verify_razorpay_signature(payment_id: str, order_id: str, signature: str) -> bool:
    """Verify Razorpay payment signature"""
    try:
        # Check if Razorpay secret is configured
        if not settings.RAZORPAY_KEY_SECRET or settings.RAZORPAY_KEY_SECRET == "YOUR_ACTUAL_SECRET_KEY_HERE":
            logger.error("Razorpay secret key not configured in environment variables")
            logger.error("Please set RAZORPAY_KEY_SECRET in your .env file")
            return False
        
        razorpay_secret = settings.RAZORPAY_KEY_SECRET.strip()  # Remove any whitespace
        logger.info("Using configured Razorpay secret key for signature verification")
            
        # Correct message format: order_id|payment_id (not payment_id|order_id)
        message = f"{order_id}|{payment_id}"
        logger.info(f"Verifying signature for payment_id: {payment_id}, order_id: {order_id}")
        logger.info(f"Message to sign: {message}")
        logger.info(f"Received signature: {signature}")
        
        generated_signature = hmac.new(
            razorpay_secret.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        logger.info(f"Generated signature: {generated_signature}")
        
        is_valid = hmac.compare_digest(generated_signature, signature)
        logger.info(f"Signature validation result: {is_valid}")
        
        if not is_valid:
            logger.error(f"Signature mismatch! Expected: {generated_signature}, Got: {signature}")
            logger.error(f"This might indicate the wrong secret key is being used")
        
        return is_valid
    except Exception as e:
        logger.error(f"Error verifying signature: {str(e)}")
        return False

@router.post("/verify")
async def verify_payment(
    request: dict,
    db: Session = Depends(get_db),
    response: Response = None
):
    """Verify direct payment and create subscription"""
    try:
        logger.info(f"🔍 Payment verification endpoint called")
        logger.info(f"Payment verification request received: {request}")
        
        payment_id = request.get('razorpay_payment_id')
        order_id = request.get('razorpay_order_id')
        signature = request.get('razorpay_signature')
        plan_data = request.get('plan_data')
        user_data = request.get('user_data')
        
        logger.info(f"Extracted data - payment_id: {payment_id}, order_id: {order_id}")
        logger.info(f"Plan data: {plan_data}")
        logger.info(f"User data: {user_data}")
        
        # Validate required fields
        if not all([payment_id, order_id, signature]):
            missing_fields = []
            if not payment_id: missing_fields.append('razorpay_payment_id')
            if not order_id: missing_fields.append('razorpay_order_id')
            if not signature: missing_fields.append('razorpay_signature')
            
            logger.error(f"Missing required Razorpay data: {missing_fields}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required Razorpay data: {', '.join(missing_fields)}"
            )
        
        if not plan_data or not user_data:
            missing_fields = []
            if not plan_data: missing_fields.append('plan_data')
            if not user_data: missing_fields.append('user_data')
            
            logger.error(f"Missing required payment data: {missing_fields}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required payment data: {', '.join(missing_fields)}"
            )
        
        # Verify signature
        logger.info("Starting signature verification...")
        if not verify_razorpay_signature(payment_id, order_id, signature):
            logger.error("Payment signature verification failed")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid payment signature"
            )
        
        logger.info("Payment signature verification successful")
        
        # Get user
        user = db.query(User).filter(User.id == user_data['id']).first()
        if not user:
            logger.error(f"User not found with ID: {user_data['id']}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Coupon information (if any) comes from the frontend plan_data
        coupon_code = None
        allowed_semesters = None
        if isinstance(plan_data, dict):
            raw_coupon = plan_data.get('couponCode')
            if isinstance(raw_coupon, str) and raw_coupon.strip():
                coupon_code = raw_coupon.strip().upper()

            # Optional: list of semester strings like ["1-1", "3-1"] for arbitrary yearly access
            raw_allowed = plan_data.get('allowedSemesters') or plan_data.get('allowed_semesters')
            if isinstance(raw_allowed, list):
                cleaned = []
                for item in raw_allowed:
                    if isinstance(item, str):
                        value = item.strip()
                        if value and value not in cleaned:
                            cleaned.append(value)
                if cleaned:
                    allowed_semesters = cleaned

        requested_amount_decimal = _parse_amount_to_decimal(plan_data.get('amount'))
        actual_paid_amount = _fetch_payment_amount_rupees(payment_id) or requested_amount_decimal

        if actual_paid_amount is None:
            logger.warning(
                "Unable to determine actual amount paid for payment_id=%s; falling back to requested amount",
                payment_id,
            )

        amount_paid_value = actual_paid_amount or requested_amount_decimal
        amount_paid_float = _decimal_to_float(amount_paid_value)

        # Calculate subscription dates
        start_date = datetime.utcnow()
        duration_months = plan_data.get('duration', 6)  # Default to 6 months if not provided
        end_date = start_date + timedelta(days=duration_months * 30)  # Approximate months

        # Determine plan type and handle subject-based subscriptions
        plan_identifier = plan_data.get('id', 'unknown')
        tier_id = (plan_data.get('tierId') or '').lower()
        plan_type = (plan_data.get('planType') or '').lower()
        subject_code = plan_data.get('subject_code')

        if plan_type == 'subject-based':
            # Handle subject-based subscription (single or multiple subjects)
            subjects_data = plan_data.get('subjects', [])
            
            # If no subjects array, fall back to single subject_code (backward compatibility)
            if not subjects_data and subject_code:
                subjects_data = [{
                    'subject_code': subject_code,
                    'subject_name': plan_data.get('name', subject_code),
                    'amount': plan_data.get('amount', 1)
                }]
            
            if not subjects_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Subject data is required for subject-based subscriptions"
                )
            
            created_subscriptions = []
            skipped_subjects = []
            eligible_subjects = []

            for subject_data in subjects_data:
                subject_code = subject_data.get('subject_code')
                subject_name = subject_data.get('subject_name', subject_code)

                if not subject_code:
                    continue

                existing_subject_sub = db.query(Subscription).filter(
                    Subscription.user_id == user.id,
                    Subscription.plan_id == f"subject_{subject_code}",
                    Subscription.status == "active",
                    Subscription.end_date > datetime.utcnow()
                ).first()

                if existing_subject_sub:
                    skipped_subjects.append(subject_code)
                    logger.info(f"User {user.id} already has active subscription for {subject_code}")
                    continue

                requested_amount = _parse_amount_to_decimal(subject_data.get('amount'))
                if requested_amount is None:
                    requested_amount = requested_amount_decimal
                if requested_amount is None:
                    requested_amount = Decimal('0')

                eligible_subjects.append({
                    "subject_code": subject_code,
                })
                eligible_subjects[-1]["subject_name"] = subject_name
                eligible_subjects[-1]["requested_amount"] = requested_amount

            allocations = _allocate_subject_payment_amounts(
                len(eligible_subjects),
                actual_paid_amount,
                [entry["requested_amount"] for entry in eligible_subjects]
            )

            for idx, subject_entry in enumerate(eligible_subjects):
                allocation_amount = allocations[idx] if idx < len(allocations) else None

                subscription = Subscription(
                    user_id=user.id,
                    plan_id=f"subject_{subject_entry['subject_code']}",
                    plan_name=f"Subject: {subject_entry['subject_name']}",
                    status="active",
                    start_date=start_date,
                    end_date=end_date,
                    auto_renew=False,
                    last_payment_id=payment_id,
                    last_payment_date=datetime.utcnow(),
                    amount_paid=allocation_amount,
                    coupon_code=coupon_code,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                    notes=f"Subject-based subscription for {subject_entry['subject_code']}"
                )

                db.add(subscription)
                created_subscriptions.append({
                    "subject_code": subject_entry['subject_code'],
                    "subject_name": subject_entry['subject_name'],
                    "plan_id": f"subject_{subject_entry['subject_code']}",
                    "amount_paid": _decimal_to_float(allocation_amount)
                })

            # Update user subscription status for subject-based
            if created_subscriptions:
                user.subscription_status = "subject_based"
                user.subscription_plan = "subject-based"
                user.subscription_updated_at = datetime.utcnow()

            db.commit()
            

            logger.info(
                "Subject subscriptions created for user %s: %s new, %s skipped",
                user.id,
                len(created_subscriptions),
                len(skipped_subjects)
            )

            if created_subscriptions and skipped_subjects:
                message = f"Subscriptions created for {len(created_subscriptions)} subjects. {len(skipped_subjects)} subjects already active."
            elif created_subscriptions:
                message = f"Successfully subscribed to {len(created_subscriptions)} subjects!"
            else:
                message = "All selected subjects are already active."

            return {
                "success": True,
                "message": message,
                "subscriptions": created_subscriptions,
                "skipped_subjects": skipped_subjects,
                "total_subjects": len(subjects_data),
                "new_subscriptions": len(created_subscriptions),
                "subscription": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "duration_months": duration_months,
                    "payment_id": payment_id,
                    "amount_paid": _decimal_to_float(actual_paid_amount)
                },
                "user": {
                    "id": user.id,
                    "subscription_status": user.subscription_status,
                    "subscription_plan": user.subscription_plan,
                    "subscription_updated_at": user.subscription_updated_at.isoformat() if user.subscription_updated_at else None
                }
            }

        # Handle regular semester/yearly subscriptions
        if tier_id not in {'plus', 'pro'}:
            tier_label = 'pharma plus' if 'plus' in (plan_data.get('name') or '').lower() else 'pharma pro'
        else:
            tier_label = 'pharma plus' if tier_id == 'plus' else 'pharma pro'

        if plan_type not in {'semester', 'yearly'}:
            plan_cycle = 'semester' if duration_months <= 6 else 'yearly'
        else:
            plan_cycle = plan_type
        
        # Check if user already has a subscription
        existing_subscription = db.query(Subscription).filter(
            Subscription.user_id == user.id
        ).first()
        
        if existing_subscription:
            # Update existing subscription
            existing_subscription.plan_id = plan_identifier
            existing_subscription.plan_name = plan_data.get('name', 'Unknown Plan')
            existing_subscription.status = "active"
            existing_subscription.start_date = start_date
            existing_subscription.end_date = end_date
            existing_subscription.last_payment_id = payment_id
            existing_subscription.last_payment_date = datetime.utcnow()
            existing_subscription.amount_paid = amount_paid_value
            existing_subscription.coupon_code = coupon_code
            existing_subscription.updated_at = datetime.utcnow()
            if hasattr(existing_subscription, 'subscription_status'):
                existing_subscription.subscription_status = plan_identifier

            # Persist allowed semesters metadata for yearly plans, if provided
            if plan_cycle == 'yearly' and allowed_semesters:
                try:
                    existing_subscription.notes = json.dumps({"allowed_semesters": allowed_semesters})
                except Exception as e:
                    logger.warning(f"Failed to serialize allowed_semesters for subscription {existing_subscription.id}: {e}")
        
            logger.info(f"Updated existing subscription for user: {user.id}")
        else:
            # Create new subscription
            notes = None
            if plan_cycle == 'yearly' and allowed_semesters:
                try:
                    notes = json.dumps({"allowed_semesters": allowed_semesters})
                except Exception as e:
                    logger.warning(f"Failed to serialize allowed_semesters for new subscription for user {user.id}: {e}")

            subscription = Subscription(
                user_id=user.id,
                plan_id=plan_identifier,
                plan_name=plan_data.get('name', 'Unknown Plan'),
                status="active",
                start_date=start_date,
                end_date=end_date,
                auto_renew=False,  # No auto-renew for direct payments
                last_payment_id=payment_id,
                last_payment_date=datetime.utcnow(),
                amount_paid=amount_paid_value,
                coupon_code=coupon_code,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                notes=notes,
            )
            if hasattr(subscription, 'subscription_status'):
                subscription.subscription_status = plan_identifier
            db.add(subscription)
            logger.info(f"Created new subscription for user: {user.id}")
        
        # Update user subscription status (explicit UPDATE to guarantee persistence)
        # Do NOT reset ai_tutor_queries so usage carries over on upgrade
        update_values = {
            User.subscription_status: plan_identifier,
            User.subscription_plan: plan_cycle,
            User.subscription_updated_at: datetime.utcnow(),
        }

        rows_updated = db.query(User).filter(User.id == user.id).update(update_values, synchronize_session=False)

        if rows_updated == 0:
            logger.warning(f"No user rows updated for user_id={user.id}; forcing attribute assignment")
            user.subscription_status = plan_identifier
            user.subscription_plan = plan_cycle
            user.subscription_updated_at = datetime.utcnow()
            db.add(user)
        
        # Log the changes being made
        logger.info(f"Updating user {user.id} subscription status to {plan_identifier}")
        logger.info(f"User subscription_plan: {user.subscription_plan}")
        logger.info(f"User subscription_status: {user.subscription_status}")
        logger.info(f"User subscription_updated_at: {user.subscription_updated_at}")
        
        logger.info(f"About to commit database changes for user {user.id}")
        try:
            # Flush changes to ensure they're in the session
            db.flush()
            
            # Commit the transaction
            db.commit()
            
            # Refresh the user object to get updated data
            db.refresh(user)
            if existing_subscription:
                db.refresh(existing_subscription)
            elif 'subscription' in locals():
                db.refresh(subscription)
            
            # Log the final state after commit
            logger.info(f"✅ Database commit successful for user {user.id}")
            logger.info(f"✅ Final user subscription_status: {user.subscription_status}")
            logger.info(f"✅ Final user subscription_plan: {user.subscription_plan}")
            logger.info(f"✅ Final user subscription_updated_at: {user.subscription_updated_at}")
            
        except Exception as commit_error:
            logger.error(f"❌ Database commit failed for user {user.id}: {str(commit_error)}")
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save subscription to database: {str(commit_error)}"
            )
        
        logger.info(f" Payment verification completed successfully for user {user.id}")
        logger.info(f" Subscription activated: {plan_data.get('name', 'Unknown Plan')} until {end_date}")

        if is_enabled():
            try:
                capture_event(
                    user.mobile,  # Use mobile number as distinct_id instead of user.id
                    "payment_verified",
                    {
                        "payment_id": payment_id,
                        "order_id": order_id,
                        "plan_id": plan_identifier,
                        "plan_name": plan_data.get('name', 'Unknown Plan'),
                        "plan_cycle": plan_cycle,
                        "duration_months": duration_months,
                        "amount": amount_paid_float,
                        "user_id": user.id,  # Include user_id in properties for reference
                    },
                )
            except Exception as analytics_error:
                logger.debug("PostHog capture failed for payment verification: %s", analytics_error)
        
        # Add CORS headers for payment-related responses
        if response:
            response.headers["Access-Control-Expose-Headers"] = "x-rtb-fingerprint-id, X-RTB-Fingerprint-ID"
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Requested-With, Accept, X-API-Key, X-Device-UUID, Origin, X-RTB-Fingerprint-ID"
        
        return {
            "success": True,
            "message": "Payment verified and subscription activated",
            "subscription": {
                "plan_name": plan_data.get('name', 'Unknown Plan'),
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "duration_months": duration_months,
                "payment_id": payment_id,
                "amount_paid": amount_paid_float
            },
            "user": {
                "id": user.id,
                "subscription_status": user.subscription_status,
                "subscription_plan": user.subscription_plan,
                "subscription_updated_at": user.subscription_updated_at.isoformat() if user.subscription_updated_at else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying payment: {str(e)}")
        if is_enabled():
            try:
                failing_user_id = user_data['mobile'] if 'user_data' in locals() and user_data and user_data.get('mobile') else "anonymous"
                capture_event(
                    failing_user_id,
                    "payment_verification_failed",
                    {
                        "payment_id": request.get('razorpay_payment_id') if isinstance(request, dict) else None,
                        "order_id": request.get('razorpay_order_id') if isinstance(request, dict) else None,
                        "plan_id": (plan_data or {}).get('id') if isinstance(plan_data, dict) else None,
                        "reason": str(e),
                    },
                )
            except Exception as analytics_error:
                logger.debug("PostHog capture failed for payment verification error: %s", analytics_error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify payment: {str(e)}"
        )

@router.get("/status")
async def get_subscription_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    response: Response = None
):
    """Get user's subscription status with trial information"""
    try:
        # Add cache-control headers to prevent browser caching
        if response:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        from ..utils.subscription_utils import is_free_trial_expired, get_trial_days_remaining
        
        # Get regular subscription (non-subject-based)
        subscription = db.query(Subscription).filter(
            Subscription.user_id == current_user.id,
            Subscription.status == "active",
            ~Subscription.plan_id.like("subject_%")  # Exclude subject-based subscriptions
        ).first()
        
        # Also check if subscription exists but might be expired
        if not subscription:
            subscription = db.query(Subscription).filter(
                Subscription.user_id == current_user.id,
                ~Subscription.plan_id.like("subject_%")  # Exclude subject-based subscriptions
            ).first()
        
        # Get all subject-based subscriptions
        subject_subscriptions = db.query(Subscription).filter(
            Subscription.user_id == current_user.id,
            Subscription.plan_id.like("subject_%"),
            Subscription.status == "active",
            Subscription.end_date > datetime.utcnow()
        ).all()

        total_subject_amount_paid = sum(
            (_decimal_to_float(sub.amount_paid) or 0) for sub in subject_subscriptions
        ) if subject_subscriptions else 0
        if total_subject_amount_paid == 0:
            total_subject_amount_paid = None
        
        # Get trial information
        trial_expired = is_free_trial_expired(current_user)
        trial_days_remaining = get_trial_days_remaining(current_user)
        
        # If subscription exists but is expired, treat as no subscription
        if subscription and subscription.is_expired:
            logger.info(f"User {current_user.id} has expired subscription, treating as no subscription")
            subscription = None
        
        if not subscription and not subject_subscriptions:
            # User has no active subscription - determine if they're in trial or trial expired
            if trial_expired:
                status = "trial_expired"
            elif trial_days_remaining is None:
                status = "free_trial"
            elif trial_days_remaining > 0:
                status = "free_trial"
            else:
                status = "free"
            
            return {
                "has_subscription": False,
                "status": status,
                "subscription_status": current_user.subscription_status or "free",
                "subscription_plan": current_user.subscription_plan,
                "plan_name": None,
                "valid_until": None,
                "is_active": False,
                "is_expired": True,
                "trial_expired": trial_expired,
                "trial_days_remaining": trial_days_remaining,
                "ai_tutor_queries": current_user.ai_tutor_queries or 0,
                "subscription_updated_at": current_user.subscription_updated_at.isoformat() if current_user.subscription_updated_at else None,
                "subject_subscriptions": []
            }
        
        # Handle subject-based subscriptions
        if subject_subscriptions and not subscription:
            accessible_subjects = [sub.plan_id.replace("subject_", "") for sub in subject_subscriptions]
            return {
                "has_subscription": True,
                "status": "subject_based",
                "subscription_status": "subject_based",
                "subscription_plan": "subject-based",
                "plan_name": f"Subject-Based ({len(subject_subscriptions)} subjects)",
                "valid_until": max(sub.end_date for sub in subject_subscriptions).isoformat(),
                "is_active": True,
                "is_expired": False,
                "trial_expired": False,
                "trial_days_remaining": 0,
                "ai_tutor_queries": current_user.ai_tutor_queries or 0,
                "subscription_updated_at": current_user.subscription_updated_at.isoformat() if current_user.subscription_updated_at else None,
                "subject_subscriptions": [sub.to_dict() for sub in subject_subscriptions],
                "accessible_subjects": accessible_subjects,
                "total_subjects": len(subject_subscriptions),
                "amount_paid": total_subject_amount_paid
            }
        
        is_expired = subscription.end_date < datetime.utcnow()
        
        status_label = (current_user.subscription_status or '').lower() or (subscription.plan_id or '').lower()
        if not is_expired:
            if 'pro' in status_label:
                active_status = 'pharma pro'
            elif 'plus' in status_label:
                active_status = 'pharma plus'
            else:
                active_status = 'pharma plus'
        else:
            active_status = 'expired'

        plan_cycle = current_user.subscription_plan or ('yearly' if 'year' in (subscription.plan_name or '').lower() else 'semester')

        # Compute detailed semester access info (may use allowed_semesters for yearly plans)
        semester_access = None
        try:
            semester_access = get_semester_access_info(current_user, subscription)
        except Exception as e:
            logger.warning(f"Failed to compute semester access info for user {current_user.id}: {e}")

        return {
            "has_subscription": True,
            "status": active_status,
            "subscription_status": current_user.subscription_status or subscription.plan_id,
            "plan_name": subscription.plan_name,
            "plan_id": subscription.plan_id,
            "subscription_plan": plan_cycle,
            "valid_until": subscription.end_date.isoformat(),
            "is_active": not is_expired,
            "is_expired": is_expired,
            "start_date": subscription.start_date.isoformat(),
            "end_date": subscription.end_date.isoformat(),
            "trial_expired": False,  # Premium users don't have trial restrictions
            "trial_days_remaining": 0,  # Premium users don't have trial restrictions
            "ai_tutor_queries": current_user.ai_tutor_queries or 0,
            "subscription_updated_at": current_user.subscription_updated_at.isoformat() if current_user.subscription_updated_at else None,
            "subject_subscriptions": [sub.to_dict() for sub in subject_subscriptions],
            "accessible_subjects": [sub.plan_id.replace("subject_", "") for sub in subject_subscriptions],
            "total_subjects": len(subject_subscriptions),
            "amount_paid": _decimal_to_float(subscription.amount_paid),
            "semester_access": semester_access,
        }
        
    except Exception as e:
        logger.error(f"Error getting subscription status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get subscription status: {str(e)}"
        )

def verify_razorpay_webhook_signature(payload: str, signature: str) -> bool:
    """Verify Razorpay webhook signature"""
    try:
        # Check if Razorpay secret is configured
        if not settings.RAZORPAY_KEY_SECRET or settings.RAZORPAY_KEY_SECRET == "YOUR_ACTUAL_SECRET_KEY_HERE":
            logger.error("Razorpay secret key not configured for webhook verification")
            return False
        
        razorpay_secret = settings.RAZORPAY_KEY_SECRET.strip()
        
        # Generate expected signature
        expected_signature = hmac.new(
            razorpay_secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        # Compare signatures securely
        is_valid = hmac.compare_digest(expected_signature, signature)
        
        if not is_valid:
            logger.error(f"Webhook signature mismatch! Expected: {expected_signature}, Got: {signature}")
        
        return is_valid
    except Exception as e:
        logger.error(f"Error verifying webhook signature: {str(e)}")
        return False

@router.post("/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Razorpay webhook events, particularly payment.refunded"""
    try:
        # Get raw body and signature
        body = await request.body()
        payload = body.decode("utf-8")
        signature = request.headers.get("X-Razorpay-Signature")
        
        logger.info(f"🔔 Webhook received - Signature: {signature[:20] if signature else 'None'}...")
        
        # Verify webhook signature
        if not signature:
            logger.error("Missing X-Razorpay-Signature header")
            raise HTTPException(status_code=400, detail="Missing signature")
        
        if not verify_razorpay_webhook_signature(payload, signature):
            logger.error("Invalid webhook signature")
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        # Parse webhook payload
        try:
            event = json.loads(payload)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON payload: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
        event_type = event.get("event")
        logger.info(f"🔔 Webhook event type: {event_type}")
        
        # Handle refund-related events
        if event_type == "refund.processed":
            await handle_refund_processed(event, db)
        elif event_type == "refund.failed":
            await handle_refund_failed(event, db)
        elif event_type == "payment.refunded":  # Fallback for older accounts
            await handle_payment_refunded(event, db)
        else:
            logger.info(f"🔔 Unhandled webhook event type: {event_type}")
        
        return {"status": "ok"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")

async def handle_refund_processed(event: dict, db: Session):
    """Handle refund.processed webhook event"""
    try:
        # Extract refund information from webhook payload
        refund_data = event.get("payload", {}).get("refund", {}).get("entity", {})
        payment_id = refund_data.get("payment_id")
        
        if not payment_id:
            logger.error("No payment ID found in refund.processed webhook")
            return
        
        logger.info(f"🔄 Processing refund.processed for payment ID: {payment_id}")
        
        # Find subscription by last_payment_id (which contains Razorpay payment ID)
        subscription = db.query(Subscription).filter(
            Subscription.last_payment_id == payment_id
        ).first()
        
        if not subscription:
            logger.warning(f"No subscription found for payment ID: {payment_id}")
            return
        
        logger.info(f"📋 Found subscription for user {subscription.user_id}, plan: {subscription.plan_name}")
        
        # Get user
        user = db.query(User).filter(User.id == subscription.user_id).first()
        if not user:
            logger.error(f"User not found for subscription: {subscription.id}")
            return
        
        # Update subscription status to cancelled
        subscription.status = "cancelled"
        subscription.cancelled_at = datetime.utcnow()
        subscription.updated_at = datetime.utcnow()
        
        # Downgrade user to free plan
        user.subscription_status = "free"
        user.subscription_plan = None
        user.subscription_updated_at = datetime.utcnow()
        
        # Commit changes
        db.commit()
        
        logger.info(f"✅ Successfully processed refund.processed for user {user.id}")
        logger.info(f"✅ Subscription {subscription.id} marked as cancelled")
        logger.info(f"✅ User {user.id} downgraded to free plan")
        
    except Exception as e:
        logger.error(f"Error handling refund.processed: {str(e)}")
        db.rollback()
        raise

async def handle_refund_failed(event: dict, db: Session):
    """Handle refund.failed webhook event"""
    try:
        # Extract refund information from webhook payload
        refund_data = event.get("payload", {}).get("refund", {}).get("entity", {})
        payment_id = refund_data.get("payment_id")
        
        logger.info(f"❌ Refund failed for payment ID: {payment_id}")
        # For refund.failed, we don't need to do anything as the subscription should remain active
        
    except Exception as e:
        logger.error(f"Error handling refund.failed: {str(e)}")
        raise

async def handle_payment_refunded(event: dict, db: Session):
    """Handle payment.refunded webhook event"""
    try:
        # Extract payment information from webhook payload
        payment_data = event.get("payload", {}).get("payment", {}).get("entity", {})
        payment_id = payment_data.get("id")
        
        if not payment_id:
            logger.error("No payment ID found in refund webhook")
            return
        
        logger.info(f"🔄 Processing refund for payment ID: {payment_id}")
        
        # Find subscription by last_payment_id (which contains Razorpay payment ID)
        subscription = db.query(Subscription).filter(
            Subscription.last_payment_id == payment_id
        ).first()
        
        if not subscription:
            logger.warning(f"No subscription found for payment ID: {payment_id}")
            return
        
        logger.info(f"📋 Found subscription for user {subscription.user_id}, plan: {subscription.plan_name}")
        
        # Get user
        user = db.query(User).filter(User.id == subscription.user_id).first()
        if not user:
            logger.error(f"User not found for subscription: {subscription.id}")
            return
        
        # Update subscription status to cancelled
        subscription.status = "cancelled"
        subscription.cancelled_at = datetime.utcnow()
        subscription.updated_at = datetime.utcnow()
        
        # Downgrade user to free plan
        user.subscription_status = "free"
        user.subscription_plan = None
        user.subscription_updated_at = datetime.utcnow()
        
        # Commit changes
        db.commit()
        
        logger.info(f"✅ Successfully processed refund for user {user.id}")
        logger.info(f"✅ Subscription {subscription.id} marked as cancelled")
        logger.info(f"✅ User {user.id} downgraded to free plan")
        
    except Exception as e:
        logger.error(f"Error handling payment refund: {str(e)}")
        db.rollback()
        raise

# Import get_current_user function
from ..api.auth import get_current_user

