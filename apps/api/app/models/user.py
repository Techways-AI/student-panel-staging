from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    mobile = Column(String, unique=True, index=True, nullable=False)
    name = Column(String)
    gender = Column(String)
    college_name = Column(String)
    university = Column(String, index=True)
    email = Column(String)
    whatsapp = Column(Boolean, default=False)
    quiz_score = Column(Integer, default=0)
    year = Column(Integer)  # Store as integer (1-4)
    semester = Column(Integer)  # Store as integer (1-2)
    role = Column(String, default="student")  # Add role field with default "student"
    current_streak = Column(Integer, default=0)  # Track current streak
    last_signin_date = Column(String)  # Store last sign-in date as YYYY-MM-DD
    total_xp = Column(Integer, default=0)      # Total XP (simplified)
    ai_tutor_queries = Column(Integer, default=0)  # Track AI Tutor usage for free users
    
    # Relationship to feedback
    feedbacks = relationship("Feedback", back_populates="user")
    
    # Relationship to generated notes
    generated_notes = relationship("GeneratedNotes", back_populates="generated_by")
    
    # Subscription fields
    subscription_status = Column(String, default="free")  # free, premium
    subscription_plan = Column(String, nullable=True)
    subscription_updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships for subscriptions
    subscription = relationship("Subscription", back_populates="user", uselist=False)
    
    # Devices relationship
    devices = relationship("Device", back_populates="user", cascade="all, delete-orphan")
    
    # Study plans relationship
    study_plans = relationship("StudyPlan", back_populates="user", cascade="all, delete-orphan") 

