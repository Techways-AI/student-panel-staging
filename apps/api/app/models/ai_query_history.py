from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

class AIQueryHistory(Base):
    """
    Model to store the last 5 AI queries per user.
    Automatically maintains only the most recent 5 queries.
    """
    __tablename__ = "ai_query_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    query_text = Column(Text, nullable=False)
    source = Column(String(50), default="ai_tutor")  # 'ai_tutor' or 'ask_ai'
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Optional context fields
    document_id = Column(String, nullable=True)
    topic = Column(String, nullable=True)
    year = Column(String, nullable=True)
    semester = Column(String, nullable=True)
    
    # Relationship to user
    user = relationship("User", backref="ai_query_history")
    
    def __repr__(self):
        return f"<AIQueryHistory(id={self.id}, user_id={self.user_id}, query='{self.query_text[:50]}...', created_at={self.created_at})>"

