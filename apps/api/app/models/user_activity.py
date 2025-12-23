from sqlalchemy import Column, Integer, Date, ForeignKey, UniqueConstraint
from .base import Base

class UserActivity(Base):
    __tablename__ = "user_activity"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    date = Column(Date, index=True, nullable=False)
    total_seconds = Column(Integer, default=0, nullable=False)
    # Weekly aggregation fields
    week_start = Column(Date, index=True, nullable=True)
    week_end = Column(Date, index=True, nullable=True)
    weekly_total_seconds = Column(Integer, default=0, nullable=False)
    # Denormalized academic fields for easier reporting
    year = Column(Integer, nullable=True, index=True)       # 1..4
    semester = Column(Integer, nullable=True, index=True)   # 1..2

    __table_args__ = (
        UniqueConstraint('user_id', 'date', name='uq_user_activity_user_date'),
    )

