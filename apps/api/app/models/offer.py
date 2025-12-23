from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from datetime import datetime

from .base import Base


class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(50), nullable=False)  # e.g. 'percentage' or 'flat'
    value = Column(Integer, nullable=False)
    min_purchase = Column(Integer, nullable=True)
    max_discount = Column(Integer, nullable=True)
    usage_limit = Column(Integer, nullable=True)
    usage_count = Column(Integer, nullable=True, default=0)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    applicable_to = Column(Text, nullable=True)  # JSON / comma-separated list of applicable plans
    one_per_student = Column(Boolean, default=False)
    first_time_buyers_only = Column(Boolean, default=False)
    visible_to_students = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

