from sqlalchemy import Column, Integer, Date, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.sql import func
from .base import Base

class Streak(Base):
    __tablename__ = "streak"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    activity_date = Column(Date, nullable=False)  # User's local date for the activity
    videos_watched = Column(Integer, default=0)  # Number of videos watched on that date
    notes_completed = Column(Integer, default=0)  # Number of notes completed on that date
    quizzes_completed = Column(Integer, default=0)  # Number of quizzes completed on that date
    current_streak = Column(Integer, default=0)  # Consecutive days count as of that date
    longest_streak = Column(Integer, default=0)  # Historical max streak
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint('user_id', 'activity_date', name='_user_activity_date_uc'),
    )

