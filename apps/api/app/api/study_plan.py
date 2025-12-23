from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, date
import logging

from app.db.session import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.study_plan import StudyPlan, StudyPlanTask, StudyPlanStats
from app.models.user_activity import UserActivity
from app.schemas.study_plan import (
    GenerateStudyPlanRequest, GenerateStudyPlanResponse, 
    TaskToggleRequest, TaskToggleResponse,
    StudyPlanStatsResponse, StudyPlanListResponse,
    TasksForDateRequest, TasksForDateResponse,
    WeeklyProgressResponse, StudyPlanTaskUpdate,
    BulkTaskUpdateRequest, BulkTaskUpdateResponse,
    DailyPlan, StudyPlanTask as StudyPlanTaskSchema
)
from app.models.quiz import Quiz
from app.services.analytics.posthog_client import capture_event, is_enabled

try:
    from app.utils.question_bank import get_available_subjects
except Exception:
    def get_available_subjects(year: int, semester: int) -> List[str]:
        return [
            "Anatomy", "Physiology", "Biochemistry", 
            "Pathology", "Pharmacology", "Microbiology",
            "Surgery", "Medicine", "Pediatrics", "Obstetrics"
        ]

def get_subjects_with_content(year: int, semester: int) -> List[dict]:
    """
    Get subjects that actually have content available in S3.
    Returns list of subjects with their topics (including names).
    """
    try:
        import boto3
        import os
        from dotenv import load_dotenv
        
        load_dotenv()
        
        # S3 configuration
        BUCKET = os.getenv('S3_BUCKET')
        AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
        AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
        AWS_REGION = os.getenv('AWS_REGION')
        
        if not all([BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION]):
            logger.warning("S3 credentials not available, falling back to question bank")
            return get_fallback_subjects(year, semester)
        
        s3 = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION,
            config=boto3.session.Config(
                connect_timeout=10,
                read_timeout=30,
                retries={'max_attempts': 2}
            )
        )
        
        # Convert year/semester to the format used in S3
        year_semester = f"{year}-{semester}"
        course_name = "bpharmacy"  # Assuming this is the course name
        
        # List all subjects for this year/semester
        prefix = f'{course_name}/{year_semester}/'
        
        try:
            subjects_resp = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix, Delimiter='/')
            subject_folders = subjects_resp.get('CommonPrefixes', [])
            
            subjects_with_content = []
            
            for subject_folder in subject_folders:
                subject_name = subject_folder['Prefix'].split('/')[-2]
                subject_prefix = subject_folder['Prefix']
                
                # Get topics with names for this subject
                topics = get_topics_for_subject(s3, BUCKET, subject_prefix)
                
                if topics:
                    subjects_with_content.append({
                        'name': subject_name,
                        'topics': topics,
                        'topic_count': len(topics)
                    })
            
            # Only log summary, not individual subjects
            if len(subjects_with_content) > 0:
                logger.info(f"Found {len(subjects_with_content)} subjects with content for Year {year} Semester {semester}")
            return subjects_with_content
            
        except Exception as e:
            logger.error(f"Error listing subjects from S3: {e}")
            return get_fallback_subjects(year, semester)
            
    except Exception as e:
        logger.error(f"Error setting up S3 client: {e}")
        return get_fallback_subjects(year, semester)

def get_topics_for_subject(s3_client, bucket: str, subject_prefix: str) -> List[dict]:
    """
    Get all topics with their names for a specific subject.
    Ensures units and topics follow the subject's inherent order using natural sorting (e.g., Unit 2 comes before Unit 10).
    """
    try:
        import re

        def _natural_key(s: str):
            # Split into numeric and non-numeric parts to sort by actual numbers
            return [int(text) if text.isdigit() else text.lower() for text in re.findall(r'\d+|\D+', s)]

        # List all units in the subject
        units_resp = s3_client.list_objects_v2(Bucket=bucket, Prefix=subject_prefix, Delimiter='/')
        units = units_resp.get('CommonPrefixes', [])

        # Sort units by natural order (handles names like "Unit 1", "Unit 2", ... "Unit 10")
        units = sorted(units, key=lambda u: _natural_key(u['Prefix']))

        all_topics = []

        for unit in units:
            unit_name = unit['Prefix'].split('/')[-2]
            unit_prefix = unit['Prefix']

            # List all topics in the unit
            topics_resp = s3_client.list_objects_v2(Bucket=bucket, Prefix=unit_prefix, Delimiter='/')
            topics = topics_resp.get('CommonPrefixes', [])

            # Sort topics by natural order (handles names like "Topic 1", "Topic 2", ...)
            topics = sorted(topics, key=lambda t: _natural_key(t['Prefix']))

            for topic in topics:
                topic_name = topic['Prefix'].split('/')[-2]
                all_topics.append({
                    'name': topic_name,
                    'unit': unit_name,
                    'full_path': topic['Prefix']
                })

        return all_topics

    except Exception as e:
        logger.error(f"Error getting topics for subject: {e}")
        return []

def get_fallback_subjects(year: int, semester: int) -> List[dict]:
    """
    Fallback to question bank subjects if S3 is not available.
    """
    try:
        subjects = get_available_subjects(year, semester)
        fallback_subjects = []
        
        for subject in subjects:
            # Create generic topic names for fallback
            topics = []
            for i in range(10):  # Default 10 topics per subject
                topics.append({
                    'name': f'Topic {i+1}',
                    'unit': f'Unit {((i) // 3) + 1}',  # 3 topics per unit
                    'full_path': f'fallback/{subject}/unit{((i) // 3) + 1}/topic{i+1}/'
                })
            
            fallback_subjects.append({
                'name': subject,
                'topics': topics,
                'topic_count': len(topics)
            })
        
        return fallback_subjects
    except Exception:
        # Ultimate fallback
        return [{
            'name': f'Subject {i+1}', 
            'topics': [{'name': f'Topic {j+1}', 'unit': f'Unit {j//3 + 1}', 'full_path': f'fallback/subject{i+1}/unit{j//3 + 1}/topic{j+1}/'} for j in range(10)],
            'topic_count': 10
        } for i in range(6)]

def get_total_topics_for_year_semester(year: int, semester: int) -> int:
    """
    Get total number of topics across all subjects for a given year and semester.
    """
    subjects_with_content = get_subjects_with_content(year, semester)
    total_topics = sum(subject['topic_count'] for subject in subjects_with_content)
    return total_topics

def distribute_topics_fairly_across_subjects(subjects_with_content: List[dict], effective_days_remaining: int) -> tuple:
    """
    Distribute topics using sequential subject grouping to complete one subject entirely 
    before moving to the next, then distribute ALL topics across available days without dropping any.
    
    Args:
        subjects_with_content: List of subjects with their topics
        effective_days_remaining: Number of days available for study
        
    Returns:
        Tuple of (all_topics_list, daily_topics_distribution)
    """
    if not subjects_with_content:
        return [], []
    
    # Sequential subject grouping: finish Subject A completely, then Subject B, etc.
    all_topics = []
    
    # Process subjects one by one in order
    for subject_info in subjects_with_content:
        subject_name = subject_info['name']
        topics = subject_info['topics']
        
        # Add ALL topics from this subject before moving to next subject
        for topic_index, topic in enumerate(topics):
            all_topics.append({
                'subject': subject_name,
                'topic_name': topic['name'],
                'unit': topic['unit'],
                'topic_index': topic_index + 1,
                'total_topics': len(topics),
                'full_path': topic.get('full_path', f'{subject_name}/{topic["name"]}')
            })
    
    # Distribute ALL topics across available days using chunking (maintains subject grouping!)
    daily_topics = []
    
    if effective_days_remaining > 0:
        # Calculate topics per day with fair distribution
        total_topics_count = len(all_topics)
        base_topics_per_day = total_topics_count // effective_days_remaining
        extra_topics = total_topics_count % effective_days_remaining
        
        start_idx = 0
        for day in range(effective_days_remaining):
            # Distribute extra topics to first few days
            topics_for_this_day = base_topics_per_day + (1 if day < extra_topics else 0)
            end_idx = start_idx + topics_for_this_day
            
            # Slice the sequential topics for this day
            daily_topics.append(all_topics[start_idx:end_idx])
            start_idx = end_idx
    else:
        daily_topics = [[] for _ in range(effective_days_remaining)]
    
    logger.info(f"Sequential distribution: {len(all_topics)} topics from {len(subjects_with_content)} subjects")
    logger.info(f"Subject order: {[subject['name'] for subject in subjects_with_content]}")
    logger.info(f"Daily distribution: {[len(day_topics) for day_topics in daily_topics]} topics per day")
    
    return all_topics, daily_topics

def distribute_topics_across_days(total_topics: int, days_remaining: int) -> List[int]:
    """
    Distribute topics evenly across available days.
    Returns a list where each element represents topics for that day.
    """
    if days_remaining <= 0:
        return []
    
    # Calculate base topics per day
    base_topics_per_day = total_topics // days_remaining
    extra_topics = total_topics % days_remaining
    
    # Create distribution list
    distribution = []
    for day in range(days_remaining):
        topics_for_day = base_topics_per_day
        # Distribute extra topics to first few days
        if day < extra_topics:
            topics_for_day += 1
        distribution.append(topics_for_day)
    
    return distribution

logger = logging.getLogger(__name__)
router = APIRouter()


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


def _parse_date(date_str: str) -> date:
    """Parse date string in multiple formats"""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        try:
            return datetime.strptime(date_str, "%m/%d/%Y").date()
        except ValueError:
            raise HTTPException(
                status_code=422, 
                detail="Invalid date format. Use YYYY-MM-DD or mm/dd/yyyy"
            )


def _get_or_create_stats(db: Session, user_id: int) -> StudyPlanStats:
    """Get or create study plan statistics for user"""
    stats = db.query(StudyPlanStats).filter(StudyPlanStats.user_id == user_id).first()
    if not stats:
        stats = StudyPlanStats(user_id=user_id)
        db.add(stats)
        db.commit()
        db.refresh(stats)
    return stats


def _update_weekly_stats(db: Session, user_id: int):
    """Update weekly statistics for the user"""
    try:
        stats = _get_or_create_stats(db, user_id)
        today = date.today()
        
        # Get start of current week (Monday)
        start_of_week = today - timedelta(days=today.weekday())
        week_start_str = start_of_week.strftime('%Y-%m-%d')
        
        # Reset weekly stats if it's a new week
        if stats.week_start_date != week_start_str:
            stats.weekly_streak = 0
            stats.hours_this_week = "0h"
            stats.week_start_date = week_start_str
        
        # Calculate subjects covered and completion using tasks (unchanged)
        week_tasks = db.query(StudyPlanTask).filter(
            and_(
                StudyPlanTask.user_id == user_id,
                StudyPlanTask.date >= week_start_str,
                StudyPlanTask.date <= today.strftime('%Y-%m-%d')
            )
        ).all()
        completed_tasks = [t for t in week_tasks if t.completed]
        total_subjects = set(t.subject for t in week_tasks)
        covered_subjects = set(t.subject for t in completed_tasks)
        stats.subjects_covered = f"{len(covered_subjects)}/{len(total_subjects)}"

        # Compute actual active time from UserActivity for the current week
        week_start_date = start_of_week
        weekly_seconds = (
            db.query(func.coalesce(func.max(UserActivity.weekly_total_seconds), 0))
            .filter(
                UserActivity.user_id == user_id,
                UserActivity.week_start == week_start_date,
            )
            .scalar()
        )
        weekly_seconds = int(weekly_seconds or 0)
        hours = weekly_seconds // 3600
        minutes = (weekly_seconds % 3600) // 60
        if hours > 0 and minutes > 0:
            h_label = "hr" if hours == 1 else "hrs"
            m_label = "min" if minutes == 1 else "mins"
            stats.hours_this_week = f"{hours} {h_label} {minutes} {m_label}"
        elif hours > 0:
            h_label = "hr" if hours == 1 else "hrs"
            stats.hours_this_week = f"{hours} {h_label}"
        elif minutes > 0:
            m_label = "min" if minutes == 1 else "mins"
            stats.hours_this_week = f"{minutes} {m_label}"
        else:
            stats.hours_this_week = "0 mins"
        
        # Calculate weekly streak (consecutive days with completed tasks)
        streak = 0
        for i in range(7):
            check_date = start_of_week + timedelta(days=i)
            if check_date > today:
                break
            day_tasks = [t for t in week_tasks if t.date == check_date.strftime('%Y-%m-%d')]
            day_completed = any(t.completed for t in day_tasks)
            if day_completed:
                streak += 1
            else:
                break
        
        stats.weekly_streak = streak
        db.commit()
        
    except Exception as e:
        logger.error(f"Error updating weekly stats: {e}")


@router.post("/generate", response_model=GenerateStudyPlanResponse)
def generate_study_plan(
    request: GenerateStudyPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Generate a comprehensive study plan for the user"""
    logger.info(f"Generating study plan for user {current_user.id}")
    
    today = datetime.utcnow().date()
    exam_dt = _parse_date(request.exam_date)

    if exam_dt <= today:
        raise HTTPException(status_code=422, detail="Exam date must be in the future")

    days_remaining = (exam_dt - today).days

    # Calculate revision buffer days (3 days before exam if more than 10 days total)
    revision_buffer_days = 3 if days_remaining > 10 else 0
    study_end_date = exam_dt - timedelta(days=revision_buffer_days)
    effective_days_remaining = (study_end_date - today).days

    # Ensure we don't have negative days
    if effective_days_remaining <= 0:
        raise HTTPException(
            status_code=422, 
            detail="Not enough time to create a study plan. Please set an exam date at least 1 day in the future."
        )

    # Use user's year/semester or request fallback
    derived_year = current_user.year if current_user.year is not None else request.year
    derived_semester = current_user.semester if current_user.semester is not None else request.semester

    if derived_year is None or derived_semester is None:
        raise HTTPException(
            status_code=422, 
            detail="Year and semester are required. Please update your profile."
        )

    # Delete all previous study plans and their tasks for this user
    # This ensures that when a user creates a new plan, the old plan is completely removed
    logger.info(f"Deleting all previous study plans and tasks for user {current_user.id}")
    
    # First, delete all tasks associated with user's study plans
    user_study_plans = db.query(StudyPlan).filter(StudyPlan.user_id == current_user.id).all()
    total_tasks_deleted = 0
    for plan in user_study_plans:
        # Delete all tasks for this plan
        tasks_deleted = db.query(StudyPlanTask).filter(StudyPlanTask.study_plan_id == plan.id).delete()
        total_tasks_deleted += tasks_deleted
        logger.info(f"Deleted {tasks_deleted} tasks for study plan {plan.id}")
    
    # Then delete all study plans for this user
    deleted_plans_count = db.query(StudyPlan).filter(StudyPlan.user_id == current_user.id).delete()
    logger.info(f"Deleted {deleted_plans_count} previous study plans and {total_tasks_deleted} total tasks for user {current_user.id}")

    # Create new study plan
    study_plan = StudyPlan(
        user_id=current_user.id,
        plan_type="Exam-Focused",
        start_date=today.isoformat(),
        exam_date=exam_dt.isoformat(),
        days_remaining=days_remaining,
        year=derived_year,
        semester=derived_semester,
        is_active=True
    )
    db.add(study_plan)
    db.flush()  # Get the ID

    # Get subjects that actually have content available
    subjects_with_content = get_subjects_with_content(derived_year, derived_semester)
    
    if not subjects_with_content:
        logger.warning(f"No subjects with content found for Year {derived_year} Semester {derived_semester}")
        # Create more realistic fallback subjects with proper topic counts
        subjects_with_content = []
        
        # Year 1 Semester 2 typical subjects
        if derived_year == 1 and derived_semester == 2:
            fallback_subjects = [
                {'name': 'PS201: Human Anatomy and Physiology II', 'topic_count': 15},
                {'name': 'PS202: Pharmaceutical Organic Chemistry-I', 'topic_count': 20},
                {'name': 'BS203: Biochemistry', 'topic_count': 18},
                {'name': 'BS204: Pathophysiology', 'topic_count': 15},
                {'name': 'CS205: Computer Applications in Pharmacy', 'topic_count': 10}
            ]
        else:
            # Generic fallback for other years/semesters
            fallback_subjects = [
                {'name': f'Subject {i+1}', 'topic_count': 15} for i in range(6)
            ]
        
        # Convert to the expected format with topics
        for subject_info in fallback_subjects:
            topics = []
            for i in range(subject_info['topic_count']):
                topics.append({
                    'name': f'Topic {i+1}',
                    'unit': f'Unit {((i) // 3) + 1}',
                    'full_path': f'fallback/{subject_info["name"]}/unit{((i) // 3) + 1}/topic{i+1}/'
                })
            
            subjects_with_content.append({
                'name': subject_info['name'],
                'topics': topics,
                'topic_count': len(topics)
            })
        
        logger.info(f"Using fallback subjects: {len(subjects_with_content)} subjects with {sum(s['topic_count'] for s in subjects_with_content)} total topics")
    
    # Use fair round-robin distribution to ensure ALL subjects and topics are included
    all_topics, daily_topics = distribute_topics_fairly_across_subjects(subjects_with_content, effective_days_remaining)
    
    total_topics = len(all_topics)
    logger.info(f"Generated study plan: {len(subjects_with_content)} subjects, {total_topics} topics, {effective_days_remaining} study days")
    logger.info(f"Subjects included: {list(set(t['subject'] for t in all_topics))}")
    logger.info(f"Daily distribution: {[len(day_topics) for day_topics in daily_topics]} topics per day")
    
    # Enhanced task generation logic based on real content
    subject_count = len(subjects_with_content)
    base_times = ["09:00 AM", "11:00 AM", "02:00 PM", "04:00 PM", "07:00 PM"]
    
    # Task types with weights based on proximity to exam
    task_types = {
        "Study Session": 0.4,
        "Review": 0.3,
        "Practice": 0.2,
        "Mock Test": 0.1
    }

    # Process each day with its pre-distributed topics (NO DROPPING!)
    for d in range(effective_days_remaining):
        planned_date = today + timedelta(days=d)
        date_str = planned_date.isoformat()
        
        # Get topics for this day (already distributed fairly)
        day_topics = daily_topics[d] if d < len(daily_topics) else []
        num_tasks = len(day_topics)  # ALL topics for this day become tasks
        
        tasks = []
        logger.info(f"Day {d+1}: Creating {num_tasks} tasks from {num_tasks} topics (ALL topics included)")
        
        for t in range(num_tasks):
            if t >= len(day_topics):
                logger.warning(f"No more topics available for day {d+1} (task_index: {t}, day_topics: {len(day_topics)})")
                break
                
            topic_info = day_topics[t]
            subject = topic_info['subject']
            topic_name = topic_info['topic_name']
            unit = topic_info['unit']
            topic_index_num = topic_info['topic_index']
            total_topics_in_subject = topic_info['total_topics']
            
            # Priority based on exam proximity (using total days to exam, not effective days)
            if d >= effective_days_remaining - 7:
                priority = "High"
                duration = "1.5 hours"
                task_type = "Review" if t % 2 == 0 else "Practice"
            elif d >= effective_days_remaining - 21:
                priority = "Medium"
                duration = "1 hour"
                task_type = "Study Session" if t % 2 == 0 else "Review"
            else:
                priority = "Low"
                duration = "45 minutes"
                task_type = "Study Session"

            # Add mock tests closer to exam
            if days_remaining <= 14 and t == num_tasks - 1 and d % 3 == 0:
                task_type = "Mock Test"
                duration = "2 hours"
                priority = "High"

            task_id = f"{date_str}-{t}-{subject.replace(' ', '_').lower()}-{topic_name.replace(' ', '_').lower()}"
            title = f"{task_type}: {subject} - {topic_name}"
            
            # Create task
            task = StudyPlanTask(
                study_plan_id=study_plan.id,
                user_id=current_user.id,
                task_id=task_id,
                title=title,
                subject=subject,
                year=derived_year,
                semester=derived_semester,
                priority=priority,
                task_type=task_type,
                duration=duration,
                scheduled_time=base_times[t % len(base_times)],
                date=date_str,
                completed=False,
                notes=f"Unit: {unit} | Topic: {topic_name}"
            )
            db.add(task)
            tasks.append(task)
            
            # Auto-mark quiz_completed if user already finished this topic's quiz
            # Extract cleaned subject name (quiz table stores cleaned names without codes)
            from app.utils.subject_utils import clean_subject_name, extract_subject_code
            
            subject_code = extract_subject_code(subject)
            cleaned_subject = clean_subject_name(subject)
            
            logger.info(f"Checking for prior quiz: subject='{subject}', cleaned='{cleaned_subject}', code='{subject_code}', unit='{unit}', topic='{topic_name}'")
            
            # DEBUG: Log all quizzes for this user to help diagnose matching issues
            if d == 0 and t == 0:  # Only log once on first task
                all_user_quizzes = db.query(Quiz).filter(Quiz.student_id == current_user.id).limit(10).all()
                logger.info(f"DEBUG: User has {len(all_user_quizzes)} quizzes (showing first 10):")
                for q in all_user_quizzes:
                    logger.info(f"  Quiz ID {q.id}: subject='{q.subject}', unit='{q.unit}', topic='{q.topic}', score={q.score}")
            
            # Build subject matching conditions (case-insensitive for better matching)
            subject_conditions = [Quiz.subject.ilike(cleaned_subject)]  # Primary match: cleaned name (case-insensitive)
            if subject_code:
                subject_conditions.append(Quiz.subject.ilike(f"%{subject_code}%"))  # Fallback: code (case-insensitive)
            
            # Build topic matching conditions (case-insensitive for better matching)
            topic_conditions = [Quiz.topic.ilike(topic_name)]  # Primary match: exact (case-insensitive)
            if topic_name:
                topic_conditions.append(Quiz.topic.ilike(f"%{topic_name}%"))  # Fallback: partial
            
            # Search for quiz with comprehensive matching
            # The quiz table stores cleaned subject names (without codes)
            prior_quiz = db.query(Quiz).filter(
                and_(
                    Quiz.student_id == current_user.id,
                    or_(*subject_conditions),
                    or_(*topic_conditions)
                )
            ).order_by(Quiz.created_at.desc()).first()
            
            if prior_quiz:
                logger.info(f"Found prior quiz for topic '{topic_name}': quiz_id={prior_quiz.id}, score={prior_quiz.score}")
                # Mark quiz as completed - this also marks the entire task as completed
                task.quiz_completed = True
                task.completed = True
                task.completed_at = prior_quiz.created_at or datetime.utcnow()
                logger.info(f"✅ Marked task {task_id} as quiz_completed=True, completed=True (prior quiz found)")
            else:
                logger.info(f"No prior quiz found for topic '{topic_name}'")

        # Don't create response objects yet - we'll do this after commit

    # Update user stats
    stats = _get_or_create_stats(db, current_user.id)
    stats.total_plans_created += 1
    
    db.commit()
    
    # Now create response objects after commit (so IDs and timestamps are available)
    daily_plans = []
    all_tasks = db.query(StudyPlanTask).filter(
        StudyPlanTask.study_plan_id == study_plan.id
    ).order_by(StudyPlanTask.date, StudyPlanTask.id).all()
    
    # Group tasks by date
    tasks_by_date = {}
    for task in all_tasks:
        if task.date not in tasks_by_date:
            tasks_by_date[task.date] = []
        tasks_by_date[task.date].append(StudyPlanTaskSchema.from_orm(task))
    
    # Create daily plans in order
    for date_str in sorted(tasks_by_date.keys()):
        daily_plans.append(DailyPlan(
            date=date_str,
            tasks=tasks_by_date[date_str]
        ))
    
    # Update weekly stats in background
    background_tasks.add_task(_update_weekly_stats, db, current_user.id)
    
    logger.info(f"Generated study plan with {len(daily_plans)} days for user {current_user.id}")

    _track_event(
        current_user.mobile,  # Use mobile number as distinct_id instead of user.id
        "study_plan_generated",
        {
            "study_plan_id": study_plan.id,
            "plan_type": study_plan.plan_type,
            "start_date": study_plan.start_date,
            "exam_date": study_plan.exam_date,
            "days_remaining": study_plan.days_remaining,
            "year": study_plan.year,
            "semester": study_plan.semester,
            "subjects_count": len(subjects_with_content),
            "total_topics": len(all_topics),
            "effective_days": effective_days_remaining,
            "user_id": current_user.id,  # Include user_id in properties for reference
        },
    )

    return GenerateStudyPlanResponse(
        plan_type=study_plan.plan_type,
        start_date=study_plan.start_date,
        exam_date=study_plan.exam_date,
        days_remaining=study_plan.days_remaining,
        year=study_plan.year,
        semester=study_plan.semester,
        total_topics=len(all_topics),
        topics_per_day=len(all_topics) // effective_days_remaining if effective_days_remaining > 0 else 0,
        daily=daily_plans
    )


@router.get("/current", response_model=GenerateStudyPlanResponse)
def get_current_study_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the user's current active study plan - OPTIMIZED for speed"""
    # OPTIMIZED: Single query with join to get study plan and tasks together
    study_plan = db.query(StudyPlan).filter(
        and_(
            StudyPlan.user_id == current_user.id, 
            StudyPlan.is_active == True
        )
    ).first()
    
    if not study_plan:
        raise HTTPException(status_code=404, detail="No active study plan found. Please generate a study plan first.")
    
    _track_event(
        current_user.mobile,  # Use mobile number as distinct_id instead of user.id
        "study_plan_viewed",
        {
            "study_plan_id": study_plan.id,
            "plan_type": study_plan.plan_type,
            "start_date": study_plan.start_date,
            "exam_date": study_plan.exam_date,
            "days_remaining": study_plan.days_remaining,
            "year": study_plan.year,
            "semester": study_plan.semester,
            "user_id": current_user.id,  # Include user_id in properties for reference
        },
    )

    # OPTIMIZED: Use only essential fields and proper ordering
    tasks = db.query(StudyPlanTask).filter(
        StudyPlanTask.study_plan_id == study_plan.id
    ).order_by(StudyPlanTask.date, StudyPlanTask.scheduled_time).all()
    
    # OPTIMIZED: Use defaultdict for faster grouping
    from collections import defaultdict
    daily_plans = defaultdict(list)
    
    # OPTIMIZED: Process tasks in single pass
    for task in tasks:
        daily_plans[task.date].append(StudyPlanTaskSchema.from_orm(task))
    
    # OPTIMIZED: Convert to list format with sorted dates
    daily_list = [
        DailyPlan(date=date, tasks=tasks_list) 
        for date, tasks_list in sorted(daily_plans.items())
    ]
    
    # OPTIMIZED: Calculate topic information for existing plan (cached)
    total_topics = get_total_topics_for_year_semester(study_plan.year, study_plan.semester)
    topics_per_day = distribute_topics_across_days(total_topics, study_plan.days_remaining)
    
    return GenerateStudyPlanResponse(
        plan_type=study_plan.plan_type,
        start_date=study_plan.start_date,
        exam_date=study_plan.exam_date,
        days_remaining=study_plan.days_remaining,
        year=study_plan.year,
        semester=study_plan.semester,
        total_topics=total_topics,
        topics_per_day=topics_per_day,
        daily=daily_list
    )


@router.get("/has-plan")
def check_user_has_study_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if user has any study plan (active or inactive)"""
    plan_count = db.query(StudyPlan).filter(StudyPlan.user_id == current_user.id).count()
    active_plan = db.query(StudyPlan).filter(
        and_(StudyPlan.user_id == current_user.id, StudyPlan.is_active == True)
    ).first()
    
    return {
        "has_plan": plan_count > 0,
        "has_active_plan": active_plan is not None,
        "total_plans": plan_count,
        "current_exam_date": active_plan.exam_date if active_plan else None
    }


@router.post("/task/toggle", response_model=TaskToggleResponse)
def toggle_task_completion(
    request: TaskToggleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Toggle completion status of a study plan task"""
    task = db.query(StudyPlanTask).filter(
        and_(
            StudyPlanTask.task_id == request.task_id,
            StudyPlanTask.user_id == current_user.id
        )
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # If trying to mark as completed, check topic completion status first
    if request.completed:
        # Check if any two of video, notes, or quiz are completed
        video_completed = task.video_completed
        notes_completed = task.notes_completed
        quiz_completed = task.quiz_completed
        
        completed_count = sum([video_completed, notes_completed, quiz_completed])
        
        if completed_count < 2:
            missing_items = []
            if not video_completed:
                missing_items.append("video")
            if not notes_completed:
                missing_items.append("notes")
            if not quiz_completed:
                missing_items.append("quiz")
            
            raise HTTPException(
                status_code=400, 
                detail=f"Please complete at least 2 activities (video, notes, or quiz) for this topic before marking the task as completed. Currently completed: {completed_count}/3"
            )
    
    # Update completion status
    task.completed = request.completed
    task.completed_at = datetime.utcnow() if request.completed else None
    task.updated_at = datetime.utcnow()
    
    xp_awarded = 0
    if request.completed:
        # XP is now calculated directly in quiz completion endpoint
        
        # Update user stats
        stats = _get_or_create_stats(db, current_user.id)
        stats.total_tasks_completed += 1
        
        # Check if all tasks for the day are completed
        today_str = datetime.utcnow().date().strftime('%Y-%m-%d')
        if task.date == today_str:
            today_tasks = db.query(StudyPlanTask).filter(
                and_(
                    StudyPlanTask.user_id == current_user.id,
                    StudyPlanTask.date == today_str
                )
            ).all()
            
            all_completed = all(t.completed for t in today_tasks)
            if all_completed:
                # Update daily goal
                daily_goal = db.query(DailyGoal).filter(
                    and_(
                        DailyGoal.user_id == current_user.id,
                        DailyGoal.date == today_str
                    )
                ).first()
                
                if not daily_goal:
                    daily_goal = DailyGoal(
                        user_id=current_user.id,
                        date=today_str,
                        daily_tasks_completed=True
                    )
                    db.add(daily_goal)
                else:
                    daily_goal.daily_tasks_completed = True
                
                # Daily tasks completed - streak logic handled separately
    
    db.commit()
    db.refresh(task)

    _track_event(
        current_user.mobile,  # Use mobile number as distinct_id instead of user.id
        "study_plan_task_toggled",
        {
            "task_id": task.task_id,
            "completed": task.completed,
            "subject": task.subject,
            "date": task.date,
            "priority": task.priority,
            "user_id": current_user.id,  # Include user_id in properties for reference
        },
    )

    # Update weekly stats in background
    background_tasks.add_task(_update_weekly_stats, db, current_user.id)
    
    return TaskToggleResponse(
        success=True,
        task=StudyPlanTaskSchema.from_orm(task),
        message="Task updated successfully",
        xp_awarded=xp_awarded
    )

@router.options("/task/find-by-topic")
async def find_task_by_topic_options():
    """Handle CORS preflight requests for find-by-topic endpoint"""
    return {"message": "OK"}

@router.get("/task/find-by-topic")
def find_task_by_topic(
    subject: str,
    topic: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Find study plan task ID by subject and topic name - OPTIMIZED for speed"""
    # OPTIMIZED: Single query with OR conditions for all search strategies
    clean_topic = topic.replace(' ', '_').replace('-', '_').lower()
    today = datetime.utcnow().date().strftime('%Y-%m-%d')
    
    from sqlalchemy import or_
    
    # OPTIMIZED: Single query with multiple OR conditions
    task = db.query(StudyPlanTask).filter(
        and_(
            StudyPlanTask.user_id == current_user.id,
            or_(
                # Strategy 1: Subject + topic in notes
                and_(
                    StudyPlanTask.subject.ilike(f"%{subject}%"),
                    StudyPlanTask.notes.ilike(f"%{topic}%")
                ),
                # Strategy 2: Topic in title
                StudyPlanTask.title.ilike(f"%{topic}%"),
                # Strategy 3: Topic in task_id
                StudyPlanTask.task_id.ilike(f"%{clean_topic}%"),
                # Strategy 4: Today's tasks (fallback)
                StudyPlanTask.date == today
            )
        )
    ).first()
    
    if not task:
        return {"task_id": None, "message": "No matching task found"}
    
    return {
        "task_id": task.task_id,
        "title": task.title,
        "subject": task.subject,
        "date": task.date,
        "video_completed": task.video_completed,
        "notes_completed": task.notes_completed,
        "quiz_completed": task.quiz_completed
    }


@router.post("/task/mark-video-completed")
def mark_video_completed(
    request: dict,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark video as completed for a specific task"""
    # Set cache-busting headers
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["Last-Modified"] = datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT")
    
    task_id = request.get('task_id')
    if not task_id:
        raise HTTPException(status_code=400, detail="task_id is required")
    
    logger.info(f"Marking video completed for user {current_user.id} ({current_user.mobile}), task_id: {task_id}")
    
    # If task_id is "unknown", try to find today's first task as fallback
    if task_id == "unknown":
        logger.warning(f"Received 'unknown' task_id, attempting to find today's task for user {current_user.id}")
        today = date.today().strftime('%Y-%m-%d')
        
        today_tasks = db.query(StudyPlanTask).filter(
            and_(
                StudyPlanTask.user_id == current_user.id,
                StudyPlanTask.date == today
            )
        ).all()
        
        if today_tasks:
            task_id = today_tasks[0].task_id
            logger.info(f"Using fallback task_id: {task_id}")
        else:
            logger.warning(f"No tasks found for today ({today}) for user {current_user.id}")
    
    task = db.query(StudyPlanTask).filter(
        and_(
            StudyPlanTask.task_id == task_id,
            StudyPlanTask.user_id == current_user.id
        )
    ).first()
    
    if not task:
        # Check if user has any study plan tasks
        user_tasks = db.query(StudyPlanTask).filter(StudyPlanTask.user_id == current_user.id).all()
        logger.warning(f"Task {task_id} not found for user {current_user.id}. User has {len(user_tasks)} total tasks.")
        if user_tasks:
            logger.warning(f"Available task IDs: {[t.task_id for t in user_tasks[:5]]}")
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found for user")
    
    # Update video_completed column
    logger.info(f"Task video_completed status: {task.video_completed}")
    
    # Update streak only (Daily Goals removed)
    try:
        from app.services.streak_service import StreakService
        from datetime import date
        user_local_date = date.today()
        streak_result = StreakService.watch_video_and_update_streak(db, current_user.id, user_local_date)
        logger.info(f"Streak updated successfully: {streak_result}")
        db.commit()
    except Exception as streak_error:
        logger.error(f"Error updating streak: {streak_error}")
        import traceback
        logger.error(f"Streak error traceback: {traceback.format_exc()}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update streak")
    
    # Update video_completed column only (quiz-only completion policy)
    if not task.video_completed:
        logger.info(f"Marking video as completed for task {task_id}")
        task.video_completed = True
        task.updated_at = datetime.utcnow()
        db.commit()
    else:
        logger.info(f"Video already completed for task {task_id}, streak updated")
    
    _track_event(
        current_user.mobile,  # Use mobile number as distinct_id instead of user.id
        "video_completed",
        {
            "task_id": task_id,
            "subject": task.subject,
            "date": task.date,
            "user_id": current_user.id,  # Include user_id in properties for reference
        },
    )

    return {"success": True, "message": "Video marked as completed"}

@router.post("/task/mark-notes-completed")
def mark_notes_completed(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark notes as completed for a specific task and update streak."""
    task_id = request.get('task_id')
    if not task_id:
        raise HTTPException(status_code=400, detail="task_id is required")

    logger.info(f"Marking notes completed for user {current_user.id} ({current_user.mobile}), task_id: {task_id}")

    # If task_id is "unknown", try to find today's first task as fallback
    if task_id == "unknown":
        logger.warning(f"Received 'unknown' task_id, attempting to find today's task for user {current_user.id}")
        today = date.today().strftime('%Y-%m-%d')

        today_tasks = db.query(StudyPlanTask).filter(
            and_(
                StudyPlanTask.user_id == current_user.id,
                StudyPlanTask.date == today
            )
        ).all()

        if today_tasks:
            task_id = today_tasks[0].task_id
            logger.info(f"Using fallback task_id: {task_id}")
        else:
            logger.warning(f"No tasks found for today ({today}) for user {current_user.id}")

    task = db.query(StudyPlanTask).filter(
        and_(
            StudyPlanTask.task_id == task_id,
            StudyPlanTask.user_id == current_user.id
        )
    ).first()

    if not task:
        user_tasks = db.query(StudyPlanTask).filter(StudyPlanTask.user_id == current_user.id).all()
        logger.warning(f"Task {task_id} not found for user {current_user.id}. User has {len(user_tasks)} total tasks.")
        if user_tasks:
            logger.warning(f"Available task IDs: {[t.task_id for t in user_tasks[:5]]}")
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found for user")

    streak_result = None

    try:
        from app.services.streak_service import StreakService

        user_local_date = date.today()
        streak_result = StreakService.complete_notes_and_update_streak(db, current_user.id, user_local_date)
        logger.info(f"Streak updated via notes completion: {streak_result}")
    except Exception as streak_error:
        logger.error(f"Error updating streak via notes: {streak_error}")
        import traceback
        logger.error(f"Streak error traceback: {traceback.format_exc()}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update streak for notes completion")

    if not task.notes_completed:
        task.notes_completed = True
        task.updated_at = datetime.utcnow()
        db.commit()

    response_payload = {
        "success": True,
        "message": "Notes marked as completed",
        "task_id": task_id,
        "notes_completed": True,
    }

    if streak_result:
        response_payload["streak"] = streak_result

    return response_payload

@router.post("/task/mark-quiz-completed")
def mark_quiz_completed(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark quiz as completed for a specific task and update streak."""
    task_id = request.get('task_id')
    if not task_id:
        raise HTTPException(status_code=400, detail="task_id is required")

    logger.info(f"Marking quiz completed for user {current_user.id} ({current_user.mobile}), task_id: {task_id}")

    if task_id == "unknown":
        logger.warning(f"Received 'unknown' task_id, attempting to find today's task for user {current_user.id}")
        today = date.today().strftime('%Y-%m-%d')

        today_tasks = db.query(StudyPlanTask).filter(
            and_(
                StudyPlanTask.user_id == current_user.id,
                StudyPlanTask.date == today
            )
        ).all()

        if today_tasks:
            task_id = today_tasks[0].task_id
            logger.info(f"Using fallback task_id: {task_id}")
        else:
            logger.warning(f"No tasks found for today ({today}) for user {current_user.id}")

    task = db.query(StudyPlanTask).filter(
        and_(
            StudyPlanTask.task_id == task_id,
            StudyPlanTask.user_id == current_user.id
        )
    ).first()

    if not task:
        user_tasks = db.query(StudyPlanTask).filter(StudyPlanTask.user_id == current_user.id).all()
        logger.warning(f"Task {task_id} not found for user {current_user.id}. User has {len(user_tasks)} total tasks.")
        if user_tasks:
            logger.warning(f"Available task IDs: {[t.task_id for t in user_tasks[:5]]}")
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found for user")

    if not task.quiz_completed:
        task.quiz_completed = True
        task.updated_at = datetime.utcnow()
        task.completed = True
        task.completed_at = datetime.utcnow()
        db.commit()

    response_payload = {
        "success": True,
        "message": "Quiz marked as completed",
        "task_id": task_id,
        "quiz_completed": True,
        "task_completed": task.completed,
    }

    return response_payload


@router.put("/task/{task_id}")
def update_task(
    task_id: str,
    update_data: StudyPlanTaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a study plan task"""
    task = db.query(StudyPlanTask).filter(
        and_(
            StudyPlanTask.task_id == task_id,
            StudyPlanTask.user_id == current_user.id
        )
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update fields
    update_dict = update_data.dict(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(task, field, value)
    
    task.updated_at = datetime.utcnow()
    db.commit()
    
    return {"success": True, "message": "Task updated successfully"}


@router.delete("/task/{task_id}")
def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a study plan task"""
    task = db.query(StudyPlanTask).filter(
        and_(
            StudyPlanTask.task_id == task_id,
            StudyPlanTask.user_id == current_user.id
        )
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(task)
    db.commit()
    
    return {"success": True, "message": "Task deleted successfully"}


@router.get("/tasks/today", response_model=TasksForDateResponse)
def get_todays_tasks_optimized(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get today's tasks - ULTRA-OPTIMIZED for speed (no date parameter needed)"""
    # Get today's date once
    today = datetime.utcnow().date().strftime('%Y-%m-%d')
    
    # OPTIMIZED: Single query with only essential fields for maximum speed
    tasks = db.query(StudyPlanTask).filter(
        and_(
            StudyPlanTask.user_id == current_user.id,
            StudyPlanTask.date == today
        )
    ).order_by(StudyPlanTask.id).all()
    
    if not tasks:
        return TasksForDateResponse(
            date=today,
            tasks=[],
            total_tasks=0,
            completed_tasks=0,
            progress_percentage=0
        )
    
    # OPTIMIZED: Calculate counts in single pass
    total_tasks = len(tasks)
    completed_tasks = 0
    task_schemas = []
    
    # OPTIMIZED: Process tasks in single loop for maximum efficiency
    for task in tasks:
        # Auto-mark if already finished topic via quiz (quiz-only policy)
        if not task.completed:
            # Try to parse topic from notes "Unit: {unit} | Topic: {topic_name}"
            topic_name = None
            if task.notes and '| Topic:' in task.notes:
                try:
                    parts = [p.strip() for p in task.notes.split('|')]
                    for p in parts:
                        if p.startswith('Topic:'):
                            topic_name = p.replace('Topic:', '').strip()
                            break
                except Exception:
                    topic_name = None
            if not topic_name:
                # Fallback parse from title "StudyType: Subject - Topic"
                try:
                    title_parts = task.title.split(' - ')
                    if len(title_parts) >= 2:
                        topic_name = title_parts[-1].strip()
                except Exception:
                    topic_name = None
            if topic_name:
                prior_quiz = db.query(Quiz).filter(
                    and_(
                        Quiz.student_id == current_user.id,
                        Quiz.subject == task.subject,
                        Quiz.topic == topic_name
                    )
                ).order_by(Quiz.created_at.desc()).first()
                if prior_quiz:
                    task.quiz_completed = True
                    task.completed = True
                    task.completed_at = prior_quiz.created_at or datetime.utcnow()
                    task.updated_at = datetime.utcnow()
                    db.commit()
        if task.completed:
            completed_tasks += 1
        task_schemas.append(StudyPlanTaskSchema.from_orm(task))
    
    progress_percentage = int((completed_tasks / total_tasks) * 100) if total_tasks > 0 else 0
    
    return TasksForDateResponse(
        date=today,
        tasks=task_schemas,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        progress_percentage=progress_percentage
    )


@router.get("/tasks/date", response_model=TasksForDateResponse)
def get_tasks_for_date(
    date: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tasks for a specific date - ULTRA-OPTIMIZED for speed"""
    # Validate date format
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date format. Use YYYY-MM-DD")
    
    # OPTIMIZED: Single query with proper indexing on user_id + date
    tasks = db.query(StudyPlanTask).filter(
        and_(
            StudyPlanTask.user_id == current_user.id,
            StudyPlanTask.date == date
        )
    ).order_by(StudyPlanTask.id).all()
    
    if not tasks:
        return TasksForDateResponse(
            date=date,
            tasks=[],
            total_tasks=0,
            completed_tasks=0,
            progress_percentage=0
        )
    
    # OPTIMIZED: Calculate counts and process schemas in single pass
    total_tasks = len(tasks)
    completed_tasks = 0
    task_schemas = []
    
    # OPTIMIZED: Process tasks in single loop for maximum efficiency
    for task in tasks:
        # Auto-mark if already finished topic via quiz
        if not task.completed:
            # Try to parse topic from notes "Unit: {unit} | Topic: {topic_name}"
            topic_name = None
            if task.notes and '| Topic:' in task.notes:
                try:
                    parts = [p.strip() for p in task.notes.split('|')]
                    for p in parts:
                        if p.startswith('Topic:'):
                            topic_name = p.replace('Topic:', '').strip()
                            break
                except Exception:
                    topic_name = None
            if not topic_name:
                # Fallback parse from title "StudyType: Subject - Topic"
                try:
                    title_parts = task.title.split(' - ')
                    if len(title_parts) >= 2:
                        topic_name = title_parts[-1].strip()
                except Exception:
                    topic_name = None
            if topic_name:
                prior_quiz = db.query(Quiz).filter(
                    and_(
                        Quiz.student_id == current_user.id,
                        Quiz.subject == task.subject,
                        Quiz.topic == topic_name
                    )
                ).order_by(Quiz.created_at.desc()).first()
                if prior_quiz:
                    task.video_completed = True
                    task.notes_completed = True
                    task.quiz_completed = True
                    task.completed = True
                    task.completed_at = prior_quiz.created_at or datetime.utcnow()
                    task.updated_at = datetime.utcnow()
                    db.commit()
        if task.completed:
            completed_tasks += 1
        task_schemas.append(StudyPlanTaskSchema.from_orm(task))
    
    progress_percentage = int((completed_tasks / total_tasks) * 100) if total_tasks > 0 else 0
    
    return TasksForDateResponse(
        date=date,
        tasks=task_schemas,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        progress_percentage=progress_percentage
    )


@router.get("/stats", response_model=StudyPlanStatsResponse)
def get_study_plan_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Get study plan statistics for the user"""
    background_tasks.add_task(_update_weekly_stats, db, current_user.id)
    
    stats = _get_or_create_stats(db, current_user.id)
    
    # Override hours_this_week with actual active time from UserActivity
    try:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())  # Monday
        # Use the propagated weekly_total_seconds value for this user/week
        weekly_seconds = (
            db.query(func.coalesce(func.max(UserActivity.weekly_total_seconds), 0))
            .filter(
                UserActivity.user_id == current_user.id,
                UserActivity.week_start == week_start,
            )
            .scalar()
        )
        weekly_seconds = int(weekly_seconds or 0)
        hours = weekly_seconds // 3600
        minutes = (weekly_seconds % 3600) // 60
        if hours > 0 and minutes > 0:
            h_label = "hr" if hours == 1 else "hrs"
            m_label = "min" if minutes == 1 else "mins"
            stats.hours_this_week = f"{hours} {h_label} {minutes} {m_label}"
        elif hours > 0:
            h_label = "hr" if hours == 1 else "hrs"
            stats.hours_this_week = f"{hours} {h_label}"
        elif minutes > 0:
            m_label = "min" if minutes == 1 else "mins"
            stats.hours_this_week = f"{minutes} {m_label}"
        else:
            stats.hours_this_week = "0 mins"
        # Optionally persist for visibility elsewhere
        db.commit()
    except Exception as e:
        # If anything fails, keep existing stats.hours_this_week
        logger.error(f"Failed to compute hours from UserActivity: {e}")
    
    # Compute today's 'you' and 'topper' based on current user's cohort (year/semester)
    today = date.today()
    your_seconds_today = 0
    topper_seconds_today = 0
    ua_today = db.query(UserActivity).filter(
        UserActivity.user_id == current_user.id,
        UserActivity.date == today,
    ).first()

    if ua_today:
        your_seconds_today = int(ua_today.total_seconds or 0)
        user_year = ua_today.year
        user_semester = ua_today.semester

        # Find topper's study time for today in same cohort (INCLUDING yourself)
        # This ensures if you are the topper, both bars show equal values
        topper_seconds_today = db.query(func.max(UserActivity.total_seconds)).filter(
            UserActivity.date == today,
            UserActivity.year == user_year,
            UserActivity.semester == user_semester,
            # ← REMOVED: UserActivity.user_id != current_user.id
            # Now INCLUDES current user in topper calculation
        ).scalar()

        # Only set to 0 if NO ONE in cohort studied today (query returns None)
        if topper_seconds_today is None:
            topper_seconds_today = 0
        # If you are the topper or tied for topper, topper_seconds_today == your_seconds_today
        # This is the CORRECT behavior - both bars will be equal
    else:
        # No activity today => both zeros
        your_seconds_today = 0
        topper_seconds_today = 0

    # Format hours string for today's value (as requested by the UI)
    h = your_seconds_today // 3600
    m = (your_seconds_today % 3600) // 60
    if h == 0 and m == 0:
        hours_label_today = "0 mins"
    elif h == 0:
        hours_label_today = f"{m} mins"
    elif m == 0:
        hours_label_today = f"{h} hr{'' if h == 1 else 's'}"
    else:
        hours_label_today = f"{h} hr{'' if h == 1 else 's'} {m} mins"

    # Compute topper weekly hours for the same cohort (year/semester)
    # Determine cohort values
    cohort_year = None
    cohort_semester = None
    if 'ua_today' in locals() and ua_today:
        cohort_year = ua_today.year
        cohort_semester = ua_today.semester
    else:
        cohort_year = getattr(current_user, 'year', None)
        cohort_semester = getattr(current_user, 'semester', None)

    topper_weekly_seconds = 0
    if cohort_year is not None and cohort_semester is not None:
        topper_weekly_seconds = (
            db.query(func.max(UserActivity.weekly_total_seconds))
            .filter(
                UserActivity.week_start == week_start,
                UserActivity.year == cohort_year,
                UserActivity.semester == cohort_semester,
            )
            .scalar()
        ) or 0

    return StudyPlanStatsResponse(
        weekly_streak=stats.weekly_streak,
        hours_this_week=stats.hours_this_week,  # weekly total label
        today_hours_label=hours_label_today,
        subjects_covered=stats.subjects_covered,
        total_plans_created=stats.total_plans_created,
        total_tasks_completed=stats.total_tasks_completed,
        total_study_hours=stats.total_study_hours,
        your_study_hours=your_seconds_today / 3600.0,
        topper_study_hours=int(topper_seconds_today or 0) / 3600.0,
        your_weekly_hours=(int(weekly_seconds or 0)) / 3600.0,
        topper_weekly_hours=int(topper_weekly_seconds or 0) / 3600.0,
    )


@router.get("/weekly-progress", response_model=WeeklyProgressResponse)
def get_weekly_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get weekly progress data"""
    today = datetime.utcnow().date()
    start_of_week = today - timedelta(days=today.weekday())
    
    week_dates = []
    total_weekly_tasks = 0
    completed_weekly_tasks = 0
    
    for i in range(7):
        date_obj = start_of_week + timedelta(days=i)
        date_str = date_obj.strftime('%Y-%m-%d')
        
        # Get tasks for this date
        day_tasks = db.query(StudyPlanTask).filter(
            and_(
                StudyPlanTask.user_id == current_user.id,
                StudyPlanTask.date == date_str
            )
        ).all()
        
        completed_count = sum(1 for task in day_tasks if task.completed)
        total_weekly_tasks += len(day_tasks)
        completed_weekly_tasks += completed_count
        
        week_dates.append({
            "day": date_obj.strftime('%a'),
            "date": date_obj.day,
            "isToday": date_obj == today,
            "totalTasks": len(day_tasks),
            "completedTasks": completed_count,
            "completionRate": int((completed_count / len(day_tasks)) * 100) if day_tasks else 0
        })
    
    current_week_completion = int((completed_weekly_tasks / total_weekly_tasks) * 100) if total_weekly_tasks else 0
    
    return WeeklyProgressResponse(
        week_dates=week_dates,
        current_week_completion=current_week_completion,
        total_weekly_tasks=total_weekly_tasks
    )


@router.get("/all", response_model=StudyPlanListResponse)
def get_all_study_plans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all study plans for the user"""
    plans = db.query(StudyPlan).filter(
        StudyPlan.user_id == current_user.id
    ).order_by(desc(StudyPlan.created_at)).all()
    
    active_plan = next((plan for plan in plans if plan.is_active), None)
    
    return StudyPlanListResponse(
        study_plans=plans,
        active_plan=active_plan
    )


@router.post("/bulk-update", response_model=BulkTaskUpdateResponse)
def bulk_update_tasks(
    request: BulkTaskUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk update multiple tasks"""
    updated_count = 0
    failed_updates = []
    
    for update_item in request.updates:
        try:
            task_id = update_item.get("task_id")
            if not task_id:
                failed_updates.append({"error": "Missing task_id", "item": update_item})
                continue
            
            task = db.query(StudyPlanTask).filter(
                and_(
                    StudyPlanTask.task_id == task_id,
                    StudyPlanTask.user_id == current_user.id
                )
            ).first()
            
            if not task:
                failed_updates.append({"error": "Task not found", "task_id": task_id})
                continue
            
            # Update fields
            for field, value in update_item.items():
                if field != "task_id" and hasattr(task, field):
                    setattr(task, field, value)
            
            task.updated_at = datetime.utcnow()
            updated_count += 1
            
        except Exception as e:
            failed_updates.append({"error": str(e), "item": update_item})
    
    db.commit()
    
    return BulkTaskUpdateResponse(
        success=updated_count > 0,
        updated_count=updated_count,
        failed_updates=failed_updates,
        message=f"Updated {updated_count} tasks, {len(failed_updates)} failed"
    )

