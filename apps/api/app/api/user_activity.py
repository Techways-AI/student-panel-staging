from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from typing import Optional
import logging

from app.db.session import get_db
from app.models.user_activity import UserActivity
from app.models.user import User
from app.services.analytics.posthog_client import capture_event, is_enabled

router = APIRouter()
logger = logging.getLogger(__name__)


def _track_event(user_mobile: str, event_name: str, properties: dict, user_id: Optional[int] = None) -> None:
    if not is_enabled():
        return
    try:
        payload = dict(properties)
        if user_id is not None and "user_id" not in payload:
            payload["user_id"] = user_id
        capture_event(user_mobile, event_name, payload)
    except Exception as exc:  # pragma: no cover
        logger.debug("PostHog capture failed for %s: %s", event_name, exc)

@router.post("/user-activity")
def record_user_activity(data: dict, db: Session = Depends(get_db)):
    try:
        user_id = data.get("userId")
        seconds = int(data.get("seconds", 0))
    except Exception as exc:
        _track_event(
            "anonymous",  # Use anonymous for errors when we don't have a valid user
            "user_activity_invalid_payload",
            {
                "error": str(exc),
                "raw_data": data,
            },
        )
        raise HTTPException(status_code=400, detail="Invalid payload")

    if not user_id or seconds <= 0:
        _track_event(
            "anonymous",  # Use anonymous for missing data errors
            "user_activity_missing_data",
            {
                "user_id": user_id,
                "seconds": seconds,
            },
        )
        raise HTTPException(status_code=400, detail="Missing or invalid data")

    # Resolve userId to internal numeric user.id
    # If a string is provided, prefer treating it as a mobile first, then fall back to numeric id
    if isinstance(user_id, str):
        # Try as mobile number
        user = db.query(User).filter(User.mobile == user_id).first()
        if user:
            user_id = user.id
        else:
            # If numeric string, try as integer user id
            try:
                numeric_id = int(user_id)
            except ValueError:
                _track_event(
                    "anonymous",  # Use anonymous for user not found errors
                    "user_activity_user_not_found",
                    {
                        "identifier": user_id,
                        "reason": "invalid_identifier",
                    },
                )
                raise HTTPException(status_code=400, detail="Invalid user identifier")

            user = db.query(User).filter(User.id == numeric_id).first()
            if not user:
                _track_event(
                    "anonymous",  # Use anonymous for user not found errors
                    "user_activity_user_not_found",
                    {
                        "identifier": user_id,
                        "reason": "not_found",
                    },
                )
                raise HTTPException(status_code=404, detail="User not found")
            user_id = user.id
    else:
        # Ensure we have the user object when user_id was already numeric
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            _track_event(
                "anonymous",  # Use anonymous for user not found errors
                "user_activity_user_not_found",
                {
                    "identifier": user_id,
                    "reason": "not_found",
                },
            )
            raise HTTPException(status_code=404, detail="User not found")

    today = date.today()
    # Compute week boundaries (Monday start, Sunday end)
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    # Fetch or create today's row
    activity = (
        db.query(UserActivity)
        .filter(UserActivity.user_id == user_id, UserActivity.date == today)
        .first()
    )

    if activity:
        activity.total_seconds = (activity.total_seconds or 0) + seconds
        # Ensure week fields are populated
        if getattr(activity, "week_start", None) is None:
            activity.week_start = week_start
        if getattr(activity, "week_end", None) is None:
            activity.week_end = week_end
        # Sync academic fields from User on each update (denormalized)
        if hasattr(activity, "year"):
            activity.year = user.year
        if hasattr(activity, "semester"):
            activity.semester = user.semester
    else:
        activity = UserActivity(
            user_id=user_id,
            date=today,
            total_seconds=seconds,
            week_start=week_start,
            week_end=week_end,
            # Denormalized academic fields
            year=user.year,
            semester=user.semester,
        )
        db.add(activity)

    # Flush pending changes so aggregation includes latest value
    db.flush()

    # Compute cumulative weekly total for this user and week
    weekly_total = (
        db.query(func.coalesce(func.sum(UserActivity.total_seconds), 0))
        .filter(
            UserActivity.user_id == user_id,
            UserActivity.week_start == week_start,
        )
        .scalar()
    )
    weekly_total = int(weekly_total or 0)
    activity.weekly_total_seconds = weekly_total

    # Propagate the weekly cumulative total to all rows in the same week for this user
    db.query(UserActivity).filter(
        UserActivity.user_id == user_id,
        UserActivity.week_start == week_start,
    ).update({UserActivity.weekly_total_seconds: weekly_total}, synchronize_session=False)

    db.commit()

    _track_event(
        user.mobile,  # Use mobile number as distinct_id instead of user_id
        "user_activity_recorded",
        {
            "seconds": seconds,
            "weekly_total_seconds": weekly_total,
            "date": str(today),
            "week_start": str(week_start),
            "week_end": str(week_end),
            "user_id": user_id,  # Include user_id in properties for reference
        },
    )

    return {
        "message": "saved",
        "user_id": user_id,
        "date": str(today),
        "week_start": str(week_start),
        "week_end": str(week_end),
        "weekly_total_seconds": weekly_total,
    }

