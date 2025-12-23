from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.models.feedback import Feedback
from app.schemas.feedback import FeedbackCreate, FeedbackResponse
from app.api.auth import get_current_user, require_student
import logging

logger = logging.getLogger(__name__)

# Create router with student role requirement
router = APIRouter(
    dependencies=[Depends(require_student)]  # 🔐 REQUIRES STUDENT ROLE
)

@router.post("/", response_model=FeedbackResponse)
async def create_feedback(
    feedback: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new feedback entry for an AI response
    """
    try:
        # Create new feedback record
        db_feedback = Feedback(
            user_id=current_user.id,
            question=feedback.question,
            ai_response=feedback.ai_response,
            feedback_text=feedback.feedback_text
        )
        
        db.add(db_feedback)
        db.commit()
        db.refresh(db_feedback)
        
        logger.info(f"Feedback created by user {current_user.mobile} for question: {feedback.question[:50]}...")
        
        return FeedbackResponse(
            id=db_feedback.id,
            user_id=db_feedback.user_id,
            question=db_feedback.question,
            ai_response=db_feedback.ai_response,
            feedback_text=db_feedback.feedback_text,
            created_at=db_feedback.created_at
        )
        
    except Exception as e:
        logger.error(f"Error creating feedback: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save feedback")

@router.post("/submit", response_model=FeedbackResponse)
async def submit_feedback(
    feedback: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submit feedback for an AI response (same as create_feedback but with /submit endpoint)
    """
    try:
        # Create new feedback record
        db_feedback = Feedback(
            user_id=current_user.id,
            question=feedback.question,
            ai_response=feedback.ai_response,
            feedback_text=feedback.feedback_text
        )
        
        db.add(db_feedback)
        db.commit()
        db.refresh(db_feedback)
        
        logger.info(f"Feedback submitted by user {current_user.mobile} for question: {feedback.question[:50]}...")
        
        return FeedbackResponse(
            id=db_feedback.id,
            user_id=db_feedback.user_id,
            question=db_feedback.question,
            ai_response=db_feedback.ai_response,
            feedback_text=db_feedback.feedback_text,
            created_at=db_feedback.created_at
        )
        
    except Exception as e:
        logger.error(f"Error submitting feedback: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save feedback")

@router.get("/", response_model=list[FeedbackResponse])
async def get_user_feedback(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all feedback entries for the current user (admin only)
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view feedback")
    
    try:
        feedbacks = db.query(Feedback).filter(Feedback.user_id == current_user.id).all()
        return [
            FeedbackResponse(
                id=f.id,
                user_id=f.user_id,
                question=f.question,
                ai_response=f.ai_response,
                feedback_text=f.feedback_text,
                created_at=f.created_at
            ) for f in feedbacks
        ]
    except Exception as e:
        logger.error(f"Error fetching feedback: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch feedback")

@router.get("/recent-doubts", response_model=list[str])
async def get_recent_doubts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the latest 5 questions (doubts) asked by the current user.
    Returns an empty list if the user has not asked any.
    """
    try:
        recent_feedbacks = (
            db.query(Feedback)
            .filter(Feedback.user_id == current_user.id)
            .order_by(Feedback.created_at.desc())
            .limit(5)
            .all()
        )
        return [f.question for f in recent_feedbacks]
    except Exception as e:
        logger.error(f"Error fetching recent doubts: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch recent doubts") 

