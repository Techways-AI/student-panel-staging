from sqlalchemy import Column, Integer, String, TIMESTAMP, func, Index
from app.models.base import Base

class ContentLibrary(Base):
    __tablename__ = "content_library"

    id = Column(Integer, primary_key=True, index=True)
    topic_name = Column(String(500), nullable=True, index=True)
    topic_slug = Column(String(255), index=True)
    s3_key = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False, index=True) # 'video' or 'notes'
    uploaded_via = Column(String(50), nullable=True) # e.g., 'PCI', 'JNTUH'
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index('idx_content_topic_slug_type', 'topic_slug', 'file_type'),
        Index('idx_content_topic_name_type', 'topic_name', 'file_type'),
    )
