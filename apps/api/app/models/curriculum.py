from sqlalchemy import Column, Integer, String, DateTime, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from .base import Base

class UniversityCurriculum(Base):
    __tablename__ = "university_curricula"
    
    id = Column(Integer, primary_key=True, index=True)
    university = Column(String(255), nullable=False, index=True)
    regulation = Column(String(255), nullable=False, index=True)
    course = Column(String(255), nullable=False, index=True)
    effective_year = Column(String(50), nullable=True)
    curriculum_type = Column(String(50), nullable=False, default="university", index=True)
    curriculum_data = Column(JSONB, nullable=False)  # Full curriculum structure
    stats = Column(JSONB, nullable=True)  # Calculated statistics
    status = Column(String(50), nullable=False, default="active", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(255), nullable=True)
    
    __table_args__ = (
        Index('idx_university_curricula_university', 'university'),
        Index('idx_university_curricula_regulation', 'regulation'),
        Index('idx_university_curricula_course', 'course'),
        Index('idx_university_curricula_type', 'curriculum_type'),
        Index('idx_university_curricula_status', 'status'),
    )

