from sqlalchemy import Column, Integer, String, Index, UniqueConstraint
from app.models.base import Base

class TopicMapping(Base):
    __tablename__ = "topic_mappings"

    id = Column(Integer, primary_key=True, index=True)
    university_name = Column(String(255), nullable=False, index=True)
    university_topic = Column(String(500), nullable=False, index=True)
    pci_topic = Column(String(500), nullable=False)
    topic_slug = Column(String(255), nullable=False)

    __table_args__ = (
        UniqueConstraint('university_name', 'university_topic', name='uq_university_topic_mapping'),
        Index('idx_mapping_university_topic', 'university_name', 'university_topic'),
    )
