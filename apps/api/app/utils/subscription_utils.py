from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime
from app.models.user import User
from app.models.subscription import Subscription
from app.utils.semester_access_utils import should_allow_semester_access, get_semester_access_info, parse_year_semester_from_path, get_user_current_year, get_user_current_semester
import logging
import json

logger = logging.getLogger(__name__)

def should_lock_content(user: User) -> bool:
    """
    Check if content should be locked for a user based on their subscription status.
    This is the original function that preserves existing functionality.
    
    Args:
        user: User object
        
    Returns:
        bool: True if content should be locked, False otherwise
    """
    # Check if user has an active subscription
    if user.subscription and user.subscription.is_active:
        logger.info(f"User {user.id} has active subscription, content unlocked")
        return False
    
    # Free users retain unlimited trial access
    if not is_free_trial_expired(user):
        logger.info(f"User {user.id} is on unlimited free trial, content unlocked")
        return False
    
    # User has no active subscription and trial has expired
    logger.info(f"User {user.id} has no active subscription and trial expired, content locked")
    return True

def is_free_trial_expired(user: User) -> bool:
    """
    Check if the user's free trial has expired.
    
    Args:
        user: User object
        
    Returns:
        bool: True if trial has expired, False if still active
    """
    # Unlimited free trial - always active unless subscription is premium
    if user.subscription and user.subscription.is_active:
        return False

    logger.debug(f"Unlimited free trial active for user {user.id}")
    return False

def get_trial_days_remaining(user: User) -> Optional[int]:
    """
    Get the number of days remaining in the user's free trial.
    Returns None for unlimited trial duration.
    
    Args:
        user: User object
        
    Returns:
        Optional[int]: Number of days remaining, None if unlimited
    """
    # If user has an active subscription, trial is not relevant
    if user.subscription and user.subscription.is_active:
        return 0
    
    # Unlimited trial - no countdown
    logger.debug(f"Unlimited free trial days remaining for user {user.id}")
    return None

def should_lock_content_by_semester(user: User, year_semester_str: str, subscription: Optional[Subscription] = None) -> bool:
    """
    Check if content should be locked based on semester access and subscription.
    Implements the refined access control logic:
    - Free Trial: 30 days, current year+sem only
    - Semester Plan: current year+sem full access  
    - Yearly Plan: current + next year/sem full access
    - Post-trial: all locked
    
    Args:
        user: User object
        year_semester_str: Year-semester string from content path (e.g., "1-1", "2-2")
        subscription: Active subscription object (optional)
        
    Returns:
        bool: True if content should be locked, False otherwise
    """
    # Parse the year-semester from the path
    parsed_semester = parse_year_semester_from_path(year_semester_str)
    if not parsed_semester:
        logger.warning(f"Invalid year-semester format: {year_semester_str}")
        return True
    
    year, semester = parsed_semester
    
    # Get user's current year and semester
    current_year = get_user_current_year(user)
    current_semester = get_user_current_semester(user)
    
    if not current_year or not current_semester:
        logger.warning(f"User {user.id} missing semester/year info: year={current_year}, semester={current_semester}")
        return True
    
    # Check if user has active subscription
    if subscription and subscription.is_active:
        plan_name = subscription.plan_name.lower()
        plan_id = (subscription.plan_id or "").lower()
        is_pro_tier = ("pro" in plan_name) or ("pro" in plan_id)

        if is_pro_tier:
            # Pro plans: access to current semester + next semester
            accessible_semesters = [(current_year, current_semester)]

            if current_semester == 1:
                accessible_semesters.append((current_year, 2))
            elif current_semester == 2:
                accessible_semesters.append((current_year + 1, 1))

            has_access = (year, semester) in accessible_semesters
            logger.info(f"Pro plan: User {user.id} can access {accessible_semesters}, requested {year_semester_str}: {has_access}")
            return not has_access

        if 'yearly' in plan_name:
            # Yearly Plan: by default access current year+sem + next year/sem.
            # If subscription.notes contains explicit allowed_semesters metadata,
            # use that set instead.
            accessible_semesters: List[tuple] = []

            extra_semesters: List[tuple] = []
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
                    accessible_semesters.append((current_year, 2))
                elif current_semester == 2 and current_year < 4:
                    accessible_semesters.append((current_year + 1, 1))
            
            has_access = (year, semester) in accessible_semesters
            logger.info(f"Yearly plan: User {user.id} can access {accessible_semesters}, requested {year_semester_str}: {has_access}")
            return not has_access
            
        elif 'semester' in plan_name:
            # Semester Plan: access only to current year+sem
            has_access = (year == current_year and semester == current_semester)
            logger.info(f"Semester plan: User {user.id} current {current_year}-{current_semester}, requested {year_semester_str}: {has_access}")
            return not has_access
            
        else:
            # Unknown plan type, default to current semester only
            has_access = (year == current_year and semester == current_semester)
            logger.warning(f"Unknown subscription plan '{plan_name}' for user {user.id}, defaulting to current semester")
            return not has_access
    
    # No active subscription - unlimited free trial grants current semester access
    if is_free_trial_expired(user):
        logger.info(f"User {user.id} trial expired (should not happen with unlimited trial), locking content")
        return True

    has_access = (year == current_year and semester == current_semester)
    logger.info(f"Unlimited free trial: User {user.id} current {current_year}-{current_semester}, requested {year_semester_str}: {has_access}")
    return not has_access

def get_content_access_info(user: User, year_semester_str: str, subscription: Optional[Subscription] = None) -> Dict[str, Any]:
    """
    Get comprehensive information about user's content access.
    
    Args:
        user: User object
        year_semester_str: Year-semester string from content path (e.g., "1-1", "2-2")
        subscription: Active subscription object (optional)
        
    Returns:
        dict: Comprehensive access information
    """
    # Basic access info
    trial_expired = is_free_trial_expired(user)
    trial_days_remaining = get_trial_days_remaining(user)
    basic_content_locked = should_lock_content(user)
    
    # Semester access info
    semester_access_info = get_semester_access_info(user, subscription)
    semester_content_locked = should_lock_content_by_semester(user, year_semester_str, subscription)
    
    # Overall access decision
    content_locked = basic_content_locked or semester_content_locked
    
    return {
        # Basic trial info
        "trial_expired": trial_expired,
        "trial_days_remaining": trial_days_remaining,
        "basic_content_locked": basic_content_locked,
        
        # Semester info
        "semester_content_locked": semester_content_locked,
        "semester_access_info": semester_access_info,
        
        # Overall access
        "content_locked": content_locked,
        "has_access": not content_locked,
        
        # User info
        "user_id": user.id,
        "subscription_active": subscription.is_active if subscription else False,
        "subscription_plan": subscription.plan_name if subscription else None,
        
        # Content info
        "requested_semester": year_semester_str
    }

def has_subject_access(user: User, subject_code: str, db: Session) -> bool:
    """
    Check if user has access to a specific subject.
    
    Args:
        user: User object
        subject_code: Subject code (e.g., 'PS101')
        db: Database session
        
    Returns:
        bool: True if user has access to the subject, False otherwise
    """
    # For subject-based users, skip regular subscription check
    # They should only get access to subjects they specifically purchased
    if user.subscription_status == 'subject_based':
        # Skip regular subscription check for subject-based users
        pass
    else:
        # Check regular subscription first (full access) - only for non-subject-based users
        if user.subscription and user.subscription.is_active:
            logger.info(f"User {user.id} has active regular subscription, access granted to {subject_code}")
            return True
    
    # Check subject-based subscriptions
    subject_subscription = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.plan_id == f"subject_{subject_code}",
        Subscription.status == "active",
        Subscription.end_date > datetime.utcnow()
    ).first()
    
    if subject_subscription:
        logger.info(f"User {user.id} has active subject subscription for {subject_code}")
        return True
    
    # Check free trial access (current semester only)
    # For subject-based users, don't return True here - let the content API handle 25% access
    # For regular users, return True for full access
    if not is_free_trial_expired(user) and user.subscription_status != 'subject_based':
        user_year = user.year or 1
        user_semester = user.semester or 1
        
        # Get subject details from hardcoded data
        from app.api.subject_subscriptions import SUBJECTS_DATA
        subject_info = next(
            ((code, name, year, semester) for code, name, year, semester in SUBJECTS_DATA 
            if code == subject_code), None)
        
        if subject_info:
            _, _, subject_year, subject_semester = subject_info
            has_access = (subject_year == user_year and subject_semester == user_semester)
            logger.info(f"Free trial: User {user.id} current {user_year}-{user_semester}, subject {subject_code} is {subject_year}-{subject_semester}: {has_access}")
            return has_access
    
    logger.info(f"User {user.id} has no access to subject {subject_code}")
    return False

def should_lock_content_by_subject(user: User, subject_code: str, db: Session) -> bool:
    """
    Check if content should be locked for a specific subject.
    
    Args:
        user: User object
        subject_code: Subject code (e.g., 'PS101')
        db: Database session
        
    Returns:
        bool: True if content should be locked, False otherwise
    """
    return not has_subject_access(user, subject_code, db)

def get_user_accessible_subjects(user: User, db: Session) -> List[str]:
    """
    Get all subjects user has access to.
    
    Args:
        user: User object
        db: Database session
        
    Returns:
        List[str]: List of subject codes user has access to
    """
    accessible_subjects = []
    
    # Check regular subscription
    if user.subscription and user.subscription.is_active:
        # User has full access to all subjects
        from app.api.subject_subscriptions import SUBJECTS_DATA
        return [code for code, _, _, _ in SUBJECTS_DATA]
    
    # Get subject-based subscriptions
    subject_subscriptions = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.plan_id.like("subject_%"),
        Subscription.status == "active",
        Subscription.end_date > datetime.utcnow()
    ).all()
    
    for sub in subject_subscriptions:
        subject_code = sub.plan_id.replace("subject_", "")
        accessible_subjects.append(subject_code)
    
    # Add free trial subjects
    # For subject-based users, don't add free trial subjects here - let the content API handle 25% access
    # For regular users, add free trial subjects for full access
    if not is_free_trial_expired(user) and user.subscription_status != 'subject_based':
        user_year = user.year or 1
        user_semester = user.semester or 1
        
        from app.api.subject_subscriptions import SUBJECTS_DATA
        trial_subjects = [
            code for code, _, year, semester in SUBJECTS_DATA 
            if year == user_year and semester == user_semester
        ]
        accessible_subjects.extend(trial_subjects)
    
    return list(set(accessible_subjects))  # Remove duplicates

