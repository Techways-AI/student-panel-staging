from pydantic import BaseModel, validator
from datetime import date
from typing import Optional

class VideoWatchRequest(BaseModel):
    """Request model for tracking video watches"""
    activity_date: Optional[date] = None  # User's local date, defaults to today
    video_id: Optional[str] = None  # Optional video identifier
    subject: Optional[str] = None  # Optional subject context
    topic: Optional[str] = None  # Optional topic context
    
    @validator('activity_date', pre=True)
    def parse_activity_date(cls, v):
        """Parse activity_date from string if needed"""
        if v is None:
            return None
        if isinstance(v, str):
            try:
                return date.fromisoformat(v)
            except ValueError:
                return None
        return v

class StreakResponse(BaseModel):
    """Response model for video watch tracking"""
    success: bool
    message: str
    action: str  # "first_watch_today" or "incremented_today"
    current_streak: int
    longest_streak: int
    videos_watched: int
    notes_completed: int
    quizzes_completed: int

class StreakStatusResponse(BaseModel):
    """Response model for streak status"""
    success: bool
    current_streak: int
    longest_streak: int
    last_activity_date: Optional[date]
    streak_status: str  # "active", "broken", "no_activity"
    videos_watched_today: int = 0

