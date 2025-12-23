from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import text, func
from app.models.streak import Streak
import logging

logger = logging.getLogger(__name__)

class StreakService:
    """Service for managing streak tracking across multiple activity types"""

    ACTIVITY_FIELDS = {
        "video": "videos_watched",
        "notes": "notes_completed",
        "quiz": "quizzes_completed",
    }

    @staticmethod
    def watch_video_and_update_streak(db: Session, user_id: int, user_local_date: date):
        """Backward-compatible wrapper for video completions."""
        result = StreakService._update_streak_for_activity(
            db=db,
            user_id=user_id,
            user_local_date=user_local_date,
            activity_type="video",
            first_action_label="first_watch_today",
        )

        logger.info(f"🔍 StreakService returning (video): {result}")
        return result

    @staticmethod
    def complete_notes_and_update_streak(db: Session, user_id: int, user_local_date: date):
        """Update streak counters when notes are completed."""
        result = StreakService._update_streak_for_activity(
            db=db,
            user_id=user_id,
            user_local_date=user_local_date,
            activity_type="notes",
            first_action_label="first_activity_today",
        )

        logger.info(f"🔍 StreakService returning (notes): {result}")
        return result

    @staticmethod
    def complete_quiz_and_update_streak(db: Session, user_id: int, user_local_date: date):
        """Update streak counters when quizzes are completed."""
        result = StreakService._update_streak_for_activity(
            db=db,
            user_id=user_id,
            user_local_date=user_local_date,
            activity_type="quiz",
            first_action_label="first_activity_today",
        )

        logger.info(f"🔍 StreakService returning (quiz): {result}")
        return result

    @classmethod
    def _update_streak_for_activity(
        cls,
        db: Session,
        user_id: int,
        user_local_date: date,
        activity_type: str,
        first_action_label: str,
    ):
        """Shared implementation for updating streak rows for any activity."""

        if activity_type not in cls.ACTIVITY_FIELDS:
            raise ValueError(f"Unsupported activity_type: {activity_type}")

        yesterday = user_local_date - timedelta(days=1)
        activity_field = cls.ACTIVITY_FIELDS[activity_type]

        logger.info(
            "🔍 StreakService._update_streak_for_activity called for user %s on %s (activity=%s)",
            user_id,
            user_local_date,
            activity_type,
        )

        try:
            try:
                db.execute(text("SELECT pg_advisory_xact_lock(:user_id)"), {"user_id": user_id})
            except Exception as lock_error:
                logger.warning("Advisory lock not available (non-PostgreSQL?): %s", lock_error)

            today_row = db.query(Streak).filter(
                Streak.user_id == user_id,
                Streak.activity_date == user_local_date,
            ).with_for_update().first()

            has_activity_today = cls._row_has_any_activity(today_row)

            if has_activity_today:
                logger.info(
                    "🔄 Incrementing existing row for activity %s: %s -> %s",
                    activity_type,
                    getattr(today_row, activity_field) or 0,
                    (getattr(today_row, activity_field) or 0) + 1,
                )
                cls._increment_activity(today_row, activity_field)
                today_row.updated_at = func.now()
                db.commit()

                logger.info(
                    "✅ User %s added %s activity on %s. Streak: %s",
                    user_id,
                    activity_type,
                    user_local_date,
                    today_row.current_streak,
                )

                return cls._build_result(today_row, "incremented_today", activity_type)

            prev_row = db.query(Streak).filter(
                Streak.user_id == user_id,
                Streak.activity_date < user_local_date,
            ).order_by(Streak.activity_date.desc()).first()

            if prev_row and prev_row.activity_date == yesterday:
                new_current = (prev_row.current_streak or 0) + 1
            else:
                new_current = 1

            previous_longest = prev_row.longest_streak if prev_row else 0
            new_longest = max(previous_longest or 0, new_current)

            if today_row:
                logger.info(
                    "🔄 Updating existing row (no prior activity) for %s. Setting %s to 1",
                    activity_type,
                    activity_field,
                )
                cls._ensure_activity_defaults(today_row)
                setattr(today_row, activity_field, 1)
                today_row.current_streak = new_current
                today_row.longest_streak = new_longest
                today_row.updated_at = func.now()
            else:
                logger.info(
                    "🆕 Creating new row for activity %s with streak %s",
                    activity_type,
                    new_current,
                )
                counts = {field: 0 for field in cls.ACTIVITY_FIELDS.values()}
                counts[activity_field] = 1
                today_row = Streak(
                    user_id=user_id,
                    activity_date=user_local_date,
                    current_streak=new_current,
                    longest_streak=new_longest,
                    **counts,
                )
                db.add(today_row)

            db.commit()
            db.refresh(today_row)

            logger.info(
                "✅ User %s first %s activity on %s. New streak: %s (longest %s)",
                user_id,
                activity_type,
                user_local_date,
                new_current,
                new_longest,
            )

            return cls._build_result(today_row, first_action_label, activity_type)

        except Exception as e:
            db.rollback()
            logger.error("Error updating streak for user %s: %s", user_id, e)
            raise

    @classmethod
    def _row_has_any_activity(cls, row: Optional[Streak]) -> bool:
        if not row:
            return False
        return any((getattr(row, field) or 0) > 0 for field in cls.ACTIVITY_FIELDS.values())

    @staticmethod
    def _increment_activity(row: Streak, field: str) -> None:
        current_value = getattr(row, field) or 0
        setattr(row, field, current_value + 1)

    @classmethod
    def _ensure_activity_defaults(cls, row: Streak) -> None:
        for field in cls.ACTIVITY_FIELDS.values():
            if getattr(row, field) is None:
                setattr(row, field, 0)

    @staticmethod
    def _build_result(row: Streak, action: str, activity_type: str) -> dict:
        return {
            "action": action,
            "activity_type": activity_type,
            "current_streak": row.current_streak,
            "longest_streak": row.longest_streak,
            "videos_watched": row.videos_watched or 0,
            "notes_completed": row.notes_completed or 0,
            "quizzes_completed": row.quizzes_completed or 0,
        }
    
    @staticmethod
    def get_user_streak_status(db: Session, user_id: int):
        """
        Get the latest streak status for a user.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            dict: Current streak status with display logic
        """
        # Get the most recent streak record
        latest_row = db.query(Streak).filter(
            Streak.user_id == user_id
        ).order_by(Streak.activity_date.desc()).first()
        
        if not latest_row:
            return {
                "current_streak": 0,
                "longest_streak": 0,
                "last_activity_date": None,
                "streak_status": "no_activity"
            }
        
        today = date.today()
        yesterday = today - timedelta(days=1)
        
        # Apply lazy reset display logic
        if latest_row.activity_date == today:
            # User already watched today
            display_streak = latest_row.current_streak
            streak_status = "active"
        elif latest_row.activity_date == yesterday:
            # User watched yesterday, streak still valid until end of today
            display_streak = latest_row.current_streak
            streak_status = "active"
        else:
            # User missed yesterday or earlier - streak is broken
            display_streak = 0
            streak_status = "broken"
        
        return {
            "current_streak": display_streak,
            "longest_streak": latest_row.longest_streak,
            "last_activity_date": latest_row.activity_date,
            "streak_status": streak_status,
            "videos_watched_today": latest_row.videos_watched if latest_row.activity_date == today else 0
        }
    
    @staticmethod
    def get_streak_history(db: Session, user_id: int, days: int = 30):
        """
        Get streak history for analytics/display.
        
        Args:
            db: Database session
            user_id: User ID
            days: Number of days to retrieve
            
        Returns:
            list: List of streak records
        """
        cutoff_date = date.today() - timedelta(days=days)
        
        return db.query(Streak).filter(
            Streak.user_id == user_id,
            Streak.activity_date >= cutoff_date
        ).order_by(Streak.activity_date.desc()).all()
    
    @staticmethod
    def _sync_with_daily_goals(db: Session, user_id: int, activity_date: date, current_streak: int):
        """No-op: Daily goals system removed."""
        logger.debug("_sync_with_daily_goals is deprecated and is now a no-op.")
        return

