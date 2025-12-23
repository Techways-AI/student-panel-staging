from sqlalchemy import Column, Integer, Date, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship
from datetime import datetime, date

from .base import Base


class AIDailyUsage(Base):
    """Per-user, per-day AI usage counters for Plus/Pro plans.

    This tracks how many AI Tutor / Ask AI queries a user has used on a given
    calendar date. Free users continue to use the lifetime counter on the
    users table (ai_tutor_queries).
    """

    __tablename__ = "ai_daily_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    used_queries = Column(Integer, nullable=False, default=0)

    # Optional snapshot of plan at the time of usage (e.g. "plus", "pro")
    plan_snapshot = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship back to User
    user = relationship("User", backref="ai_daily_usage")

