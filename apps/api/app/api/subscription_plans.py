from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import logging
from ..db.session import get_db
from ..models.user import User
from ..models.subscription import Subscription
from ..api.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/subscription/status")
async def get_subscription_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's subscription status with trial information"""
    try:
        from ..utils.subscription_utils import is_free_trial_expired, get_trial_days_remaining
        
        subscription = db.query(Subscription).filter(
            Subscription.user_id == current_user.id,
            Subscription.status == "active"
        ).first()
        
        # Get trial information
        trial_expired = is_free_trial_expired(current_user)
        trial_days_remaining = get_trial_days_remaining(current_user)
        
        if not subscription:
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
                "subscription_status": current_user.subscription_status,
                "plan_name": None,
                "valid_until": None,
                "is_active": False,
                "is_expired": True,
                "trial_expired": trial_expired,
                "trial_days_remaining": trial_days_remaining,
                "subscription_updated_at": current_user.subscription_updated_at.isoformat() if current_user.subscription_updated_at else None
            }
        
        is_expired = subscription.end_date < datetime.utcnow()
        
        return {
            "has_subscription": True,
            "status": "premium" if not is_expired else "expired",
            "subscription_status": "premium",
            "plan_name": subscription.plan_name,
            "valid_until": subscription.end_date.isoformat(),
            "is_active": not is_expired,
            "is_expired": is_expired,
            "start_date": subscription.start_date.isoformat(),
            "end_date": subscription.end_date.isoformat(),
            "trial_expired": False,  # Premium users don't have trial restrictions
            "trial_days_remaining": 0,  # Premium users don't have trial restrictions
            "subscription_updated_at": current_user.subscription_updated_at.isoformat() if current_user.subscription_updated_at else None
        }
        
    except Exception as e:
        logger.error(f"Error getting subscription status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get subscription status: {str(e)}"
        )

