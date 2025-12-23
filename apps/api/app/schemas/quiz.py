from pydantic import BaseModel
from typing import List, Dict

class QuizRequest(BaseModel):
    year: int
    semester: int

class QuizResponse(BaseModel):
    questions: List[Dict]
    existing_quiz: bool = False
    previous_score: int = None
    quiz_id: int = None
    message: str = None
    subject: str = None
    unit: str = None
    topic: str = None

class ScoreRequest(BaseModel):
    questions: List[Dict]
    user_answers: List[int]
    year: int
    semester: int
    subject: str
    unit: str
    topic: str

class ScoreResponse(BaseModel):
    score: int
    total: int
    results: List[bool]
    xp_earned: int = 0
    xp_breakdown: Dict = None

class QuizCompletionRequest(BaseModel):
    subject: str
    unit: str
    topic: str
    user_id: int

class QuizMarkCompletedRequest(BaseModel):
    subject: str
    unit: str
    topic: str
    user_id: int
    score: int = 0 

