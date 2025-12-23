from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import Dict, Any
from datetime import datetime
import logging

from app.db.session import get_db
from app.models.quiz import Quiz
from app.models.study_plan import StudyPlanTask
from app.models.user import User
from app.api.auth import get_current_user
from app.schemas.quiz import QuizCompletionRequest, QuizMarkCompletedRequest

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/check-topic-quiz")
async def check_topic_quiz_completion(
    request: QuizCompletionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Check if a quiz exists for a topic and update study plan task quiz completion status.
    
    Logic:
    1. Check if quiz exists in quiz table for the topic
    2. Find corresponding study plan task
    3. Update quiz_completed column based on quiz existence
    """
    try:
        logger.info(f"Checking quiz completion for user {current_user.id}: {request.subject} - {request.unit} - {request.topic}")
        
        # Check if quiz exists for this topic
        quiz_exists = db.query(Quiz).filter(
            and_(
                Quiz.student_id == current_user.id,
                Quiz.subject == request.subject,
                Quiz.unit == request.unit,
                Quiz.topic == request.topic
            )
        ).first()
        
        quiz_completed = quiz_exists is not None
        logger.info(f"Quiz exists: {quiz_completed}")
        
        # Find corresponding study plan task
        # Look for task that matches the topic (topic name might be in title or notes)
        study_plan_task = db.query(StudyPlanTask).filter(
            and_(
                StudyPlanTask.user_id == current_user.id,
                or_(
                    StudyPlanTask.title.contains(request.topic),
                    StudyPlanTask.notes.contains(request.topic),
                    and_(
                        StudyPlanTask.subject.contains(request.subject.split(':')[0]),  # Match subject code
                        StudyPlanTask.notes.contains(f"Topic: {request.topic}")
                    )
                )
            )
        ).first()
        
        if study_plan_task:
            logger.info(f"Found study plan task: {study_plan_task.task_id}")
            
            # Update quiz completion status
            study_plan_task.quiz_completed = quiz_completed
            study_plan_task.updated_at = datetime.utcnow()
            
            # If quiz is completed, also mark the overall task as completed if all components are done
            if quiz_completed and study_plan_task.video_completed and study_plan_task.notes_completed:
                study_plan_task.completed = True
                study_plan_task.completed_at = datetime.utcnow()
                logger.info(f"Task {study_plan_task.task_id} marked as fully completed")
            
            db.commit()
            logger.info(f"Updated study plan task quiz completion: {quiz_completed}")
            
            return {
                "success": True,
                "quiz_completed": quiz_completed,
                "task_id": study_plan_task.task_id,
                "task_fully_completed": study_plan_task.completed,
                "message": f"Quiz completion status updated to {quiz_completed}"
            }
        else:
            logger.warning(f"No study plan task found for topic: {request.topic}")
            return {
                "success": True,
                "quiz_completed": quiz_completed,
                "task_id": None,
                "task_fully_completed": False,
                "message": "No corresponding study plan task found"
            }
            
    except Exception as e:
        logger.error(f"Error checking quiz completion: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check quiz completion: {str(e)}"
        )

@router.post("/mark-completed")
async def mark_quiz_completed(
    request: QuizMarkCompletedRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Mark quiz as completed for a topic by creating/updating quiz record and study plan task.
    
    This is called when user actually completes a quiz.
    """
    try:
        logger.info(f"Marking quiz as completed for user {current_user.id}: {request.subject} - {request.unit} - {request.topic}")
        
        # Check if quiz record already exists
        existing_quiz = db.query(Quiz).filter(
            and_(
                Quiz.student_id == current_user.id,
                Quiz.subject == request.subject,
                Quiz.unit == request.unit,
                Quiz.topic == request.topic
            )
        ).first()
        
        if existing_quiz:
            # Update existing quiz score if provided
            if request.score is not None:
                existing_quiz.score = request.score
                logger.info(f"Updated existing quiz score to {request.score}")
        else:
            # Create new quiz record
            new_quiz = Quiz(
                student_id=current_user.id,
                year=1,  # You might want to get this from user profile
                semester=1,  # You might want to get this from user profile
                subject=request.subject,
                unit=request.unit,
                topic=request.topic,
                score=request.score or 0
            )
            db.add(new_quiz)
            logger.info(f"Created new quiz record with score {request.score or 0}")
        
        # Find and update corresponding study plan task
        study_plan_task = db.query(StudyPlanTask).filter(
            and_(
                StudyPlanTask.user_id == current_user.id,
                or_(
                    StudyPlanTask.title.contains(request.topic),
                    StudyPlanTask.notes.contains(request.topic),
                    and_(
                        StudyPlanTask.subject.contains(request.subject.split(':')[0]),  # Match subject code
                        StudyPlanTask.notes.contains(f"Topic: {request.topic}")
                    )
                )
            )
        ).first()
        
        if study_plan_task:
            logger.info(f"Found study plan task: {study_plan_task.task_id}")
            
            # Mark quiz as completed - this also marks the entire task as completed
            study_plan_task.quiz_completed = True
            study_plan_task.completed = True
            study_plan_task.completed_at = datetime.utcnow()
            study_plan_task.updated_at = datetime.utcnow()
            
            db.commit()
            
            return {
                "success": True,
                "quiz_completed": True,
                "task_id": study_plan_task.task_id,
                "task_fully_completed": study_plan_task.completed,
                "score": request.score or 0,
                "message": "Quiz marked as completed successfully"
            }
        else:
            # Still commit the quiz record even if no study plan task found
            db.commit()
            logger.warning(f"No study plan task found for topic: {request.topic}")
            
            return {
                "success": True,
                "quiz_completed": True,
                "task_id": None,
                "task_fully_completed": False,
                "score": request.score or 0,
                "message": "Quiz completed but no corresponding study plan task found"
            }
            
    except Exception as e:
        logger.error(f"Error marking quiz as completed: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark quiz as completed: {str(e)}"
        )

