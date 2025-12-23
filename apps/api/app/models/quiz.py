from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .base import Base

class Quiz(Base):
    __tablename__ = "quiz"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    semester = Column(Integer, nullable=False, index=True)
    subject = Column(String, nullable=False, index=True)
    unit = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    score = Column(Integer, nullable=False)
    xp_topic = Column(Integer, nullable=True)
    strengths = Column(Text, nullable=True)
    weakness = Column(Text, nullable=True)
    areas_to_improve = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    attempted_questions = relationship("QuizAttemptedQuestion", back_populates="quiz")

    __table_args__ = (
        Index('idx_quiz_student_subject', 'student_id', 'subject'),
        Index('idx_quiz_student_year_sem', 'student_id', 'year', 'semester'),
    )

class QuizAttemptedQuestion(Base):
    __tablename__ = "quiz_attempted_question"
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quiz.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    quiz = relationship("Quiz", back_populates="attempted_questions") 

