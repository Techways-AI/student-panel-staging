from pydantic import BaseModel
from typing import Optional

class DailyGoalBase(BaseModel):
    videos_watched: int = 0
    quizzes_completed: int = 0
    streak: int = 0
    daily_tasks_completed: bool = False  # NEW: Track if daily scheduled tasks are completed

class DailyGoalCreate(DailyGoalBase):
    pass

class DailyGoalResponse(DailyGoalBase):
    date: str
    xp_awarded: Optional[int] = 0
    xp_success: Optional[bool] = False
    activity_id: Optional[str] = None
    class Config:
        from_attributes = True

class VideoWatchedRequest(BaseModel):
    subject: Optional[str] = None
    unit: Optional[str] = None
    topic: Optional[str] = None
    year: Optional[int] = None
    semester: Optional[int] = None

class NotesReadRequest(BaseModel):
    subject: Optional[str] = None
    unit: Optional[str] = None
    topic: Optional[str] = None

class QuizCompletedRequest(BaseModel):
    subject: Optional[str] = None
    unit: Optional[str] = None
    topic: Optional[str] = None
    year: Optional[int] = None
    semester: Optional[int] = None 

