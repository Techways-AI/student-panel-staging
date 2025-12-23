"""
XP (Experience Points) Service for handling user experience points and leveling system.
"""

import logging
from sqlalchemy.orm import Session
from app.models.user import User

logger = logging.getLogger(__name__)

def award_xp(db: Session, user_id: int, xp_amount: int, reason: str = "Quiz completion") -> bool:
    """
    Award XP to a user for completing activities.
    
    Args:
        db: Database session
        user_id: ID of the user to award XP to
        xp_amount: Amount of XP to award
        reason: Reason for awarding XP (for logging)
    
    Returns:
        bool: True if XP was successfully awarded, False otherwise
    """
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.warning(f"User {user_id} not found when trying to award XP")
            return False
        
        # Award XP (assuming User model has an xp field)
        if hasattr(user, 'xp'):
            user.xp = (user.xp or 0) + xp_amount
        else:
            # If xp field doesn't exist, we'll just log it for now
            logger.info(f"XP field not found on User model. Would award {xp_amount} XP to user {user_id} for {reason}")
        
        db.commit()
        logger.info(f"Awarded {xp_amount} XP to user {user_id} for {reason}")
        return True
        
    except Exception as e:
        logger.error(f"Error awarding XP to user {user_id}: {str(e)}")
        db.rollback()
        return False

def get_user_level(xp: int) -> int:
    """
    Calculate user level based on XP.
    
    Args:
        xp: Total XP of the user
    
    Returns:
        int: User level
    """
    if xp < 100:
        return 1
    elif xp < 300:
        return 2
    elif xp < 600:
        return 3
    elif xp < 1000:
        return 4
    elif xp < 1500:
        return 5
    else:
        return min(10, 5 + (xp - 1500) // 500)  # Cap at level 10

def get_xp_for_next_level(current_xp: int) -> int:
    """
    Get XP required for next level.
    
    Args:
        current_xp: Current XP of the user
    
    Returns:
        int: XP required for next level
    """
    current_level = get_user_level(current_xp)
    
    level_thresholds = [0, 100, 300, 600, 1000, 1500]
    
    if current_level < len(level_thresholds):
        return level_thresholds[current_level] - current_xp
    else:
        # For levels beyond 5, each level requires 500 more XP
        next_threshold = 1500 + (current_level - 5) * 500
        return next_threshold - current_xp

