from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import json
from datetime import datetime, date

from ..db.session import get_db
from ..models import User, StudyPlanTask
from app.api.auth import get_current_user

router = APIRouter()

@router.get("/test")
def test_dashboard():
    """Test endpoint to verify dashboard API is working"""
    return {
        "message": "Dashboard API is working",
        "status": "success",
        "timestamp": datetime.now().isoformat()
    }

@router.get("/test-leaderboard-filtering")
def test_leaderboard_filtering(
    userId: str = Query(..., description="User ID to test filtering"),
    db: Session = Depends(get_db)
):
    """Test endpoint to verify leaderboard filtering is working correctly"""
    try:
        # Get the user
        user = db.query(User).filter(User.mobile == userId).first()
        if not user:
            return {"error": "User not found"}
        
        # Get user's year and semester
        user_year = user.year or 1
        user_semester = user.semester or 1
        
        # Get all users for comparison
        all_users = db.query(User).filter(
            User.name != None,
            User.name != "",
            User.name != User.mobile
        ).all()
        
        # Get filtered users (same year/semester)
        filtered_users = db.query(User).filter(
            User.name != None,
            User.name != "",
            User.name != User.mobile,
            User.year == user_year,
            User.semester == user_semester
        ).all()
        
        return {
            "test_user": {
                "name": user.name,
                "year": user.year,
                "semester": user.semester,
                "mobile": user.mobile
            },
            "filtering_info": {
                "user_year": user_year,
                "user_semester": user_semester,
                "total_users_in_db": len(all_users),
                "filtered_users_count": len(filtered_users),
                "filtered_users": [
                    {
                        "name": u.name,
                        "year": u.year,
                        "semester": u.semester,
                        "xp_weekly": u.total_xp
                    } for u in filtered_users
                ]
            }
        }
        
    except Exception as e:
        return {"error": str(e)}

@router.get("/dashboard-complete")
def get_complete_dashboard(
    userId: Optional[str] = Query(None, description="User ID (optional)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Optimized endpoint that returns all dashboard data in a single call
    Includes caching and combines multiple data sources
    """
    try:
        # If no userId passed, use the authenticated user's mobile
        effective_user_id = userId or (str(current_user.mobile) if current_user else None)
        if not effective_user_id:
            raise HTTPException(status_code=400, detail="Unable to resolve userId")
        # Fetch all dashboard data
        dashboard_data = fetch_all_dashboard_data(effective_user_id, db)
        return dashboard_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dashboard fetch failed: {str(e)}")

@router.get("/dashboard-data")
def get_dashboard_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get dashboard data for the current authenticated user
    This endpoint matches the frontend expectation
    """
    try:
        userId = str(current_user.mobile)
        dashboard_data = fetch_all_dashboard_data(userId, db)
        return dashboard_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dashboard fetch failed: {str(e)}")

def fetch_all_dashboard_data(userId: str, db: Session) -> Dict[str, Any]:
    """Fetch all dashboard data for maximum performance"""
    
    try:
        # Fetch all data with error handling
        user_info = fetch_user_info(userId, db)
        daily_streak = fetch_daily_goal(userId, db)
        leaderboard = fetch_leaderboard(db, userId)  # Pass userId for filtering
        current_course = fetch_current_course(userId, db)
        
        # Combine results
        return {
            "user_info": user_info,
            "daily_streak": daily_streak,
            "weekly_streak": [False, False, False, False, False, False, False],  # Placeholder
            "leaderboard": leaderboard,
            "recent_quiz_questions": {},  # Placeholder
            "current_course": current_course,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Error in fetch_all_dashboard_data: {e}")
        # Return fallback data on error
        return {
            "user_info": None,
            "daily_streak": {
                "streak": 0,
                "last_active_date": None,
                "goal_done": False,
                "videos_watched": 0,
                "quizzes_completed": 0,
                "daily_tasks_completed": False
            },
            "weekly_streak": [False, False, False, False, False, False, False],
            "leaderboard": [],
            "recent_quiz_questions": {},
            "current_course": None,
            "timestamp": datetime.now().isoformat(),
            "error": "Some data could not be loaded"
        }

def fetch_user_info(userId: str, db: Session):
    """Fetch user information"""
    try:
        user = db.query(User).filter(User.mobile == userId).first()
        if user:
            return {
                "name": user.name or "Student",
                "level": 1,  # Default level since we removed level calculation
                "xp_weekly": getattr(user, 'total_xp', 0),
                "xp_total": getattr(user, 'total_xp', 0)
            }
        return None
    except Exception as e:
        print(f"Error fetching user info: {e}")
        return None

def fetch_daily_goal(userId: str, db: Session):
    """Fetch daily goal information using the new streak system"""
    try:
        # Find user by mobile number first
        user = db.query(User).filter(User.mobile == userId).first()
        if not user:
            return {
                "streak": 0,
                "last_active_date": None,
                "goal_done": False,
                "videos_watched": 0,
                "quizzes_completed": 0,
                "daily_tasks_completed": False
            }
        
        # Use the new streak system to get current streak status (video-based)
        from app.services.streak_service import StreakService
        streak_status = StreakService.get_user_streak_status(db, user.id)

        # Quiz-based today's goal: count today's completed quizzes in StudyPlanTask
        today = date.today().strftime('%Y-%m-%d')
        quizzes_completed_today = db.query(StudyPlanTask).filter(
            StudyPlanTask.user_id == user.id,
            StudyPlanTask.date == today,
            StudyPlanTask.quiz_completed == True
        ).count()
        goal_done = quizzes_completed_today > 0
        
        return {
            "streak": streak_status.get('current_streak', 0),
            "last_active_date": streak_status.get('last_activity_date'),
            "goal_done": goal_done,
            "videos_watched": streak_status.get('videos_watched_today', 0),
            "quizzes_completed": int(quizzes_completed_today or 0),
            "daily_tasks_completed": goal_done  # Use streak completion as daily task completion
        }
    except Exception as e:
        print(f"Error fetching daily goal: {e}")
        return {
            "streak": 0,
            "last_active_date": None,
            "goal_done": False,
            "videos_watched": 0,
            "quizzes_completed": 0,
            "daily_tasks_completed": False
        }

def fetch_leaderboard(db: Session, userId: str = None):
    """Fetch leaderboard data filtered by user's year and semester"""
    try:
        print("🔍 Fetching leaderboard data...")
        
        # If userId is provided, filter by user's year and semester
        if userId:
            user = db.query(User).filter(User.mobile == userId).first()
            if user:
                user_year = user.year or 1
                user_semester = user.semester or 1
                print(f"🔍 Filtering leaderboard for user: {user.name} (Year: {user_year}, Semester: {user_semester})")
                
                # Filter by same year and semester as current user
                query = db.query(User).filter(
                    User.name != None,
                    User.name != "",
                    User.name != User.mobile,
                    User.year == user_year,
                    User.semester == user_semester
                )
                
                users = query.order_by(User.total_xp.desc()).limit(10).all()
                print(f"🔍 Found {len(users)} users in same year/semester")
                
                # Debug: Log each filtered user
                for u in users:
                    print(f"🔍 Filtered user: {u.name} (Year: {u.year}, Semester: {u.semester}, XP: {u.total_xp})")
                
                result = [
                    {
                        "name": u.name or "Anonymous",
                        "xp": u.total_xp or 0,
                        "level": 1,  # Default level since we removed level calculation
                    }
                    for u in users
                ]
                
                print(f"🔍 Returning {len(result)} filtered leaderboard entries")
                return result
            else:
                print(f"🔍 User not found for userId: {userId}")
        else:
            print(f"🔍 No userId provided for leaderboard filtering")
        
        # Fallback: if no userId or user not found, return global leaderboard
        print("🔍 No userId provided, returning global leaderboard...")
        query = db.query(User).filter(
            User.name != None,
            User.name != "",
            User.name != User.mobile
        )
        
        users = query.order_by(User.total_xp.desc()).limit(10).all()
        print(f"🔍 Found {len(users)} users in global leaderboard")
        
        result = [
            {
                "name": user.name or "Anonymous",
                "xp": user.total_xp or 0,
                "level": 1,  # Default level since we removed level calculation
            }
            for user in users
        ]
        
        print(f"🔍 Returning {len(result)} global leaderboard entries")
        return result
        
    except Exception as e:
        print(f"❌ Error fetching leaderboard: {e}")
        import traceback
        traceback.print_exc()
        # Return empty leaderboard on error
        return []

def fetch_current_course(userId: str, db: Session):
    """Fetch current course information"""
    try:
        user = db.query(User).filter(User.mobile == userId).first()
        if user:
            return {
                "course_title": f"Year {user.year or 1} Semester {user.semester or 1}",
                "course_path": f"Year {user.year or 1} / Semester {user.semester or 1}",
                "progress_percentage": 0,
                "last_lesson": "Introduction",
                "status": "In Progress",
                "year": user.year or 1,
                "semester": user.semester or 1
            }
        return None
    except Exception as e:
        print(f"Error fetching current course: {e}")
        return None

# Keep existing endpoints for backward compatibility
@router.get("/dashboard-summary")
def get_dashboard_summary(
    userId: str = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Legacy endpoint - now redirects to optimized version"""
    return get_complete_dashboard(userId, db)

@router.post("/refresh-streak")
def refresh_streak_data(
    userId: str = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Manually refresh streak data for a user"""
    try:
        # Find user by mobile number first; if not found, try numeric user ID
        user = db.query(User).filter(User.mobile == userId).first()
        if not user:
            try:
                numeric_id = int(userId)
                user = db.query(User).filter(User.id == numeric_id).first()
            except Exception:
                user = None
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Return latest streak status from streak system (no daily-goals writes)
        from app.services.streak_service import StreakService
        streak_status = StreakService.get_user_streak_status(db, user.id)
        return {
            "success": True,
            "message": "Streak status refreshed",
            "current_streak": streak_status.get("current_streak", 0),
            "longest_streak": streak_status.get("longest_streak", 0),
            "last_activity_date": streak_status.get("last_activity_date"),
            "videos_watched_today": streak_status.get("videos_watched_today", 0)
        }
        
    except HTTPException as he:
        # Propagate HTTPExceptions like 404 as-is
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh streak: {str(e)}")

# Alias to support existing frontend path /api/dashboard/refresh-streak
@router.post("/dashboard/refresh-streak")
def refresh_streak_data_alias(
    userId: str = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    return refresh_streak_data(userId=userId, db=db)

