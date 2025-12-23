from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .base import Base

class CourseStructure(Base):
    __tablename__ = "course_structure"
    
    id = Column(Integer, primary_key=True, index=True)
    course_name = Column(String, nullable=False)  # e.g., 'bpharmacy'
    year = Column(Integer, nullable=False)  # e.g., 1, 2, 3, 4
    semester = Column(Integer, nullable=False)  # e.g., 1, 2
    subject_name = Column(String, nullable=False)  # e.g., 'Human Anatomy and Physiology I'
    unit_name = Column(String, nullable=False)  # e.g., 'Introduction to Human Body'
    topic_name = Column(String, nullable=False)  # e.g., 'Cell Structure'
    topic_order = Column(Integer, nullable=False)  # Order within the unit
    unit_order = Column(Integer, nullable=False)  # Order within the subject
    is_active = Column(Integer, default=1)  # 1 for active, 0 for inactive
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Database indexes for performance optimization
    __table_args__ = (
        # Composite index for course + year + semester queries
        Index('idx_course_structure_course_year_semester', 'course_name', 'year', 'semester'),
        # Index for subject name queries
        Index('idx_course_structure_subject', 'subject_name'),
        # Index for unit ordering
        Index('idx_course_structure_unit_order', 'unit_order'),
        # Index for topic ordering
        Index('idx_course_structure_topic_order', 'topic_order'),
        # Composite unique constraint to prevent duplicates
        Index('idx_course_structure_unique', 'course_name', 'year', 'semester', 'subject_name', 'unit_name', 'topic_name', unique=True),
    )

