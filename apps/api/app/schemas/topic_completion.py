from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TopicCompletionRequest(BaseModel):
    subject: str
    unit: str
    topic: str
    date: Optional[str] = None  # If not provided, uses today

class TopicCompletionResponse(BaseModel):
    id: int
    user_id: int
    subject: str
    unit: str
    topic: str
    date: str
    video_watched: bool
    notes_read: bool
    quiz_completed: bool
    topic_completed: bool
    video_completed_at: Optional[datetime]
    notes_completed_at: Optional[datetime]
    quiz_completed_at: Optional[datetime]
    topic_completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

class TopicCompletionStatusResponse(BaseModel):
    subject: str
    unit: str
    topic: str
    date: str
    video_watched: bool
    notes_read: bool
    quiz_completed: bool
    topic_completed: bool
    can_complete: bool  # True if video_watched and notes_read are both True
    completion_percentage: int  # 0-100 based on completed steps

