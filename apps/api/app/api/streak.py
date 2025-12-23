from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import Optional
import logging

from app.db.session import get_db
from app.models.user import User
from app.api.auth import get_current_user
from app.services.streak_service import StreakService
from app.schemas.streak import StreakResponse, StreakStatusResponse, VideoWatchRequest
from app.services.analytics.posthog_client import capture_event, is_enabled

router = APIRouter()
logger = logging.getLogger(__name__)


def _track_event(user_mobile: str, event_name: str, properties: dict, user_id: Optional[int] = None) -> None:
    if not is_enabled():
        return
    try:
        payload = dict(properties)
        if user_id is not None and "user_id" not in payload:
            payload["user_id"] = user_id
        capture_event(user_mobile, event_name, payload)
    except Exception as exc:  # pragma: no cover
        logger.debug("PostHog capture failed for %s: %s", event_name, exc)

@router.post("/test-simple")
def test_simple_streak(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simple test endpoint to verify streak system is working
    """
    try:
        logger.info(f"Testing streak system for user {current_user.id}")
        
        # Test the streak service directly
        result = StreakService.watch_video_and_update_streak(
            db=db,
            user_id=current_user.id,
            user_local_date=date.today()
        )
        
        logger.info(f"Streak test result: {result}")

        _track_event(
            current_user.mobile,
            "streak_test_simple_success",
            {
                "result": result,
                "user_mobile": current_user.mobile,
            },
            user_id=current_user.id,
        )

        return {
            "success": True,
            "message": "Streak test completed",
            "user_id": current_user.id,
            "result": result
        }
        
    except Exception as e:
        logger.error(f"Error in streak test for user {current_user.id}: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        _track_event(
            current_user.mobile,
            "streak_test_simple_failed",
            {
                "error": str(e),
            },
            user_id=current_user.id,
        )
        raise HTTPException(status_code=500, detail=f"Streak test failed: {str(e)}")

@router.post("/watch-video", response_model=StreakResponse)
def watch_video(
    request: VideoWatchRequest,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Track when a user watches a video and update their streak.
    This is the main endpoint that should be called whenever a video is completed.
    """
    try:
        # Set cache-busting headers
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        response.headers["Last-Modified"] = datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT")
        
        # Debug logging
        logger.info(f"Streak API request received: {request}")
        logger.info(f"Request data: subject={request.subject}, topic={request.topic}, video_id={request.video_id}")
        logger.info(f"User ID: {current_user.id}, Mobile: {current_user.mobile}")
        
        # Use the date from request if provided, otherwise use today
        activity_date = request.activity_date or date.today()
        
        logger.info(f"User {current_user.id} ({current_user.mobile}) watched video on {activity_date}")
        
        # Update streak using the service
        result = StreakService.watch_video_and_update_streak(
            db=db,
            user_id=current_user.id,
            user_local_date=activity_date
        )
        
        logger.info(f"Streak service returned: {result}")

        _track_event(
            current_user.mobile,
            "streak_video_watch_tracked",
            {
                "video_id": request.video_id,
                "subject": request.subject,
                "topic": request.topic,
                "activity_date": str(activity_date),
                "result": result,
            },
            user_id=current_user.id,
        )

        return StreakResponse(
            success=True,
            message="Video watch tracked successfully",
            **result
        )
        
    except Exception as e:
        logger.error(f"Error tracking video watch for user {current_user.id}: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        _track_event(
            current_user.mobile,
            "streak_video_watch_failed",
            {
                "video_id": request.video_id,
                "subject": request.subject,
                "topic": request.topic,
                "error": str(e),
            },
            user_id=current_user.id,
        )
        raise HTTPException(status_code=500, detail="Failed to track video watch")

@router.get("/status", response_model=StreakStatusResponse)
def get_streak_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the current streak status for the user.
    Returns current streak, longest streak, and status information.
    """
    try:
        status = StreakService.get_user_streak_status(db, current_user.id)

        _track_event(
            current_user.mobile,
            "streak_status_viewed",
            {
                "current_streak": status.get("current_streak"),
                "longest_streak": status.get("longest_streak"),
                "last_activity_date": status.get("last_activity_date"),
            },
            user_id=current_user.id,
        )

        return StreakStatusResponse(
            success=True,
            **status
        )
        
    except Exception as e:
        logger.error(f"Error getting streak status for user {current_user.id}: {e}")
        _track_event(
            current_user.mobile,
            "streak_status_failed",
            {
                "error": str(e),
            },
            user_id=current_user.id,
        )
        raise HTTPException(status_code=500, detail="Failed to get streak status")

@router.get("/history")
def get_streak_history(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get streak history for the user.
    
    Args:
        days: Number of days to retrieve (default: 30, max: 365)
    """
    try:
        # Limit to reasonable range
        days = min(max(days, 1), 365)
        
        history = StreakService.get_streak_history(db, current_user.id, days)

        _track_event(
            current_user.mobile,
            "streak_history_viewed",
            {
                "days_requested": days,
                "records": len(history),
            },
            user_id=current_user.id,
        )

        return {
            "success": True,
            "history": [
                {
                    "date": record.activity_date.isoformat(),
                    "videos_watched": record.videos_watched,
                    "current_streak": record.current_streak,
                    "longest_streak": record.longest_streak
                }
                for record in history
            ],
            "total_days": len(history)
        }
        
    except Exception as e:
        logger.error(f"Error getting streak history for user {current_user.id}: {e}")
        _track_event(
            current_user.mobile,
            "streak_history_failed",
            {
                "days_requested": days,
                "error": str(e),
            },
            user_id=current_user.id,
        )
        raise HTTPException(status_code=500, detail="Failed to get streak history")

@router.post("/test-watch")
def test_watch_video(
    activity_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Test endpoint to simulate watching a video.
    Useful for testing streak functionality.
    """
    try:
        # Parse date if provided
        if activity_date:
            try:
                parsed_date = datetime.strptime(activity_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        else:
            parsed_date = date.today()
        
        logger.info(f"Test video watch for user {current_user.id} on {parsed_date}")

        result = StreakService.watch_video_and_update_streak(
            db=db,
            user_id=current_user.id,
            user_local_date=parsed_date
        )

        _track_event(
            current_user.mobile,
            "streak_test_watch_success",
            {
                "requested_date": str(parsed_date),
                "result": result,
            },
            user_id=current_user.id,
        )

        return {
            "success": True,
            "message": f"Test video watch recorded for {parsed_date}",
            **result
        }
        
    except Exception as e:
        logger.error(f"Error in test video watch for user {current_user.id}: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        _track_event(
            current_user.mobile,
            "streak_test_watch_failed",
            {
                "requested_date": activity_date,
                "error": str(e),
            },
            user_id=current_user.id,
        )
        raise HTTPException(status_code=500, detail="Failed to record test video watch")

@router.post("/test-watch-simple")
def test_watch_video_simple(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simple test endpoint without any parameters.
    """
    try:
        logger.info(f"Simple test video watch for user {current_user.id}")

        result = StreakService.watch_video_and_update_streak(
            db=db,
            user_id=current_user.id,
            user_local_date=date.today()
        )

        _track_event(
            current_user.mobile,
            "streak_test_watch_simple_success",
            {
                "result": result,
            },
            user_id=current_user.id,
        )

        return {
            "success": True,
            "message": "Simple test video watch recorded",
            **result
        }
        
    except Exception as e:
        logger.error(f"Error in simple test video watch for user {current_user.id}: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        _track_event(
            current_user.mobile,
            "streak_test_watch_simple_failed",
            {
                "error": str(e),
            },
            user_id=current_user.id,
        )
        raise HTTPException(status_code=500, detail="Failed to record test video watch")

@router.get("/debug-status")
def debug_streak_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Debug endpoint to show both old and new streak systems for comparison.
    """
    try:
        # Get new streak system data
        new_streak_status = StreakService.get_user_streak_status(db, current_user.id)

        # Get old daily goal data
        from app.models.daily_goal import DailyGoal
        from datetime import datetime
        
        today = datetime.now().strftime('%Y-%m-%d')
        old_goal = db.query(DailyGoal).filter_by(user_id=current_user.id, date=today).first()
        
        # Get recent streak records
        recent_streaks = StreakService.get_streak_history(db, current_user.id, 7)

        _track_event(
            current_user.mobile,
            "streak_debug_status_viewed",
            {
                "has_old_goal": bool(old_goal),
                "recent_records": len(recent_streaks),
            },
            user_id=current_user.id,
        )

        return {
            "user_id": current_user.id,
            "user_mobile": current_user.mobile,
            "new_streak_system": new_streak_status,
            "old_daily_goal": {
                "exists": old_goal is not None,
                "streak": old_goal.streak if old_goal else None,
                "videos_watched": old_goal.videos_watched if old_goal else None,
                "daily_tasks_completed": getattr(old_goal, 'daily_tasks_completed', None) if old_goal else None
            },
            "recent_streak_records": [
                {
                    "date": record.activity_date.isoformat(),
                    "videos_watched": record.videos_watched,
                    "current_streak": record.current_streak,
                    "longest_streak": record.longest_streak
                } for record in recent_streaks
            ]
        }
        
    except Exception as e:
        logger.error(f"Error in debug streak status for user {current_user.id}: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        _track_event(
            current_user.mobile,
            "streak_debug_status_failed",
            {
                "error": str(e),
            },
            user_id=current_user.id,
        )
        raise HTTPException(status_code=500, detail="Failed to get debug streak status")

