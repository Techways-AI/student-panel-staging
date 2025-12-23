from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class FeedbackCreate(BaseModel):
    question: str
    ai_response: str
    feedback_text: str

class FeedbackResponse(BaseModel):
    id: int
    user_id: int
    question: str
    ai_response: str
    feedback_text: str
    created_at: datetime
    
    class Config:
        from_attributes = True 

