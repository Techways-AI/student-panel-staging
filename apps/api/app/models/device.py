from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from .base import Base

class Device(Base):
    __tablename__ = "devices"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    device_uuid = Column(UUID(as_uuid=True), nullable=False, unique=True, default=uuid.uuid4)
    device_type = Column(String(20), nullable=False)  # 'mobile' or 'desktop'
    fingerprint_hash = Column(String(64), nullable=True)  # HMAC SHA256 hash
    fingerprint_components = Column(JSONB, nullable=True)  # Store fingerprint components for debugging
    ip_address = Column(INET, nullable=True)  # Store IP for monitoring
    user_agent = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    last_used = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Relationship to user
    user = relationship("User", back_populates="devices")
    
    # Unique constraints for device binding enforcement
    __table_args__ = (
        # Allow multiple desktop devices per user, but only one mobile device
        UniqueConstraint('user_id', 'device_type', name='ux_user_device_type'),
        # Ensure device UUID is globally unique (prevents cross-user device sharing)
        UniqueConstraint('device_uuid', name='ux_device_uuid'),
        # Ensure fingerprint hash is globally unique (prevents cross-user device sharing)
        UniqueConstraint('fingerprint_hash', name='ux_fingerprint_hash'),
    )
    
    def __repr__(self):
        return f"<Device(id={self.id}, user_id={self.user_id}, device_uuid={self.device_uuid}, device_type={self.device_type})>"

