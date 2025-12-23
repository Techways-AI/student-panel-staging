from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from .base import Base

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    amount = Column(Numeric(precision=10, scale=2), nullable=False)
    currency = Column(String(10), default="INR")
    interval = Column(String(20), nullable=False)  # 'semester', 'yearly'
    features = Column(JSONB, nullable=True)  # Plan features as JSON
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<SubscriptionPlan(id={self.id}, name='{self.name}', amount={self.amount}, interval='{self.interval}')>"

    @property
    def amount_in_paise(self):
        """Convert amount to paise for Razorpay"""
        return int(float(self.amount) * 100)

    @property
    def formatted_amount(self):
        """Format amount for display"""
        return f"₹{self.amount:,.2f}"

    @property
    def interval_display(self):
        """Format interval for display"""
        if self.interval == 'yearly':
            return f"per year"
        elif self.interval == 'semester':
            return f"per semester"
        else:
            return f"per {self.interval}"

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "amount": float(self.amount),
            "currency": self.currency,
            "interval": self.interval,
            "features": self.features,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "formatted_amount": self.formatted_amount,
            "interval_display": self.interval_display
        }

