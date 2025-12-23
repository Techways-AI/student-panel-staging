from sqlalchemy import Column, Integer, String, Date, ForeignKey, Boolean, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

class StudyPlan(Base):
    """Study plan model to persist generated study plans"""
    __tablename__ = "study_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plan_type = Column(String, default="Exam-Focused")
    start_date = Column(String, nullable=False)  # YYYY-MM-DD
    exam_date = Column(String, nullable=False)   # YYYY-MM-DD
    days_remaining = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    semester = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    user = relationship("User", back_populates="study_plans")
    daily_tasks = relationship("StudyPlanTask", back_populates="study_plan", cascade="all, delete-orphan")


class StudyPlanTask(Base):
    """Individual tasks within a study plan"""
    __tablename__ = "study_plan_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    study_plan_id = Column(Integer, ForeignKey("study_plans.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Direct user reference for faster queries
    
    # Task details
    task_id = Column(String, nullable=False, index=True)  # Unique identifier within the plan
    title = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    # Optional denormalized fields to scope tasks by academic cohort without joins
    year = Column(Integer, nullable=True)
    semester = Column(Integer, nullable=True)
    priority = Column(String, nullable=False)  # High, Medium, Low
    task_type = Column(String, nullable=False)  # Study Session, Review, Practice, etc.
    duration = Column(String, nullable=False)  # "1 hour", "45 minutes", etc.
    scheduled_time = Column(String, nullable=False)  # "09:00 AM", etc.
    
    # Date and completion tracking
    date = Column(String, nullable=False, index=True)  # YYYY-MM-DD
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    
    # Individual activity completion tracking
    video_completed = Column(Boolean, default=False)
    notes_completed = Column(Boolean, default=False)
    quiz_completed = Column(Boolean, default=False)
    
    # Additional metadata
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    study_plan = relationship("StudyPlan", back_populates="daily_tasks")
    user = relationship("User")


class StudyPlanStats(Base):
    """Statistics and progress tracking for study plans"""
    __tablename__ = "study_plan_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    
    # Weekly statistics
    weekly_streak = Column(Integer, default=0)
    hours_this_week = Column(String, default="0h")  # Store as formatted string
    subjects_covered = Column(String, default="0/0")  # "current/total"
    
    # Overall statistics
    total_plans_created = Column(Integer, default=0)
    total_tasks_completed = Column(Integer, default=0)
    total_study_hours = Column(String, default="0h")
    
    # Last update tracking
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    week_start_date = Column(String, nullable=True)  # YYYY-MM-DD for tracking weekly resets
    
    # Relationships
    user = relationship("User")


