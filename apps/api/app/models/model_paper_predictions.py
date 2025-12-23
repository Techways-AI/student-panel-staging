from sqlalchemy import Column, String, Text, DateTime, Integer, JSON
from sqlalchemy.sql import func
from app.models.base import Base

class ModelPaperPredictions(Base):
    __tablename__ = "model_paper_predictions"
    
    id = Column(String, primary_key=True, index=True)
    model_paper_id = Column(String, nullable=True)
    course_name = Column(String, nullable=True)
    year = Column(String, nullable=True)
    semester = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    predicted_questions = Column(Text, nullable=True)
    text_length = Column(Integer, nullable=True)
    processed_by = Column(String, nullable=True)
    status = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    s3_key = Column(String, nullable=True)
    prediction_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<ModelPaperPredictions(id={self.id}, subject='{self.subject}', course_name='{self.course_name}')>" 

