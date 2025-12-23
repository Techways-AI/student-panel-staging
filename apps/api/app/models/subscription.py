from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plan_id = Column(String(100), nullable=False)
    plan_name = Column(String(100), nullable=False)
    status = Column(String(50), default="active")  # active, expired, cancelled
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    auto_renew = Column(Boolean, default=False)  # Always false for simplified system
    last_payment_id = Column(String(255), nullable=True)
    last_payment_date = Column(DateTime, nullable=True)
    amount_paid = Column(Numeric(precision=10, scale=2), nullable=True)
    coupon_code = Column(String(100), nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="subscription")

    def __repr__(self):
        return f"<Subscription(id={self.id}, user_id={self.user_id}, plan='{self.plan_name}', status='{self.status}')>"

    @property
    def is_active(self):
        """Check if subscription is currently active"""
        return (
            self.status == "active" and 
            self.end_date > datetime.utcnow()
        )

    @property
    def is_expired(self):
        """Check if subscription has expired"""
        return self.end_date <= datetime.utcnow()

    @property
    def days_remaining(self):
        """Get number of days remaining in subscription"""
        if self.is_expired:
            return 0
        delta = self.end_date - datetime.utcnow()
        return max(0, delta.days)

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "plan_id": self.plan_id,
            "plan_name": self.plan_name,
            "status": self.status,
            "coupon_code": self.coupon_code,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "auto_renew": self.auto_renew,
            "last_payment_id": self.last_payment_id,
            "last_payment_date": self.last_payment_date.isoformat() if self.last_payment_date else None,
            "amount_paid": float(self.amount_paid) if self.amount_paid is not None else None,
            "cancelled_at": self.cancelled_at.isoformat() if self.cancelled_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_active": self.is_active,
            "is_expired": self.is_expired,
            "days_remaining": self.days_remaining
        }

