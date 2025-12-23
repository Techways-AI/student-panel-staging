from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.subscription import Subscription
from app.models.subscription_plan import SubscriptionPlan
import logging
import json

logger = logging.getLogger(__name__)

def get_user_current_semester(user: User) -> Optional[int]:
    """
    Get the user's current semester from their profile.
    
    Args:
        user: User object with semester field
        
    Returns:
        int: Current semester (1 or 2), or None if not set
    """
    if user.semester:
        return user.semester
    return None

def get_user_current_year(user: User) -> Optional[int]:
    """
    Get the user's current year from their profile.
    
    Args:
        user: User object with year field
        
    Returns:
        int: Current year (1-4), or None if not set
    """
    if user.year:
        return user.year
    return None

def get_accessible_semesters(user: User, subscription: Optional[Subscription] = None) -> List[Tuple[int, int]]:
    """
    Determine which semesters a user can access based on their subscription type.
    Implements the refined access control logic:
    - Free Trial: current year+sem only
    - Semester Plan: current year+sem only
    - Yearly Plan: current year+sem + next year/sem
    
    Args:
        user: User object with semester/year fields
        subscription: Active subscription object (optional)
        
    Returns:
        List[Tuple[int, int]]: List of (year, semester) tuples that user can access
    """
    current_year = get_user_current_year(user)
    current_semester = get_user_current_semester(user)
    
    # If user doesn't have semester/year info, return empty list
    if not current_year or not current_semester:
        logger.warning(f"User {user.id} missing semester/year info: year={current_year}, semester={current_semester}")
        return []
    
    accessible_semesters = []
    
    # Check subscription type
    if subscription and subscription.is_active:
        plan_name = subscription.plan_name.lower()
        plan_id = (subscription.plan_id or "").lower()
        is_pro_tier = ("pro" in plan_name) or ("pro" in plan_id)

        if is_pro_tier:
            # Pro plans: access to current semester + next semester
            accessible_semesters.append((current_year, current_semester))

            if current_semester == 1:
                accessible_semesters.append((current_year, 2))
            elif current_semester == 2 and current_year < 4:
                accessible_semesters.append((current_year + 1, 1))
            
        elif 'yearly' in plan_name:
            # Yearly plan: by default access current semester + next semester.
            # If subscription.notes contains explicit allowed_semesters metadata,
            # use that set instead.
            extra_semesters: List[Tuple[int, int]] = []
            notes = getattr(subscription, "notes", None)
            if notes:
                try:
                    data = json.loads(notes)
                    raw_list = data.get("allowed_semesters")
                    if isinstance(raw_list, list):
                        for item in raw_list:
                            if isinstance(item, str):
                                parsed = parse_year_semester_from_path(item)
                                if parsed and parsed not in extra_semesters:
                                    extra_semesters.append(parsed)
                except Exception:
                    logger.warning("Failed to parse allowed_semesters from subscription notes for user %s", user.id)

            if extra_semesters:
                for pair in extra_semesters:
                    if pair not in accessible_semesters:
                        accessible_semesters.append(pair)
            else:
                # Fallback: current + next semester
                accessible_semesters.append((current_year, current_semester))
                if current_semester == 1:
                    # Current semester 1, next is semester 2 of same year
                    accessible_semesters.append((current_year, 2))
                elif current_semester == 2 and current_year < 4:
                    # Current semester 2, next is semester 1 of next year (up to 4th year)
                    accessible_semesters.append((current_year + 1, 1))

            logger.info(f"Yearly subscription: User {user.id} can access semesters: {accessible_semesters}")
            
        elif 'semester' in plan_name:
            # Semester plan: access only to current semester
            accessible_semesters.append((current_year, current_semester))
            logger.info(f"Semester subscription: User {user.id} can access semester: {accessible_semesters}")
            
        else:
            # Unknown plan type, default to current semester only
            accessible_semesters.append((current_year, current_semester))
            logger.warning(f"Unknown subscription plan '{plan_name}' for user {user.id}, defaulting to current semester")
    else:
        # No active subscription - check if in free trial
        # Free trial: access only to current semester
        accessible_semesters.append((current_year, current_semester))
        logger.info(f"Free trial: User {user.id} can access current semester: {accessible_semesters}")
    
    return accessible_semesters

def is_semester_accessible(user: User, year: int, semester: int, subscription: Optional[Subscription] = None) -> bool:
    """
    Check if a user can access content for a specific semester.
    
    Args:
        user: User object
        year: Year to check (1-4)
        semester: Semester to check (1-2)
        subscription: Active subscription object (optional)
        
    Returns:
        bool: True if user can access the semester, False otherwise
    """
    accessible_semesters = get_accessible_semesters(user, subscription)
    return (year, semester) in accessible_semesters

def parse_year_semester_from_path(year_semester_str: str) -> Optional[Tuple[int, int]]:
    """
    Parse year-semester string from content path.
    
    Args:
        year_semester_str: String like "1-1", "2-2", etc.
        
    Returns:
        Tuple[int, int]: (year, semester) or None if invalid
    """
    try:
        if '-' in year_semester_str:
            year_str, semester_str = year_semester_str.split('-', 1)
            year = int(year_str)
            semester = int(semester_str)
            
            # Validate ranges
            if 1 <= year <= 4 and 1 <= semester <= 2:
                return (year, semester)
        return None
    except (ValueError, IndexError):
        return None

def should_allow_semester_access(user: User, year_semester_str: str, subscription: Optional[Subscription] = None) -> bool:
    """
    Check if user should have access to content based on semester and subscription.
    
    Args:
        user: User object
        year_semester_str: Year-semester string from content path (e.g., "1-1", "2-2")
        subscription: Active subscription object (optional)
        
    Returns:
        bool: True if access should be allowed, False otherwise
    """
    # Parse the year-semester from the path
    parsed_semester = parse_year_semester_from_path(year_semester_str)
    if not parsed_semester:
        logger.warning(f"Invalid year-semester format: {year_semester_str}")
        return False
    
    year, semester = parsed_semester
    
    # Check if user can access this semester
    return is_semester_accessible(user, year, semester, subscription)

def get_semester_access_info(user: User, subscription: Optional[Subscription] = None) -> dict:
    """
    Get detailed information about user's semester access.
    
    Args:
        user: User object
        subscription: Active subscription object (optional)
        
    Returns:
        dict: Access information including current semester, accessible semesters, etc.
    """
    current_year = get_user_current_year(user)
    current_semester = get_user_current_semester(user)
    accessible_semesters = get_accessible_semesters(user, subscription)
    
    # Determine subscription type
    subscription_type = "none"
    if subscription and subscription.is_active:
        plan_name = subscription.plan_name.lower()
        if 'yearly' in plan_name:
            subscription_type = "yearly"
        elif 'semester' in plan_name:
            subscription_type = "semester"
    
    return {
        "current_year": current_year,
        "current_semester": current_semester,
        "accessible_semesters": accessible_semesters,
        "subscription_type": subscription_type,
        "has_semester_info": current_year is not None and current_semester is not None,
        "total_accessible_semesters": len(accessible_semesters)
    }

