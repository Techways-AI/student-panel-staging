from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class GeneratedNotes(Base):
    __tablename__ = "generated_notes"
    
    id = Column(String, primary_key=True, index=True)
    document_id = Column(String, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    notes_content = Column(Text, nullable=False)
    course_name = Column(String, nullable=True)
    subject_name = Column(String, nullable=True)
    unit_name = Column(String, nullable=True)
    topic = Column(String, nullable=True)
    document_name = Column(String, nullable=True)
    content_length = Column(Integer, nullable=True)
    notes_length = Column(Integer, nullable=True)
    s3_key = Column(String, nullable=True)
    notes_metadata = Column(Text, nullable=True)  # JSON string
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship to User
    generated_by = relationship("User", back_populates="generated_notes")
    
    def __repr__(self):
        return f"<GeneratedNotes(id={self.id}, document_id='{self.document_id}', document_name='{self.document_name}')>"

