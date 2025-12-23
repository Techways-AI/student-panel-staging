from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from app.db.session import get_db
from app.models.user import User
from app.models.quiz import Quiz
from app.models.subject_progress import SubjectProgress
from app.models.curriculum import UniversityCurriculum
from app.api.auth import get_current_user
from app.utils.subject_utils import clean_subject_name
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

# Create router with authentication dependency
router = APIRouter(
    dependencies=[Depends(get_current_user)]  # 🔐 PROTECTS ALL ROUTES
)

@router.get('/current-course')
def get_current_course(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get current course information for the user including:
    - Current subject being studied
    - Progress percentage
    - Last lesson/topic
    - Course path (Year/Semester/Subject/Unit/Topic)
    """
    try:
        # Get user's current year and semester
        user_year = current_user.year or 1
        user_semester = current_user.semester or 1
        
        # Get the most recent quiz to determine current subject/topic
        latest_quiz = db.query(Quiz).filter(
            Quiz.student_id == current_user.id
        ).order_by(desc(Quiz.created_at)).first()
        
        if not latest_quiz:
            # If no quizzes taken, return default course info
            return {
                "course_title": "B.Pharmacy Fundamentals",
                "course_path": f"Year {user_year} / Semester {user_semester} / Pharmacy / Introduction",
                "progress_percentage": 0,
                "last_lesson": "Introduction to Pharmacy",
                "status": "Not Started",
                "year": user_year,
                "semester": user_semester,
                "subject": "Pharmacy",
                "unit": "Introduction",
                "topic": "Introduction to Pharmacy",
                "subscription_status": current_user.subscription_status or "free"
            }
        
        # Get current subject and topic from latest quiz
        current_subject = latest_quiz.subject
        current_unit = latest_quiz.unit
        current_topic = latest_quiz.topic
        
        # Single optimized query to get all unique topics for this subject
        completed_topics_list = db.query(Quiz.topic).filter(
            Quiz.student_id == current_user.id,
            Quiz.subject == current_subject
        ).distinct().all()
        
        completed_topics_count = len(completed_topics_list)
        
        # Estimate total topics based on typical course structure
        # Most pharmacy subjects have between 15-25 topics
        if completed_topics_count == 0:
            total_possible_topics = 20  # Default for new subjects
        elif completed_topics_count <= 3:
            total_possible_topics = 20
        elif completed_topics_count <= 8:
            total_possible_topics = 25
        else:
            total_possible_topics = 30
        
        progress_percentage = min(int((completed_topics_count / total_possible_topics) * 100), 100)
        
        # Get course path
        course_path = f"Year {user_year} / Semester {user_semester} / {current_subject} / {current_topic}"
        
        # Determine status based on progress
        if progress_percentage == 0:
            status = "Not Started"
        elif progress_percentage < 25:
            status = "Getting Started"
        elif progress_percentage < 50:
            status = "In Progress"
        elif progress_percentage < 75:
            status = "Halfway There"
        elif progress_percentage < 100:
            status = "Almost Done"
        else:
            status = "Completed"
        
        return {
            "course_title": f"{current_subject} Fundamentals",
            "course_path": course_path,
            "progress_percentage": progress_percentage,
            "last_lesson": current_topic,
            "status": status,
            "year": user_year,
            "semester": user_semester,
            "subject": current_subject,
            "unit": current_unit,
            "topic": current_topic,
            "completed_topics": completed_topics_count,
            "total_possible_topics": total_possible_topics,
            "subscription_status": current_user.subscription_status or "free"
        }
        
    except Exception as e:
        logger.error(f"Error getting current course data: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get current course data")

@router.get('/course-progress/{subject}')
def get_course_progress(
    subject: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed progress for a specific subject
    """
    try:
        # Clean the subject name to match how it's stored in the database
        cleaned_subject = clean_subject_name(subject)
        
        # Get all quizzes for this subject
        quizzes = db.query(Quiz).filter(
            Quiz.student_id == current_user.id,
            Quiz.subject == cleaned_subject
        ).all()
        
        if not quizzes:
            return {
                "subject": subject,
                "progress_percentage": 0,
                "completed_topics": 0,
                "total_topics": 0,
                "units": [],
                "last_activity": None
            }
        
        # Group by unit and topic
        units = {}
        for quiz in quizzes:
            if quiz.unit not in units:
                units[quiz.unit] = []
            if quiz.topic not in units[quiz.unit]:
                units[quiz.unit].append(quiz.topic)
        
        # Calculate progress using the same approach as current course
        # Get the actual course structure for this subject from S3
        course_name = 'bpharmacy'
        year_semester = f"{current_user.year or 1}-{current_user.semester or 1}"
        
        try:
            from app.api.subject_content import get_subject_content_dynamic
            
            subject_content = get_subject_content_dynamic(course_name, year_semester, subject)
            
            # Calculate progress based on topic completion
            total_possible_topics = 0
            completed_topics_count = 0
            
            for unit in subject_content:
                for topic in unit.get('topics', []):
                    total_possible_topics += 1
                    topic_name = topic.get('topicName', '')
                    
                    # Check if this topic has been completed (quiz taken)
                    topic_completed = db.query(Quiz).filter(
                        Quiz.student_id == current_user.id,
                        Quiz.subject == subject,
                        Quiz.topic == topic_name
                    ).first()
                    
                    if topic_completed:
                        completed_topics_count += 1
            
            # If we couldn't get the structure from S3, use a more accurate fallback
            if total_possible_topics == 0:
                # Get completed topics from existing quiz records
                completed_topics_list = db.query(Quiz.topic).filter(
                    Quiz.student_id == current_user.id,
                    Quiz.subject == subject
                ).distinct().all()
                
                completed_topics_count = len(completed_topics_list)
                
                # Use the same conservative estimation as in current course endpoint
                if completed_topics_count == 0:
                    total_possible_topics = 20
                elif completed_topics_count <= 3:
                    total_possible_topics = 20
                elif completed_topics_count <= 8:
                    total_possible_topics = 25
                else:
                    total_possible_topics = 30
                
        except Exception as e:
            logger.warning(f"Could not fetch course structure for {subject}: {str(e)}")
            # Improved fallback: estimate based on completed topics
            completed_topics_list = db.query(Quiz.topic).filter(
                Quiz.student_id == current_user.id,
                Quiz.subject == subject
            ).distinct().all()
            
            completed_topics_count = len(completed_topics_list)
            
            # Use the same conservative estimation
            if completed_topics_count == 0:
                total_possible_topics = 20
            elif completed_topics_count <= 3:
                total_possible_topics = 20
            elif completed_topics_count <= 8:
                total_possible_topics = 25
            else:
                total_possible_topics = 30
        
        progress_percentage = min(int((completed_topics_count / total_possible_topics) * 100), 100)
        
        # Get last activity
        latest_quiz = max(quizzes, key=lambda q: q.created_at)
        
        return {
            "subject": subject,
            "progress_percentage": progress_percentage,
            "completed_topics": completed_topics_count,
            "total_topics": total_possible_topics,
            "units": [
                {
                    "unit_name": unit,
                    "completed_topics": len(topics),
                    "topics": topics
                }
                for unit, topics in units.items()
            ],
            "last_activity": latest_quiz.created_at.isoformat() if latest_quiz.created_at else None
        }
        
    except Exception as e:
        logger.error(f"Error getting course progress for {subject}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get course progress")

@router.get('/learning-summary')
def get_learning_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get overall learning summary including:
    - Total quizzes completed
    - Average score
    - Current streak
    - XP earned
    
    Optimized with XP caching for improved performance.
    """
    try:
        # Get XP data from database
        total_xp = current_user.total_xp or 0
        weekly_xp = current_user.total_xp or 0
        
        # Get total quizzes completed (optimized query)
        total_quizzes = db.query(Quiz).filter(
            Quiz.student_id == current_user.id
        ).count()
        
        # Get average score (optimized query)
        avg_score = db.query(func.avg(Quiz.score)).filter(
            Quiz.student_id == current_user.id
        ).scalar() or 0
        
        # Get current streak from daily goals
        today_goal = db.query(DailyGoal).filter(
            DailyGoal.user_id == current_user.id,
            DailyGoal.date == func.current_date()
        ).first()
        
        current_streak = today_goal.streak if today_goal else 0
        level = 1  # Default level since we removed level calculation
        
        return {
            "total_quizzes_completed": total_quizzes,
            "average_score": round(float(avg_score), 1),
            "current_streak": current_streak,
            "total_xp": total_xp,
            "weekly_xp": weekly_xp,
            "level": level,
            "year": current_user.year or 1,
            "semester": current_user.semester or 1
        }
        
    except Exception as e:
        logger.error(f"Error getting learning summary: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get learning summary") 

@router.get('/semester-xp/{year}/{semester}')
def get_semester_xp(
    year: int,
    semester: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get XP earned for a specific semester based on actual quiz completions
    """
    try:
        university = current_user.university or "PCI"
        
        # 1️⃣ Fetch all active curriculum records for this university
        curricula = (
            db.query(UniversityCurriculum)
            .filter(
                UniversityCurriculum.university == university,
                UniversityCurriculum.status == "active"
            )
            .all()
        )
        
        # 2️⃣ Calculate total topics for the specified year/semester from DB
        total_topics = 0
        for curriculum in curricula:
            data = curriculum.curriculum_data or {}
            for y_data in data.get('years', []):
                if y_data.get('year') == year:
                    for sem_data in y_data.get('semesters', []):
                        # Use parity matching for semesters (odd=1, even=2)
                        db_sem = sem_data.get('semester')
                        if (db_sem == semester) or (((db_sem - 1) % 2) + 1 == semester):
                            for sub in sem_data.get('subjects', []):
                                # Units and topics are nested in sub['units']
                                for unit in sub.get('units', []):
                                    total_topics += len(unit.get('topics', []))
        
        # Fallback if no topics found
        if total_topics == 0:
            total_topics = 30 # Default estimate
            
        # 3️⃣ Get all quizzes for this user in the specified year/semester
        quizzes = db.query(Quiz).filter(
            Quiz.student_id == current_user.id,
            Quiz.year == year,
            Quiz.semester == semester
        ).all()
        
        # Calculate earned XP
        earned_xp = sum(
            quiz.xp_topic for quiz in quizzes 
            if quiz.xp_topic and quiz.xp_topic > 0 and quiz.topic != "Pre-Assessment"
        )
        
        # Each topic is worth 20 XP (10 video + 5 notes + 5 quiz max score)
        estimated_total_xp = total_topics * 20
        
        # Calculate progress percentage
        progress_percentage = min(int((earned_xp / estimated_total_xp) * 100), 100) if estimated_total_xp > 0 else 0
        
        return {
            "year": year,
            "semester": semester,
            "earned_xp": earned_xp,
            "estimated_total_xp": estimated_total_xp,
            "progress_percentage": progress_percentage
        }
        
    except Exception as e:
        logger.error(f"Error getting semester XP: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get semester XP")

def _persist_subject_progress(
    db: Session,
    *,
    user_id: int,
    subject: str,
    year: int,
    semester: int,
    completed_topics: int,
    total_topics: int,
    progress_percentage: int
) -> bool:
    """Insert or update the subject progress cache for a user.

    Returns True when a database change was made (insert or progress increase)."""

    record = (
        db.query(SubjectProgress)
        .filter(
            SubjectProgress.user_id == user_id,
            SubjectProgress.subject == subject,
            SubjectProgress.year == year,
            SubjectProgress.semester == semester,
        )
        .first()
    )

    if record:
        if progress_percentage > (record.progress_percentage or 0):
            record.progress_percentage = progress_percentage
            record.completed_topics = max(record.completed_topics or 0, completed_topics)
            record.total_topics = max(record.total_topics or 0, total_topics)
            return True
        return False

    db.add(
        SubjectProgress(
            user_id=user_id,
            subject=subject,
            year=year,
            semester=semester,
            completed_topics=completed_topics,
            total_topics=total_topics,
            progress_percentage=progress_percentage,
        )
    )
    return True


@router.get('/all-subjects-progress')
def get_all_subjects_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get progress for subjects in user's current year and semester
    Returns subjects with their progress status for filtering
    """
    try:
        user_year = current_user.year or 1
        user_semester = current_user.semester or 1
        university = current_user.university or "PCI"
        
        # 1️⃣ Fetch all active curriculum records for this university
        curricula = (
            db.query(UniversityCurriculum)
            .filter(
                UniversityCurriculum.university == university,
                UniversityCurriculum.status == "active"
            )
            .all()
        )
        
        # 2️⃣ Extract subject names for user's current year and semester
        subjects_list = []
        for curriculum in curricula:
            data = curriculum.curriculum_data or {}
            for y_data in data.get('years', []):
                if y_data.get('year') == user_year:
                    for sem_data in y_data.get('semesters', []):
                        # Use parity matching for semesters (odd=1, even=2)
                        db_sem = sem_data.get('semester')
                        if (db_sem == user_semester) or (((db_sem - 1) % 2) + 1 == user_semester):
                            for sub in sem_data.get('subjects', []):
                                code = sub.get('code')
                                name = sub.get('name')
                                title = f"{code}: {name}" if code else name
                                if title not in subjects_list:
                                    subjects_list.append(title)
        
        # Fallback to hardcoded list if no subjects found in DB (unlikely)
        if not subjects_list:
            current_subjects = {
                1: {
                    1: [
                        'PS101: Human Anatomy and Physiology I', 'PS102: Pharmaceutical Analysis I', 
                        'PS103: Pharmaceutics', 'PS104: Pharmaceutical Inorganic Chemistry',
                        'HS105: Communication skills', 'BS106: Remedial Biology', 'BS107: Remedial Mathematics'
                    ],
                    2: [
                        'PS201: Human Anatomy and Physiology II', 'PS202: Pharmaceutical Organic Chemistry-I',
                        'BS203: Biochemistry', 'BS204: Pathophysiology', 'CS205: Computer Applications in Pharmacy',
                        'MC200: NSS (Non-Credit Mandatory Course)'
                    ]
                }
            }
            subjects_list = current_subjects.get(user_year, {}).get(user_semester, [])

        # OPTIMIZATION: Fetch all relevant quizzes for the user in ONE query instead of N queries
        # This significantly speeds up the dashboard when there are many subjects/rows
        all_user_quizzes = db.query(Quiz).filter(
            Quiz.student_id == current_user.id
        ).all()
        
        # Group by subject for fast lookup in the loop below
        quizzes_by_subject = {}
        for quiz in all_user_quizzes:
            cleaned_sub = clean_subject_name(quiz.subject)
            if cleaned_sub not in quizzes_by_subject:
                quizzes_by_subject[cleaned_sub] = []
            quizzes_by_subject[cleaned_sub].append(quiz)

        subjects_with_progress = []
        progress_records_changed = False

        for subject in subjects_list:
            try:
                # Clean the subject name to match how it's stored in the database
                cleaned_subject = clean_subject_name(subject)
                
                # Get user's quiz records from pre-fetched map (Very fast!)
                user_quizzes = quizzes_by_subject.get(cleaned_subject, [])
                
                # Calculate progress based on quiz completions
                completed_topics_count = len(user_quizzes)
                
                # Filter out pre-assessment quizzes for progress calculation
                learning_quizzes = [quiz for quiz in user_quizzes 
                                  if not (quiz.topic.lower().startswith('pre') or 'assessment' in quiz.topic.lower())]
                learning_topics_count = len(learning_quizzes)
                
                # Get the actual course structure to determine total available topics
                course_name = 'bpharmacy'
                year_semester = f"{user_year}-{user_semester}"
                total_available_topics = 0
                
                try:
                    # Look up in pre-fetched curricula first
                    found = False
                    for curriculum in curricula:
                        data = curriculum.curriculum_data or {}
                        for y_data in data.get('years', []):
                            if y_data.get('year') == user_year:
                                for sem_data in y_data.get('semesters', []):
                                    if sem_data.get('semester') == user_semester:
                                        for sub in sem_data.get('subjects', []):
                                            sub_code = sub.get('code')
                                            sub_name = sub.get('name')
                                            sub_title = f"{sub_code}: {sub_name}" if sub_code else sub_name
                                            if clean_subject_name(sub_title) == cleaned_subject:
                                                total_available_topics = sum(len(u.get('topics', [])) for u in sub.get('units', []))
                                                found = True
                                                break
                                if found: break
                        if found: break
                    
                    if not found:
                        from app.api.subject_content import get_subject_content_dynamic
                        subject_content = get_subject_content_dynamic(course_name, year_semester, subject)
                        if subject_content:
                            for unit in subject_content:
                                total_available_topics += len(unit.get('topics', []))
                except Exception as e:
                    logger.warning(f"Could not fetch course structure for {subject}: {str(e)}")
                    total_available_topics = 10
                
                # Calculate progress logic
                if total_available_topics > 0:
                    if learning_topics_count >= total_available_topics:
                        progress_percentage = 100
                        status = "Completed"
                        action = "Review"
                    elif learning_topics_count >= 3 and learning_topics_count >= (total_available_topics * 0.8):
                        progress_percentage = 100
                        status = "Completed"
                        action = "Review"
                    elif learning_topics_count >= 2:
                        progress_percentage = min(80, int((learning_topics_count / total_available_topics) * 100))
                        status = "Almost Done"
                        action = "Continue"
                    elif learning_topics_count >= 1:
                        progress_percentage = min(60, int((learning_topics_count / total_available_topics) * 100))
                        status = "In Progress"
                        action = "Continue"
                    else:
                        if completed_topics_count > 0:
                            progress_percentage = 20
                            status = "Getting Started"
                            action = "Continue"
                        else:
                            progress_percentage = 0
                            status = "Not Started"
                            action = "Start"
                else:
                    if learning_topics_count >= 3:
                        progress_percentage = 100
                        status = "Completed"
                        action = "Review"
                    elif learning_topics_count >= 2:
                        progress_percentage = 80
                        status = "Almost Done"
                        action = "Continue"
                    elif learning_topics_count >= 1:
                        progress_percentage = 60
                        status = "In Progress"
                        action = "Continue"
                    else:
                        if completed_topics_count > 0:
                            progress_percentage = 20
                            status = "Getting Started"
                            action = "Continue"
                        else:
                            progress_percentage = 0
                            status = "Not Started"
                            action = "Start"
                
                subjects_with_progress.append({
                    "title": subject,
                    "status": status,
                    "progress": progress_percentage,
                    "action": action,
                    "year": user_year,
                    "semester": user_semester,
                    "units": 5,
                    "completed_topics": learning_topics_count,
                    "total_topics": total_available_topics
                })

                try:
                    updated = _persist_subject_progress(
                        db,
                        user_id=current_user.id,
                        subject=subject,
                        year=user_year,
                        semester=user_semester,
                        completed_topics=learning_topics_count,
                        total_topics=total_available_topics,
                        progress_percentage=progress_percentage,
                    )
                    progress_records_changed = progress_records_changed or updated
                except Exception as persistence_error:
                    logger.warning("Failed to persist subject progress: %s", persistence_error)
                
            except Exception as e:
                logger.error(f"Error processing subject {subject}: {str(e)}")
                subjects_with_progress.append({
                    "title": subject,
                    "status": "Not Started",
                    "progress": 0,
                    "action": "Start",
                    "year": user_year,
                    "semester": user_semester,
                    "units": 5,
                    "completed_topics": 0,
                    "total_topics": 0
                })
        
        if progress_records_changed:
            try:
                db.commit()
            except Exception:
                db.rollback()

        return {
            "subjects": subjects_with_progress,
            "year": user_year,
            "semester": user_semester
        }
        
    except Exception as e:
        logger.error(f"Error getting subjects progress: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get subjects progress")

