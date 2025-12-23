import requests
import os
from datetime import datetime, timedelta, date
import hashlib
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import re
import random
import logging
import httpx
import hashlib

from ..db.session import get_db
from ..models.user import User
from ..core.config import settings
from ..schemas.token import Token, TokenData
from ..services.device_service import DeviceService
from ..utils.msg91_service import msg91_service
from ..utils.header_sanitizer import sanitize_header_value
from ..services.analytics.posthog_client import capture_event, identify_user, is_enabled

load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Simple user-agent parser (avoid extra deps)
def _parse_user_agent(ua: str) -> dict:
    """Best-effort parse of OS and browser from user-agent.
    Returns keys: os_name, browser_name, browser_version
    """
    if not ua:
        return {"os_name": None, "browser_name": None, "browser_version": None}
    os_name = None
    # OS detection
    if "Windows" in ua:
        os_name = "Windows"
    elif "Android" in ua:
        os_name = "Android"
    elif "iPhone" in ua or "iPad" in ua or "iOS" in ua:
        os_name = "iOS"
    elif "Mac OS X" in ua or "Macintosh" in ua:
        os_name = "macOS"
    elif "Linux" in ua:
        os_name = "Linux"

    # Browser detection (order matters)
    browser_name = None
    browser_version = None
    patterns = [
        (r"Edg/([\d\.]+)", "Edge"),
        (r"Edge/([\d\.]+)", "Edge"),
        (r"Chrome/([\d\.]+)", "Chrome"),
        (r"Firefox/([\d\.]+)", "Firefox"),
        (r"Version/([\d\.]+).*Safari", "Safari"),
        (r"Safari/([\d\.]+)", "Safari"),
    ]
    for pat, name in patterns:
        m = re.search(pat, ua)
        if m:
            browser_name = name
            browser_version = m.group(1)
            break

    return {
        "os_name": os_name,
        "browser_name": browser_name,
        "browser_version": browser_version,
    }

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# JWT settings - use centralized config
from ..core.config import settings
SECRET_KEY = settings.JWT_SECRET_KEY
ALGORITHM = settings.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))  # 30 days

class UserCreate(BaseModel):
    mobile: str
    name: str
    gender: str
    college_name: str
    university: str
    email: EmailStr
    whatsapp: bool = False
    quiz_score: Optional[int] = None
    year: int
    semester: int

class MSG91AccessTokenRequest(BaseModel):
    accessToken: str
    mobile: Optional[str] = None
    device_uuid: Optional[str] = None
    device_type: Optional[str] = None
    fingerprint: Optional[dict] = None

class LoginResponse(BaseModel):
    success: bool
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    refresh_expires_in: int
    user_info: dict
    message: str

def create_access_token(data: dict, device_uuid: str = None, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire, 
        "iat": datetime.utcnow(),
        "device_uuid": device_uuid
    })
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, device_uuid: str = None):
    """Create a refresh token with longer expiry and device binding"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire, 
        "iat": datetime.utcnow(), 
        "type": "refresh",
        "device_uuid": device_uuid
    })
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def is_profile_complete(user: User) -> bool:
    """
    Check if user profile is complete with all required fields.
    Required fields: name, email, gender, college_name, university, year, semester
    """
    if not user:
        return False
    
    # Check all required fields are not None and not empty
    required_fields = [
        user.name,
        user.email, 
        user.gender,
        user.college_name,
        user.university,
        user.year,
        user.semester
    ]
    
    # All fields must be present and not empty strings
    return all(field is not None and str(field).strip() != '' for field in required_fields)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Sanitize the token to prevent gRPC errors
        sanitized_token = sanitize_header_value(token)
        if not sanitized_token:
            logger.error("Token is empty after sanitization")
            raise credentials_exception
            
        payload = jwt.decode(sanitized_token, SECRET_KEY, algorithms=[ALGORITHM])
        mobile: str = payload.get("sub")
        role: str = payload.get("role", "student")
        device_uuid: str = payload.get("device_uuid")
        
        if mobile is None:
            logger.error("❌ No mobile number in token")
            raise credentials_exception
            
        token_data = TokenData(mobile=mobile, role=role)
    except JWTError as e:
        logger.error(f"❌ JWT decode error: {str(e)}")
        raise credentials_exception
        
    user = db.query(User).filter(User.mobile == token_data.mobile).first()
    if user is None:
        logger.error(f"❌ User not found in database: {mobile}")
        raise credentials_exception
    
    # Validate device binding if device_uuid is present in token
    if device_uuid:
        from ..models.device import Device
        device = db.query(Device).filter(
            Device.device_uuid == device_uuid,
            Device.user_id == user.id,
            Device.is_active == True
        ).first()
        
        if not device:
            logger.warning(f"⚠️ Token device_uuid {device_uuid} not found or inactive for user {user.id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Device not found or inactive",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Update last_used timestamp
        device.last_used = datetime.utcnow()
        db.commit()
    
    # Update user role if it's not set or different from token
    if not user.role or user.role != role:
        user.role = role
        db.commit()
        db.refresh(user)
    
    return user

def require_student(user = Depends(get_current_user)):
    """Require that the user has student, admin, or sme role"""
    if user.role not in {"student", "admin", "sme"}:
        raise HTTPException(403, detail="Unauthorized")
    return user

@router.post("/verify-msg91-token", response_model=LoginResponse)
async def verify_msg91_token(req: MSG91AccessTokenRequest, request: Request, db: Session = Depends(get_db)):
    """Verify MSG91 widget access token and return JWT tokens."""
    access_token = (req.accessToken or "").strip()
    if not access_token:
        raise HTTPException(status_code=400, detail="accessToken required")

    if not settings.MSG91_AUTH_KEY:
        raise HTTPException(status_code=500, detail="MSG91 auth key not configured")

    url = "https://control.msg91.com/api/v5/widget/verifyAccessToken"
    payload = {
        "authkey": settings.MSG91_AUTH_KEY,
        "access-token": access_token,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
    except httpx.RequestError as exc:
        logger.error(f"MSG91 verifyAccessToken request failed: {exc}")
        raise HTTPException(status_code=502, detail="MSG91 request failed") from exc

    if resp.status_code != 200:
        logger.error(f"MSG91 verifyAccessToken failed with status {resp.status_code}: {resp.text}")
        raise HTTPException(status_code=502, detail="MSG91 verification failed")

    result = resp.json()
    if result.get("type") != "success":
        logger.warning(f"MSG91 verifyAccessToken returned non-success type: {result}")
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    mobile_raw = result.get("mobile") or ""
    clean_mobile = "".join(filter(str.isdigit, mobile_raw))

    if len(clean_mobile) == 12 and clean_mobile.startswith("91"):
        clean_mobile = clean_mobile[-10:]

    if not re.match(r"^[6-9]\d{9}$", clean_mobile):
        logger.error(f"Invalid mobile number from MSG91: {mobile_raw} -> {clean_mobile}")
        # Fallback to mobile provided by client (from login form) if available
        if req.mobile:
            fallback_raw = "".join(filter(str.isdigit, req.mobile))
            # Derive a 10-digit mobile from the end of the string if possible
            if len(fallback_raw) >= 10:
                fallback_mobile = fallback_raw[-10:]
                logger.info(
                    f"Using fallback mobile from request for MSG91 widget login: {fallback_mobile}"
                )
                clean_mobile = fallback_mobile
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid mobile number received from MSG91",
                )
        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid mobile number received from MSG91",
            )

    user = db.query(User).filter(User.mobile == clean_mobile).first()
    user_created = False
    if not user:
        user = User(mobile=clean_mobile, role="student")
        db.add(user)
        db.commit()
        db.refresh(user)
        user_created = True

    today_str = date.today().strftime("%Y-%m-%d")
    if user.last_signin_date != today_str:
        if user.last_signin_date:
            last_date = datetime.strptime(user.last_signin_date, "%Y-%m-%d").date()
            days_diff = (date.today() - last_date).days
            if days_diff == 1:
                user.current_streak = (user.current_streak or 0) + 1
            else:
                user.current_streak = 1
        else:
            user.current_streak = 1
        user.last_signin_date = today_str
        db.commit()
        db.refresh(user)

    device = None
    try:
        if is_profile_complete(user):
            logger.info(f"✅ User {user.id} has complete profile - proceeding with device registration (widget login)")
            device, is_new_device = DeviceService.register_device(
                db=db,
                user_id=user.id,
                device_uuid=req.device_uuid,
                fingerprint_data=req.fingerprint,
                request=request,
                device_type_override=req.device_type,
            )
            logger.info(f"Device {'registered' if is_new_device else 'recognized'} for user {user.id}: {device.device_uuid}")
        else:
            logger.info(f"⚠️ User {user.id} has incomplete profile - performing device pre-check only (widget login)")
            DeviceService.precheck_device_binding(
                db=db,
                user_id=user.id,
                device_uuid=req.device_uuid,
                fingerprint_data=req.fingerprint,
                request=request,
                device_type_override=req.device_type,
            )
            logger.info(f"✅ Device pre-check passed for user {user.id} - will register after profile completion")
    except HTTPException as e:
        logger.warning(f"Device validation failed for user {user.id} during MSG91 widget login: {e.detail}")
        # Provide accurate error message based on the actual issue
        if "Device limit" in str(e.detail):
            error_detail = f"Login blocked: {e.detail} Please contact support if you need to switch devices."
        else:
            error_detail = f"Login blocked: {e.detail}"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_detail,
            headers={"error_code": "DEVICE_LIMIT_REACHED"},
        )
    except Exception as e:
        logger.error(f"Error during device validation for user {user.id} during MSG91 widget login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Device validation failed. Please try again or contact support.",
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    device_uuid = str(device.device_uuid) if device else None
    access_token_jwt = create_access_token(
        data={"sub": clean_mobile, "role": user.role},
        device_uuid=device_uuid,
        expires_delta=access_token_expires,
    )

    refresh_token = create_refresh_token(
        data={"sub": clean_mobile, "role": user.role},
        device_uuid=device_uuid,
    )

    user_info = {
        "id": user.id,
        "mobile": user.mobile,
        "role": user.role,
        "name": user.name,
        "gender": user.gender,
        "email": user.email,
        "college_name": user.college_name,
        "university": user.university,
        "year": user.year,
        "semester": user.semester,
    }

    if is_enabled():
        login_method = "otp_widget"
        distinct_id = str(user.id or clean_mobile)
        profile_properties = {
            "mobile": user.mobile,
            "role": user.role,
            "name": user.name,
            "email": user.email,
            "existing_profile": is_profile_complete(user),
        }
        identify_user(distinct_id, profile_properties)
        event_properties = {
            "login_method": login_method,
            "is_new_user": user_created,
            "device_uuid": device_uuid,
            "device_type": getattr(device, "device_type", None) if device else req.device_type,
            "used_fallback_otp": False,
        }
        capture_event(distinct_id, "user_logged_in", {**event_properties, "success": True})
        if user_created:
            capture_event(distinct_id, "user_signed_up", event_properties)

    return LoginResponse(
        success=True,
        access_token=access_token_jwt,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        refresh_expires_in=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        user_info=user_info,
        message="Login successful",
    )

@router.post("/register", response_model=Token)
def register_user(user: UserCreate, request: Request, db: Session = Depends(get_db)):
    """
    Register a new user with complete profile information.
    Returns JWT token upon successful registration.
    """
    # Clean and validate mobile number format
    clean_mobile = ''.join(filter(str.isdigit, user.mobile))
    if not re.match(r'^[6-9]\d{9}$', clean_mobile):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid mobile number format. Must be 10 digits starting with 6-9"
        )
    
    # Check if user already exists
    db_user = db.query(User).filter(User.mobile == clean_mobile).first()
    
    if db_user:
        # Update existing user with new profile data
        db_user.name = user.name
        db_user.gender = user.gender
        db_user.college_name = user.college_name
        db_user.university = user.university
        db_user.email = user.email
        db_user.whatsapp = user.whatsapp
        db_user.quiz_score = user.quiz_score
        db_user.year = user.year
        db_user.semester = user.semester
        db.commit()
        db.refresh(db_user)
    else:
        # Create new user with cleaned mobile number
        db_user = User(
            mobile=clean_mobile,
            name=user.name,
            gender=user.gender,
            college_name=user.college_name,
            university=user.university,
            email=user.email,
            whatsapp=user.whatsapp,
            quiz_score=user.quiz_score,
            year=user.year,
            semester=user.semester,
            role="student"
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    
    # Register device automatically (only if profile is complete)
    try:
        # Check if user profile is complete before registering device
        if is_profile_complete(db_user):
            logger.info(f"✅ User {db_user.id} has complete profile - proceeding with device registration")
            ip_address = DeviceService.get_client_ip(request)
            user_agent = request.headers.get("user-agent", "")
            device_type = DeviceService.detect_device_type(user_agent)

            # Try to register the device
            DeviceService.register_device(
                db=db,
                user_id=db_user.id,
                device_uuid=None,
                fingerprint_data=None,
                request=request,
                device_type_override=device_type
            )
            logger.info(f"Auto-registered {device_type} device for user {db_user.id} during registration")
        else:
            logger.info(f"⚠️ User {db_user.id} has incomplete profile - skipping device registration for now")
            # Still perform security validation without creating database record
            DeviceService.precheck_device_binding(
                db=db,
                user_id=db_user.id,
                device_uuid=None,
                fingerprint_data=None,
                request=request,
                device_type_override=None
            )
            logger.info(f"✅ Device pre-check passed for user {db_user.id} - will register after profile completion")

    except HTTPException as e:
        # Device limit reached - block registration
        logger.warning(f"Device validation failed for user {db_user.id} during registration: {e.detail}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Registration blocked: {e.detail}",
            headers={"error_code": "DEVICE_LIMIT_REACHED"}
        )
    except Exception as e:
        # Log error and block registration
        logger.error(f"Error during device validation for user {db_user.id} during registration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Device validation failed. Please try again."
        )
    
    # Generate access token with role information
    access_token = create_access_token(data={"sub": clean_mobile, "role": db_user.role})
    
    # Prepare user info
    user_info = {
        "id": db_user.id,
        "mobile": db_user.mobile,
        "role": db_user.role,
        "name": db_user.name,
        "gender": db_user.gender,
        "email": db_user.email,
        "college_name": db_user.college_name,
        "university": db_user.university,
        "year": db_user.year,
        "semester": db_user.semester
    }
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user_info": user_info
    }

@router.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Get current user information.
    Requires valid JWT token in Authorization header.
    """
    logger.info(f"🔍 /me endpoint called for user: {current_user.mobile}")
    logger.info(f"🔍 User data: mobile={current_user.mobile}, name={current_user.name}, email={current_user.email}")
    return current_user

@router.post("/refresh")
async def refresh_token(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Refresh JWT token.
    Requires valid JWT token in Authorization header.
    """
    # Extract device_uuid from current token to preserve binding
    device_uuid = None
    try:
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = sanitize_header_value(auth_header.split(" ", 1)[1])
            if token:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                device_uuid = payload.get("device_uuid")
    except Exception:
        pass  # If we can't extract device_uuid, proceed without it
    
    # Generate new token (preserve device_uuid binding)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": current_user.mobile, "role": current_user.role}, 
        device_uuid=device_uuid,
        expires_delta=access_token_expires
    )
    
    # Prepare user info
    user_info = {
        "id": current_user.id,
        "mobile": current_user.mobile,
        "role": current_user.role,
        "name": current_user.name,
        "gender": current_user.gender,
        "email": current_user.email,
        "college_name": current_user.college_name,
        "university": current_user.university,
        "year": current_user.year,
        "semester": current_user.semester
    }
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user_info": user_info
    }

@router.post("/refresh-token")
async def refresh_token_with_expired_token(request: Request, db: Session = Depends(get_db)):
    """
    Refresh JWT token using an expired access token.
    This endpoint allows users to get new tokens even when their current token is expired.
    """
    try:
        # Get the Authorization header
        auth_header = request.headers.get("authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid authorization header"
            )
        
        # Extract the token
        token = auth_header.split(" ")[1]
        
        # Try to decode the token (even if expired)
        try:
            # Decode without checking expiration
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token format"
            )
        
        # Check if it's a refresh token
        if payload.get("type") == "refresh":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot use refresh token to get new access token"
            )
        
        # Extract user information
        mobile = payload.get("sub")
        role = payload.get("role", "student")
        device_uuid = payload.get("device_uuid")  # Preserve device binding
        
        if not mobile:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        # Verify user exists in database
        user = db.query(User).filter(User.mobile == mobile).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        # Generate new access token (preserve device_uuid binding)
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.mobile, "role": user.role}, 
            device_uuid=device_uuid,
            expires_delta=access_token_expires
        )
        
        # Generate new refresh token (preserve device_uuid binding)
        refresh_token = create_refresh_token(
            data={"sub": user.mobile, "role": user.role},
            device_uuid=device_uuid
        )
        
        # Prepare user info
        user_info = {
            "id": user.id,
            "mobile": user.mobile,
            "role": user.role,
            "name": user.name,
            "gender": user.gender,
            "email": user.email,
            "college_name": user.college_name,
            "university": user.university,
            "year": user.year,
            "semester": user.semester
        }
        
        logger.info(f"✅ Token refreshed for user {user.mobile}")
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "refresh_expires_in": REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
            "user_info": user_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error refreshing token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during token refresh"
        )

@router.get("/profile-completion-status")
async def get_profile_completion_status(current_user: User = Depends(get_current_user)):
    """
    Check if current user's profile is complete.
    Returns profile completion status and missing fields.
    """
    logger.info(f"🔍 Checking profile completion for user: {current_user.mobile}")
    
    # Check profile completion
    is_complete = is_profile_complete(current_user)
    
    # Get missing fields for debugging
    missing_fields = []
    if not current_user.name or str(current_user.name).strip() == '':
        missing_fields.append("name")
    if not current_user.email or str(current_user.email).strip() == '':
        missing_fields.append("email")
    if not current_user.gender or str(current_user.gender).strip() == '':
        missing_fields.append("gender")
    if not current_user.college_name or str(current_user.college_name).strip() == '':
        missing_fields.append("college_name")
    if not current_user.university or str(current_user.university).strip() == '':
        missing_fields.append("university")
    if not current_user.year:
        missing_fields.append("year")
    if not current_user.semester:
        missing_fields.append("semester")
    
    logger.info(f"📊 Profile completion status: {is_complete}, Missing fields: {missing_fields}")
    
    return {
        "is_profile_complete": is_complete,
        "missing_fields": missing_fields,
        "user_info": {
            "id": current_user.id,
            "mobile": current_user.mobile,
            "name": current_user.name,
            "email": current_user.email,
            "gender": current_user.gender,
            "college_name": current_user.college_name,
            "university": current_user.university,
            "year": current_user.year,
            "semester": current_user.semester
        }
    }

@router.get("/user-streak")
def get_user_streak(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Get user's current streak information.
    Requires authentication.
    """
    return {
        "current_streak": current_user.current_streak or 0,
        "last_signin_date": current_user.last_signin_date,
        "user_id": current_user.id
    }

@router.get("/devices")
def get_user_devices(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Get all active devices for the current user.
    Requires authentication.
    """
    devices = DeviceService.get_user_devices(db, current_user.id)

    # Determine current device_uuid from the presented token (if any)
    token_device_uuid = None
    try:
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = sanitize_header_value(auth_header.split(" ", 1)[1])
            if token:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                token_device_uuid = payload.get("device_uuid")
    except Exception as e:
        logger.warning(f"Could not extract device_uuid from token in /devices: {e}")
    
    device_list = []
    for device in devices:
        ua_info = _parse_user_agent(device.user_agent or "")
        device_list.append({
            "id": device.id,
            "device_uuid": str(device.device_uuid),
            "device_type": device.device_type,
            "ip_address": str(device.ip_address) if device.ip_address else None,
            "user_agent": device.user_agent,
            "os_name": ua_info.get("os_name"),
            "browser_name": ua_info.get("browser_name"),
            "browser_version": ua_info.get("browser_version"),
            "is_current_device": str(device.device_uuid) == str(token_device_uuid) if token_device_uuid else False,
            "created_at": device.created_at.isoformat(),
            "last_used": device.last_used.isoformat(),
            "is_active": device.is_active
        })
    
    return {
        "devices": device_list,
        "total_devices": len(device_list)
    }

@router.post("/devices/{device_uuid}/deactivate")
def deactivate_device(
    device_uuid: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Deactivate a device for the current user.
    Requires authentication.
    """
    success = DeviceService.deactivate_device(db, current_user.id, device_uuid)
    
    if success:
        return {
            "success": True,
            "message": f"Device {device_uuid} has been deactivated"
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found or already inactive"
        )

@router.post("/devices/replace")
def replace_device(
    old_device_uuid: str,
    new_device_uuid: str = None,
    fingerprint: dict = None,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Replace an existing device with a new one.
    Requires authentication.
    """
    try:
        new_device = DeviceService.replace_device(
            db=db,
            user_id=current_user.id,
            old_device_uuid=old_device_uuid,
            new_device_uuid=new_device_uuid,
            fingerprint_data=fingerprint,
            request=request
        )
        
        return {
            "success": True,
            "message": "Device replaced successfully",
            "new_device": {
                "device_uuid": str(new_device.device_uuid),
                "device_type": new_device.device_type,
                "created_at": new_device.created_at.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error replacing device for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to replace device"
        )

def require_admin(user = Depends(get_current_user)):
    """Require that the user has admin role"""
    if user.role != "admin":
        raise HTTPException(403, detail="Admin access required")
    return user

@router.post("/admin/devices/{device_uuid}/reset")
def admin_reset_device_binding(
    device_uuid: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    ADMIN ONLY: Reset device binding to allow it to be used by any user.
    This should only be used when device ownership changes (e.g., phone sold, laptop transferred).
    """
    try:
        success = DeviceService.reset_device_binding(
            db=db,
            device_uuid=device_uuid,
            admin_user_id=admin_user.id
        )
        
        if success:
            return {
                "success": True,
                "message": f"Device {device_uuid} binding has been reset. It can now be registered to any user.",
                "reset_by": admin_user.mobile,
                "reset_at": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found or already inactive"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting device binding: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset device binding"
        ) 

