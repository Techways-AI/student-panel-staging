from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.user import User
from app.api.auth import get_current_user  # Import the dependency

# Create router with authentication dependency
router = APIRouter(
    dependencies=[Depends(get_current_user)]  # 🔐 PROTECTS ALL ROUTES
)

@router.get("/test")
def test_leaderboard():
    """Test endpoint to verify the leaderboard API is working"""
    return {"message": "Leaderboard API is working", "status": "success"}

def valid_leaderboard_users(query):
    return query.filter(User.name != None).filter(User.name != "").filter(User.name != User.mobile)

@router.get("/leaderboard")
def get_leaderboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Leaderboard endpoint - returns users from the same year and semester as the current user"""
    # Handle case where user year/semester might be null
    user_year = current_user.year or 1
    user_semester = current_user.semester or 1
    
    query = valid_leaderboard_users(db.query(User))
    query = query.filter(User.year == user_year, User.semester == user_semester)
    users = query.order_by(User.total_xp.desc()).limit(10).all()
    return {
        "leaderboard": [
            {
                "id": u.id, 
                "name": u.name, 
                "xp": u.total_xp or 0, 
                "level": 1,  # Default level since we removed level calculation
            } for u in users
        ]
    }

@router.get("/leaderboard/weekly")
def get_weekly_leaderboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Weekly leaderboard - returns users from the same year and semester as the current user"""
    # Handle case where user year/semester might be null
    user_year = current_user.year or 1
    user_semester = current_user.semester or 1
    
    query = valid_leaderboard_users(db.query(User))
    query = query.filter(User.year == user_year, User.semester == user_semester)
    users = query.order_by(User.total_xp.desc()).limit(10).all()
    return {
        "leaderboard": [
            {
                "id": u.id, 
                "name": u.name, 
                "xp": u.total_xp or 0, 
                "level": 1,  # Default level since we removed level calculation
            } for u in users
        ]
    }

@router.get("/leaderboard/alltime")
def get_alltime_leaderboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """All-time leaderboard - returns users from the same year and semester as the current user"""
    # Handle case where user year/semester might be null
    user_year = current_user.year or 1
    user_semester = current_user.semester or 1
    
    query = valid_leaderboard_users(db.query(User))
    query = query.filter(User.year == user_year, User.semester == user_semester)
    users = query.order_by(User.total_xp.desc()).limit(10).all()
    return {
        "leaderboard": [
            {
                "id": u.id, 
                "name": u.name, 
                "xp": u.total_xp or 0, 
                "level": 1,  # Default level since we removed level calculation
            } for u in users
        ]
    }

@router.get("/user-rank")
def get_user_rank(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's rank in their class (same year and semester)"""
    try:
        # Handle case where user year/semester might be null
        user_year = current_user.year or 1
        user_semester = current_user.semester or 1
        
        # Get all users in the same year and semester, ordered by weekly XP
        query = valid_leaderboard_users(db.query(User))
        query = query.filter(User.year == user_year, User.semester == user_semester)
        users = query.order_by(User.total_xp.desc()).all()
        
        # Find current user's rank
        user_rank = None
        total_students = len(users)
        
        for index, user in enumerate(users):
            if user.id == current_user.id:
                user_rank = index + 1
                break
        
        # If user not found in leaderboard, they might not have any XP yet
        if user_rank is None:
            user_rank = total_students + 1  # Rank below all other students
        
        return {
            "user_rank": user_rank,
            "total_students": total_students,
            "user_xp": current_user.total_xp or 0,
            "user_level": 1,  # Default level since we removed level calculation
            "year": user_year,
            "semester": user_semester
        }
        
    except Exception as e:
        print(f"❌ Error getting user rank: {e}")
        return {
            "user_rank": None,
            "total_students": 0,
            "user_xp": 0,
            "user_level": 1,
            "year": 1,
            "semester": 1,
            "error": str(e)
        }

@router.get("/topper-percentages")
def get_topper_percentages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get topper's performance metrics - topper is the #1 student in leaderboard (highest XP)"""
    try:
        from app.models.quiz import Quiz
        from app.models.study_plan import StudyPlanTask, StudyPlanStats
        
        # Handle case where user year/semester might be null
        user_year = current_user.year or 1
        user_semester = current_user.semester or 1
        
        # Determine leaderboard topper (highest XP in same cohort)
        leaderboard_topper = (
            valid_leaderboard_users(db.query(User))
            .filter(User.year == user_year, User.semester == user_semester)
            .order_by(User.total_xp.desc())
            .first()
        )

        # Compute Quiz Performance topper as leaderboard topper's average across ALL quizzes (all-time)
        quiz_performance_topper = 0
        topper_name = None
        topper_xp = 0

        if leaderboard_topper:
            topper_avg_row = (
                db.query(func.avg(Quiz.score).label("avg_score"))
                .filter(Quiz.student_id == leaderboard_topper.id)
                .first()
            )
            if topper_avg_row and topper_avg_row[0] is not None:
                topper_avg = float(topper_avg_row[0])
                quiz_performance_topper = min(100, int((topper_avg / 5.0) * 100))
                topper_name = leaderboard_topper.name
                topper_xp = leaderboard_topper.total_xp or 0
        
        # Fallback: if leaderboard topper has no quiz records, use current user's own average
        if quiz_performance_topper == 0:
            self_avg_row = (
                db.query(func.avg(Quiz.score).label("avg_score"))
                .filter(Quiz.student_id == current_user.id)
                .first()
            )
            if self_avg_row and self_avg_row[0] is not None:
                self_avg = float(self_avg_row[0])
                quiz_performance_topper = min(100, int((self_avg / 5.0) * 100))
                topper_name = current_user.name
                topper_xp = current_user.total_xp or 0
        
        # Get topper's study hours using the same leaderboard topper
        topper_stats = None
        if leaderboard_topper:
            topper_stats = db.query(StudyPlanStats).filter(
                StudyPlanStats.user_id == leaderboard_topper.id
            ).first()
        
        if topper_stats and topper_stats.hours_this_week:
            try:
                study_hours_topper = int(topper_stats.hours_this_week.replace('h', ''))
            except:
                study_hours_topper = 0
        else:
            study_hours_topper = 0
        
        
        # Get topper's participation rate
        topper_total_tasks = db.query(StudyPlanTask).filter(
            StudyPlanTask.user_id == (leaderboard_topper.id if leaderboard_topper else None),
            StudyPlanTask.date >= "2024-01-01"
        ).count()
        
        topper_completed_tasks = db.query(StudyPlanTask).filter(
            StudyPlanTask.user_id == (leaderboard_topper.id if leaderboard_topper else None),
            StudyPlanTask.completed == True,
            StudyPlanTask.date >= "2024-01-01"
        ).count()
        
        if topper_total_tasks > 0:
            participation_topper = int((topper_completed_tasks / topper_total_tasks) * 100)
        else:
            participation_topper = 0
        
        # Get total students count for context
        total_students = db.query(User).filter(
            User.year == user_year,
            User.semester == user_semester
        ).count()
        
        return {
            "study_hours_topper": study_hours_topper,
            "quiz_performance_topper": quiz_performance_topper,
            "participation_topper": participation_topper,
            "year": user_year,
            "semester": user_semester,
            "total_students": total_students,
            "topper_name": topper_name,
            "topper_xp": topper_xp,
            "data_source": "cohort_best_avg_quiz"
        }
        
    except Exception as e:
        print(f"❌ Error getting topper percentages: {e}")
        return {
            "study_hours_topper": 0,
            "quiz_performance_topper": 0,
            "participation_topper": 0,
            "year": 1,
            "semester": 1,
            "total_students": 0,
            "topper_name": None,
            "topper_xp": 0,
            "error": str(e)
        } 





