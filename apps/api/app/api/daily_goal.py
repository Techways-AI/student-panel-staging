from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date
from typing import Optional
from app.db.session import get_db
from app.models.daily_goal import DailyGoal
from app.models.user import User
from app.schemas.daily_goal import DailyGoalResponse
from app.api.auth import get_current_user
from sqlalchemy import desc
from app.schemas.daily_goal import VideoWatchedRequest, NotesReadRequest, QuizCompletedRequest
from app.utils.subject_utils import clean_subject_name
from app.services.analytics.posthog_client import capture_event, is_enabled

# Create router with authentication dependency
router = APIRouter(
    dependencies=[Depends(get_current_user)]  # 🔐 PROTECTS ALL ROUTES
)


def _track_event(user_mobile: str, event_name: str, properties: dict, user_id: Optional[int] = None) -> None:
    if not is_enabled():
        return
    try:
        payload = dict(properties)
        if user_id is not None and "user_id" not in payload:
            payload["user_id"] = user_id
        capture_event(user_mobile, event_name, payload)
    except Exception as exc:  # pragma: no cover
        import logging
        logging.getLogger(__name__).debug("PostHog capture failed for %s: %s", event_name, exc)


def get_today():
    return date.today().strftime('%Y-%m-%d')

def get_yesterday():
    return (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')

def check_goals_completed(goal):
    """
    SNAPCHAT-STYLE STREAK LOGIC: Check if user completed daily tasks today
    Streak increases by 1 for each consecutive day user completes daily tasks
    If user misses a day (doesn't complete daily tasks), streak resets to 0
    """
    # Check if daily tasks are completed (new logic)
    if hasattr(goal, 'daily_tasks_completed') and goal.daily_tasks_completed:
        return True
    
    # Fallback to old logic: Check if user watched at least 1 video today
    videos_watched = getattr(goal, 'videos_watched', 0) or 0
    return videos_watched >= 1

def update_streak(db: Session, user_id: int, today_goal: DailyGoal):
    """
    DEPRECATED: This function will be replaced with a new streak calculation logic.
    Keeping for backward compatibility until new logic is implemented.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Get yesterday's goal
    yesterday = get_yesterday()
    yesterday_goal = db.query(DailyGoal).filter_by(
        user_id=user_id, 
        date=yesterday
    ).first()

    # Check if today's goals are completed
    today_completed = check_goals_completed(today_goal)
    
    logger.info(f"Updating streak for user {user_id}:")
    logger.info(f"  Today's videos watched: {today_goal.videos_watched}")
    logger.info(f"  Today completed (1+ videos): {today_completed}")
    logger.info(f"  Yesterday goal exists: {yesterday_goal is not None}")
    
    if yesterday_goal:
        yesterday_completed = check_goals_completed(yesterday_goal)
        logger.info(f"  Yesterday completed: {yesterday_completed}")
        logger.info(f"  Yesterday streak: {yesterday_goal.streak}")

    if not today_completed:
        today_goal.streak = 0
        logger.info(f"  No videos watched today, setting streak to 0")
        return

    # If yesterday's goal exists and was completed, increment streak
    if yesterday_goal and check_goals_completed(yesterday_goal):
        today_goal.streak = yesterday_goal.streak + 1
        logger.info(f"  Incrementing streak from {yesterday_goal.streak} to {today_goal.streak}")
    else:
        # Start new streak (first day or yesterday was missed)
        today_goal.streak = 1
        logger.info(f"  Starting new streak: {today_goal.streak}")

@router.get('/todays-goals-progress', response_model=DailyGoalResponse)
def get_todays_goals_progress(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = date.today().strftime('%Y-%m-%d')
    goal = db.query(DailyGoal).filter_by(user_id=current_user.id, date=today).first()
    if not goal:
        # Don't create a goal automatically - user hasn't started today's goals yet
        # Return empty goal data
        empty_goal = DailyGoal(
            user_id=current_user.id, 
            date=today, 
            videos_watched=0, 
            quizzes_completed=0, 
            streak=0,
            daily_tasks_completed=False
        )
        # Don't save to database - just return the data
        return empty_goal
    else:
        # Ensure fields are not None
        if goal.videos_watched is None:
            goal.videos_watched = 0
        if goal.quizzes_completed is None:
            goal.quizzes_completed = 0
        if goal.streak is None:
            goal.streak = 0
        # Handle backward compatibility for daily_tasks_completed field
        if not hasattr(goal, 'daily_tasks_completed'):
            goal.daily_tasks_completed = False
        
        # Streak logic handled separately
        db.commit()
    
    return goal

@router.post('/mark-video-watched', response_model=DailyGoalResponse)
def mark_video_watched(
    request: VideoWatchedRequest,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Marking video as watched for user {current_user.id} ({current_user.mobile})")
    
    # Extract topic information from request
    subject = request.subject or "General"
    unit = request.unit or "General" 
    topic = request.topic or "General"
    year = request.year or 1
    semester = request.semester or 1
    
    # Create topic-specific activity ID to prevent duplicate XP awards
    video_activity_id = f"video_{current_user.id}_{subject}_{unit}_{topic}"
    
    today = date.today().strftime('%Y-%m-%d')
    goal = db.query(DailyGoal).filter_by(user_id=current_user.id, date=today).first()
    if not goal:
        logger.info(f"Creating new daily goal for user {current_user.id} when marking video as watched")
        goal = DailyGoal(user_id=current_user.id, date=today, videos_watched=1, quizzes_completed=0, streak=0, daily_tasks_completed=False)
        db.add(goal)
    else:
        if goal.videos_watched is None:
            goal.videos_watched = 0
        goal.videos_watched += 1
        logger.info(f"Updated videos watched to {goal.videos_watched}")
    
    # XP is now calculated directly in quiz completion endpoint
    
    # Streak logic handled separately
    db.add(goal)
    db.commit()
    db.refresh(goal)
    
    logger.info(f"Video marked as watched. Final goal state: videos={goal.videos_watched}, quizzes={goal.quizzes_completed}")
    
    xp_awarded = 0
    xp_success = False

    _track_event(
        current_user.mobile,
        "daily_goal_video_watched",
        {
            "activity_id": video_activity_id,
            "subject": subject,
            "unit": unit,
            "topic": topic,
            "year": year,
            "semester": semester,
            "videos_watched": goal.videos_watched,
            "quizzes_completed": goal.quizzes_completed,
        },
        user_id=current_user.id,
    )

    return {
        "id": goal.id,
        "user_id": goal.user_id,
        "date": goal.date,
        "videos_watched": goal.videos_watched,
        "quizzes_completed": goal.quizzes_completed,
        "streak": goal.streak,
        "xp_awarded": xp_awarded,
        "xp_success": xp_success,
        "activity_id": video_activity_id,
    }

@router.post('/mark-notes-read', response_model=DailyGoalResponse)
def mark_notes_read(
    request: NotesReadRequest,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Marking notes as read for user {current_user.id} ({current_user.mobile})")
    
    # Extract topic information from request
    subject = request.subject or "General"
    unit = request.unit or "General"
    topic = request.topic or "General"
    
    # Create topic-specific activity ID to prevent duplicate XP awards
    notes_activity_id = f"notes_{current_user.id}_{subject}_{unit}_{topic}"
    
    today = date.today().strftime('%Y-%m-%d')
    
    # XP is now calculated directly in quiz completion endpoint
    
    # Return the current daily goal record (or create if not exists)
    goal = db.query(DailyGoal).filter_by(user_id=current_user.id, date=today).first()
    if not goal:
        goal = DailyGoal(user_id=current_user.id, date=today, videos_watched=0, quizzes_completed=0)
        db.add(goal)
        db.commit()
        db.refresh(goal)
    
    xp_awarded = 0
    xp_success = False

    _track_event(
        current_user.mobile,
        "daily_goal_notes_read",
        {
            "activity_id": notes_activity_id,
            "subject": subject,
            "unit": unit,
            "topic": topic,
            "videos_watched": goal.videos_watched or 0,
            "quizzes_completed": goal.quizzes_completed or 0,
        },
        user_id=current_user.id,
    )

    return {
        "id": goal.id,
        "user_id": goal.user_id,
        "date": goal.date,
        "videos_watched": goal.videos_watched or 0,
        "quizzes_completed": goal.quizzes_completed or 0,
        "streak": goal.streak or 0,
        "xp_awarded": xp_awarded,
        "xp_success": xp_success,
        "activity_id": notes_activity_id,
    }

@router.post('/mark-quiz-completed', response_model=DailyGoalResponse)
def mark_quiz_completed(
    request: QuizCompletedRequest,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Marking quiz as completed for user {current_user.id} ({current_user.mobile})")
    
    # Extract topic information from request
    subject = request.subject or "General"
    unit = request.unit or "General"
    topic = request.topic or "General"
    year = request.year or 1
    semester = request.semester or 1
    
    # Create topic-specific activity ID to prevent duplicate XP awards
    quiz_activity_id = f"quiz_{current_user.id}_{subject}_{unit}_{topic}"
    
    today = date.today().strftime('%Y-%m-%d')
    goal = db.query(DailyGoal).filter_by(user_id=current_user.id, date=today).first()
    if not goal:
        logger.info(f"Creating new daily goal for user {current_user.id}")
        goal = DailyGoal(user_id=current_user.id, date=today, videos_watched=0, quizzes_completed=0, streak=0)
        db.add(goal)
    else:
        if goal.quizzes_completed is None:
            goal.quizzes_completed = 0
        goal.quizzes_completed += 1
        logger.info(f"Updated quizzes completed to {goal.quizzes_completed}")
    
    # XP is now calculated directly in quiz completion endpoint
    
    # Create a Quiz record to track progress for this subject/topic
    # This ensures the "In Progress" tab can show subjects with completed topics
    try:
        from app.models.quiz import Quiz
        
        # Check if a quiz record already exists for this user/subject/unit/topic
        cleaned_subject = clean_subject_name(subject)
        existing_quiz = db.query(Quiz).filter(
            Quiz.student_id == current_user.id,
            Quiz.subject == cleaned_subject,
            Quiz.unit == unit,
            Quiz.topic == topic
        ).first()
        
        if not existing_quiz:
            # Create new quiz record without XP - this will be updated when quiz is actually completed
            # Daily goals marking doesn't mean quiz was actually taken
            quiz_record = Quiz(
                student_id=current_user.id,
                year=year,
                semester=semester,
                subject=cleaned_subject,
                unit=unit,
                topic=topic,
                score=0,  # No score until quiz is actually taken
                xp_topic=None  # No XP until quiz is actually completed
            )
            db.add(quiz_record)
            logger.info(f"Created Quiz record for topic tracking: {cleaned_subject}/{unit}/{topic} (no XP until quiz completed)")
        else:
            # Update existing quiz record if needed
            logger.info(f"Quiz record already exists for: {cleaned_subject}/{unit}/{topic}")
    except Exception as e:
        logger.error(f"Error creating Quiz record: {str(e)}")
        # Don't fail the entire request if quiz record creation fails
    
    # Streak logic handled separately
    db.add(goal)
    db.commit()
    db.refresh(goal)
    
    logger.info(f"Quiz marked as completed. Final goal state: videos={goal.videos_watched}, quizzes={goal.quizzes_completed}")
    
    xp_awarded = 0
    xp_success = False

    _track_event(
        current_user.mobile,
        "daily_goal_quiz_completed",
        {
            "activity_id": quiz_activity_id,
            "subject": subject,
            "unit": unit,
            "topic": topic,
            "year": year,
            "semester": semester,
            "videos_watched": goal.videos_watched,
            "quizzes_completed": goal.quizzes_completed,
        },
        user_id=current_user.id,
    )

    return {
        "id": goal.id,
        "user_id": goal.user_id,
        "date": goal.date,
        "videos_watched": goal.videos_watched,
        "quizzes_completed": goal.quizzes_completed,
        "streak": goal.streak,
        "xp_awarded": xp_awarded,
        "xp_success": xp_success,
        "activity_id": quiz_activity_id,
    }

@router.post('/mark-daily-tasks-completed', response_model=DailyGoalResponse)
def mark_daily_tasks_completed(
    request: dict,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Mark daily tasks as completed when user finishes all scheduled subjects for the day
    This replaces the old video/quiz logic with MySchedule integration
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Marking daily tasks as completed for user {current_user.id} ({current_user.mobile})")
    
    today = date.today().strftime('%Y-%m-%d')
    goal = db.query(DailyGoal).filter_by(user_id=current_user.id, date=today).first()
    
    if not goal:
        logger.info(f"Creating new daily goal for user {current_user.id}")
        goal = DailyGoal(
            user_id=current_user.id, 
            date=today, 
            videos_watched=0, 
            quizzes_completed=0, 
            streak=0,
            daily_tasks_completed=True  # Mark as completed since this endpoint is called
        )
        db.add(goal)
    else:
        # Mark daily tasks as completed
        goal.daily_tasks_completed = True
        logger.info(f"Updated existing daily goal for user {current_user.id}")
    
    # Streak logic handled separately
    
    try:
        db.commit()
        db.refresh(goal)
        logger.info(f"Successfully marked daily tasks as completed for user {current_user.id}")
    except Exception as e:
        logger.error(f"Error committing daily tasks completion: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update daily goal")
    
    return goal

# Additional endpoints for frontend compatibility
@router.post('/test-mark-video', response_model=DailyGoalResponse)
def test_mark_video(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Test endpoint to manually mark a video as watched for debugging
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"TEST: Manually marking video as watched for user {current_user.id} ({current_user.mobile})")
    
    today = date.today().strftime('%Y-%m-%d')
    goal = db.query(DailyGoal).filter_by(user_id=current_user.id, date=today).first()
    if not goal:
        logger.info(f"TEST: Creating new daily goal for user {current_user.id}")
        goal = DailyGoal(user_id=current_user.id, date=today, videos_watched=1, quizzes_completed=0, streak=0, daily_tasks_completed=False)
        db.add(goal)
    else:
        if goal.videos_watched is None:
            goal.videos_watched = 0
        goal.videos_watched += 1
        logger.info(f"TEST: Updated videos watched to {goal.videos_watched}")
    
    # Update streak using StreakService to ensure consistency
    try:
        from app.services.streak_service import StreakService
        from datetime import date
        user_local_date = date.today()  # Use local date for streak calculation
        streak_result = StreakService.watch_video_and_update_streak(db, current_user.id, user_local_date)
        logger.info(f"TEST: Streak updated successfully: {streak_result}")
    except Exception as streak_error:
        logger.error(f"TEST: Error updating streak: {streak_error}")
        import traceback
        logger.error(f"TEST: Streak error traceback: {traceback.format_exc()}")
    
    db.add(goal)
    db.commit()
    db.refresh(goal)
    
    logger.info(f"TEST: Video marked as watched. Final goal state: videos={goal.videos_watched}, quizzes={goal.quizzes_completed}")
    
    return goal

@router.post('/mark-video-completed')
def mark_video_completed(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Mark a video as completed for streak calculation"""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Marking video as completed for user {current_user.id} ({current_user.mobile})")
    
    today = date.today().strftime('%Y-%m-%d')
    goal = db.query(DailyGoal).filter_by(user_id=current_user.id, date=today).first()
    
    if not goal:
        logger.info(f"Creating new daily goal for user {current_user.id}")
        goal = DailyGoal(
            user_id=current_user.id,
            date=today,
            videos_watched=1,
            quizzes_completed=0,
            streak=0,
            daily_tasks_completed=False
        )
        db.add(goal)
    else:
        if goal.videos_watched is None:
            goal.videos_watched = 0
        goal.videos_watched += 1
        logger.info(f"Updated videos watched to {goal.videos_watched}")
        
    # Update streak using StreakService
    try:
        from app.services.streak_service import StreakService
        from datetime import date
        user_local_date = date.today()  # Use local date for streak calculation
        streak_result = StreakService.watch_video_and_update_streak(db, current_user.id, user_local_date)
        logger.info(f"Streak updated successfully: {streak_result}")
        
        # Commit changes after successful streak update
        db.commit()
        db.refresh(goal)
    except Exception as streak_error:
        logger.error(f"Error updating streak: {streak_error}")
        import traceback
        logger.error(f"Streak error traceback: {traceback.format_exc()}")
        # Rollback on error to maintain data consistency
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update streak")
    
    logger.info(f"Video marked as completed. Final goal state: videos={goal.videos_watched}")
    
    return {
        "success": True,
        "message": "Video marked as completed",
        "videos_watched": goal.videos_watched,
        "streak": goal.streak or 0,
        "daily_tasks_completed": goal.daily_tasks_completed,
        "user_id": current_user.id
    }

@router.post('/update-streak-on-video-watch')
def update_streak_on_video_watch(
    request: VideoWatchedRequest,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Update streak when user watches any video in course content.
    This endpoint is called when video count is 1 or more, indicating streak completion for the day.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Updating streak on video watch for user {current_user.id} ({current_user.mobile})")
    
    # Extract topic information from request
    subject = request.subject or "General"
    unit = request.unit or "General" 
    topic = request.topic or "General"
    year = request.year or 1
    semester = request.semester or 1
    
    today = date.today().strftime('%Y-%m-%d')
    goal = db.query(DailyGoal).filter_by(user_id=current_user.id, date=today).first()
    
    if not goal:
        logger.info(f"Creating new daily goal for user {current_user.id} when video is watched")
        goal = DailyGoal(
            user_id=current_user.id, 
            date=today, 
            videos_watched=1, 
            quizzes_completed=0, 
            streak=0, 
            daily_tasks_completed=False
        )
        db.add(goal)
    else:
        # Ensure videos_watched is not None
        if goal.videos_watched is None:
            goal.videos_watched = 0
        
        # Only increment if this is the first video watched today
        if goal.videos_watched == 0:
            goal.videos_watched = 1
            logger.info(f"First video watched today, setting videos_watched to 1")
        else:
            logger.info(f"Video already watched today, current count: {goal.videos_watched}")
    
    # Update streak using StreakService
    try:
        from app.services.streak_service import StreakService
        from datetime import date
        user_local_date = date.today()  # Use local date for streak calculation
        streak_result = StreakService.watch_video_and_update_streak(db, current_user.id, user_local_date)
        logger.info(f"Streak updated successfully: {streak_result}")
        
        # Commit changes after successful streak update
        db.commit()
        db.refresh(goal)
        logger.info(f"Daily goals updated successfully. Final goal state: videos={goal.videos_watched}")
    except Exception as streak_error:
        logger.error(f"Error updating streak: {streak_error}")
        import traceback
        logger.error(f"Streak error traceback: {traceback.format_exc()}")
        # Rollback on error to maintain data consistency
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update streak")
    
    return {
        "success": True,
        "message": "Daily goals updated on video watch",
        "videos_watched": goal.videos_watched,
        "streak": goal.streak or 0,
        "daily_tasks_completed": goal.daily_tasks_completed,
        "user_id": current_user.id,
        "subject": subject,
        "unit": unit,
        "topic": topic,
        "date": today
    }

@router.post('/test-mark-video')
def test_mark_video(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Test endpoint to manually mark a video as watched"""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"TEST: Marking video as watched for user {current_user.id} ({current_user.mobile})")
    
    today = date.today().strftime('%Y-%m-%d')
    goal = db.query(DailyGoal).filter_by(user_id=current_user.id, date=today).first()
    if not goal:
        logger.info(f"TEST: Creating new daily goal for user {current_user.id}")
        goal = DailyGoal(user_id=current_user.id, date=today, videos_watched=1, quizzes_completed=0, streak=0, daily_tasks_completed=False)
        db.add(goal)
    else:
        if goal.videos_watched is None:
            goal.videos_watched = 0
        goal.videos_watched += 1
        logger.info(f"TEST: Updated videos watched to {goal.videos_watched}")
    
    # Update streak using StreakService
    try:
        from app.services.streak_service import StreakService
        from datetime import date
        user_local_date = date.today()  # Use local date for streak calculation
        streak_result = StreakService.watch_video_and_update_streak(db, current_user.id, user_local_date)
        logger.info(f"TEST: Streak updated successfully: {streak_result}")
    except Exception as streak_error:
        logger.error(f"TEST: Error updating streak: {streak_error}")
        import traceback
        logger.error(f"TEST: Streak error traceback: {traceback.format_exc()}")
    
    db.add(goal)
    db.commit()
    db.refresh(goal)
    
    logger.info(f"TEST: Video marked as watched. Final goal state: videos={goal.videos_watched}")
    
    return {
        "success": True,
        "message": "Video marked as watched",
        "videos_watched": goal.videos_watched,
        "streak": goal.streak or 0,
        "user_id": current_user.id
    }

@router.post('/force-update-streak')
def force_update_streak(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Force update streak for testing purposes"""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"FORCE: Updating streak for user {current_user.id} ({current_user.mobile})")
    
    today = date.today().strftime('%Y-%m-%d')
    goal = db.query(DailyGoal).filter_by(user_id=current_user.id, date=today).first()
    
    if not goal:
        logger.info(f"FORCE: Creating new daily goal for user {current_user.id}")
        goal = DailyGoal(
            user_id=current_user.id, 
            date=today, 
            videos_watched=1, 
            quizzes_completed=0, 
            streak=0, 
            daily_tasks_completed=False
        )
        db.add(goal)
    else:
        # Force set videos_watched to 1 if it's 0
        if goal.videos_watched == 0:
            goal.videos_watched = 1
            logger.info(f"FORCE: Setting videos_watched to 1")
        else:
            logger.info(f"FORCE: Videos already watched: {goal.videos_watched}")
    
    # Streak logic handled separately
    
    db.commit()
    db.refresh(goal)
    
    logger.info(f"FORCE: Daily goals updated. Final goal state: videos={goal.videos_watched}")
    
    return {
        "success": True,
        "message": "Daily goals force updated",
        "videos_watched": goal.videos_watched,
        "streak": goal.streak or 0,
        "user_id": current_user.id,
        "date": today
    }

@router.get('/daily-streak/{user_id}')
def get_daily_streak(user_id: str, db: Session = Depends(get_db)):
    """Get daily streak data for a user by mobile number using the new streak system"""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Daily streak request for user_id: {user_id}")
    
    # Find user by mobile number
    user = db.query(User).filter(User.mobile == user_id).first()
    if not user:
        logger.warning(f"User not found for mobile: {user_id}")
        raise HTTPException(status_code=404, detail="User not found")
    
    logger.info(f"Found user: {user.id} for mobile: {user_id}")
    
    # Use the new streak system to get current streak status
    from app.services.streak_service import StreakService
    streak_status = StreakService.get_user_streak_status(db, user.id)
    
    # Get today's goal for additional data
    today = date.today().strftime('%Y-%m-%d')
    goal = db.query(DailyGoal).filter_by(user_id=user.id, date=today).first()
    
    # Use streak data from the new system
    videos_watched_today = streak_status.get('videos_watched_today', 0)
    goal_done = videos_watched_today > 0
    
    response_data = {
        "streak": streak_status.get('current_streak', 0),
        "last_active_date": streak_status.get('last_activity_date'),
        "goal_done": goal_done,
        "videos_watched": videos_watched_today,
        "quizzes_completed": goal.quizzes_completed if goal else 0,
        "daily_tasks_completed": goal_done
    }
    
    logger.info(f"Returning daily streak data using new system: {response_data}")
    return response_data

@router.post('/daily-streak/update')
def update_daily_activity(db: Session = Depends(get_db)):
    """Update daily activity - this is called when user visits the overview page"""
    # This endpoint is mainly for tracking activity, not much logic needed
    return {"message": "Activity updated", "status": "success"}

@router.post('/daily-streak/goal-complete')
def mark_goal_complete(db: Session = Depends(get_db)):
    """Mark daily goal as complete - this is called when user completes their first goal"""
    # This endpoint is mainly for tracking goal completion, not much logic needed
    return {"message": "Goal marked as complete", "status": "success"}

@router.get('/daily-streak/week/{user_id}')
def get_weekly_streak(user_id: str, db: Session = Depends(get_db)):
    """Get daily goal completion for the last 7 days (Mon-Sun) for a user by mobile number"""
    user = db.query(User).filter(User.mobile == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    today = datetime.utcnow().date()
    # Find the start of the current week (Monday)
    start_of_week = today - timedelta(days=today.weekday())
    days = []
    for i in range(7):
        day_date = start_of_week + timedelta(days=i)
        goal = db.query(DailyGoal).filter_by(user_id=user.id, date=day_date.strftime('%Y-%m-%d')).first()
        
        # Only mark as completed if goal exists AND daily tasks are actually completed
        # Don't create new goals here - only check existing ones
        completed = False
        if goal and hasattr(goal, 'daily_tasks_completed'):
            completed = goal.daily_tasks_completed
        elif goal:
            # For backward compatibility, check if they actually completed videos/quizzes
            videos_completed = (goal.videos_watched or 0) >= 2
            quizzes_completed = (goal.quizzes_completed or 0) >= 1
            completed = videos_completed and quizzes_completed
        
        days.append({
            "date": day_date.strftime('%Y-%m-%d'),
            "completed": completed
        })
    return days 

@router.get('/dashboard-summary/{user_id}')
def get_dashboard_summary(user_id: str, db: Session = Depends(get_db)):
    """Get all dashboard data in a single optimized request"""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Dashboard summary request for user_id: {user_id}")
    
    # Find user by mobile number
    user = db.query(User).filter(User.mobile == user_id).first()
    if not user:
        logger.warning(f"User not found for mobile: {user_id}")
        raise HTTPException(status_code=404, detail="User not found")
    
    logger.info(f"Found user: {user.id} for mobile: {user_id}")
    
    today = date.today().strftime('%Y-%m-%d')
    goal = db.query(DailyGoal).filter_by(user_id=user.id, date=today).first()
    
    if not goal:
        logger.info(f"No daily goal found for user {user.id} on {today} - user hasn't started today's goals yet")
        # Don't create a goal if user hasn't started - use empty data
        goal = None
    
    # Get weekly streak data using the new streak system
    streak_history = StreakService.get_streak_history(db, user.id, 7)
    
    # Create weekly streak array (last 7 days)
    today_date = datetime.utcnow().date()
    weekly_data = []
    
    for i in range(7):
        check_date = today_date - timedelta(days=i)
        # Find streak record for this date
        day_record = next((record for record in streak_history if record.activity_date == check_date), None)
        completed = day_record is not None and day_record.videos_watched > 0
        
        weekly_data.append({
            "date": check_date.strftime('%Y-%m-%d'),
            "completed": completed
        })
    
    # Reverse to show oldest to newest
    weekly_data.reverse()
    
    # Get leaderboard data for user's year/semester
    logger.info(f"User year: {user.year}, semester: {user.semester}")
    
    # Handle case where user year/semester might be null
    user_year = user.year or 1
    user_semester = user.semester or 1
    logger.info(f"Using fallback year: {user_year}, semester: {user_semester}")
    
    leaderboard_query = db.query(User).filter(
        User.name != None, 
        User.name != "", 
        User.name != User.mobile,
        User.year == user_year,
        User.semester == user_semester
    ).order_by(User.total_xp.desc()).limit(10)
    
    # Log the leaderboard query results for debugging
    leaderboard_users = leaderboard_query.all()
    logger.info(f"Found {len(leaderboard_users)} users in leaderboard for year {user.year}, semester {user.semester}")
    for u in leaderboard_users:
        logger.info(f"Leaderboard user: {u.name} (Year: {u.year}, Semester: {u.semester}, XP: {u.total_xp})")
    
    leaderboard_data = [
        {
            "id": u.id, 
            "name": u.name, 
            "xp": u.total_xp or 0, 
            "level": 1  # Default level since we removed level calculation
        } for u in leaderboard_query.all()
    ]
    
    # Check if goals are completed using the new streak system
    from app.services.streak_service import StreakService
    streak_status = StreakService.get_user_streak_status(db, user.id)
    
    # Use streak data from the new system
    videos_watched_today = streak_status.get('videos_watched_today', 0)
    goal_done = videos_watched_today > 0
    
    daily_streak_data = {
        "streak": streak_status.get('current_streak', 0),
        "last_active_date": streak_status.get('last_activity_date'),
        "goal_done": goal_done,
        "videos_watched": videos_watched_today,
        "quizzes_completed": goal.quizzes_completed if goal else 0,
        "daily_tasks_completed": goal_done
    }
    
    response_data = {
        "daily_streak": daily_streak_data,
        "weekly_streak": weekly_data,
        "leaderboard": leaderboard_data,
        "user_info": {
            "name": user.name or user.mobile,
            "level": 1,  # Default level since we removed level calculation
            "xp_weekly": user.total_xp or 0,
            "xp_total": user.total_xp or 0
        }
    }
    
    logger.info(f"Returning dashboard summary data for user {user.id}")
    return response_data 

