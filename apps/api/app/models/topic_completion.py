from sqlalchemy import Column, Integer, String, Date, ForeignKey, Boolean, DateTime, UniqueConstraint, Index
from datetime import datetime
from .base import Base

class TopicCompletion(Base):
    __tablename__ = "topic_completions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String, nullable=False)
    unit = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    date = Column(String, nullable=False)  # YYYY-MM-DD format
    
    # Individual completion flags
    video_watched = Column(Boolean, default=False)
    notes_read = Column(Boolean, default=False)
    quiz_completed = Column(Boolean, default=False)
    
    # Overall completion
    topic_completed = Column(Boolean, default=False)
    
    # Timestamps
    video_completed_at = Column(DateTime)
    notes_completed_at = Column(DateTime)
    quiz_completed_at = Column(DateTime)
    topic_completed_at = Column(DateTime)
    created_at = Column(DateTime, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    
    # Database indexes for performance optimization
    __table_args__ = (
        # Ensure unique constraint per user/topic/date combination
        UniqueConstraint('user_id', 'subject', 'unit', 'topic', 'date', name='_user_topic_date_uc'),
        # Index for user + subject + unit + topic queries (most common pattern)
        Index('idx_topic_completion_user_subject_unit_topic', 'user_id', 'subject', 'unit', 'topic'),
        # Index for user + date queries
        Index('idx_topic_completion_user_date', 'user_id', 'date'),
        # Index for completed topics filtering
        Index('idx_topic_completion_completed', 'topic_completed', postgresql_where=(topic_completed == True)),
    )

