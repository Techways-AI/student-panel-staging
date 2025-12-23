from fastapi import APIRouter, HTTPException, Depends
from app.api.auth import get_current_user
from app.models.user import User
from app.models.model_paper_predictions import ModelPaperPredictions
from app.utils.subscription_utils import should_lock_content
from sqlalchemy.orm import Session
from app.db.session import get_db
import logging
from pydantic import BaseModel
import json
from typing import Optional
from app.services.analytics.posthog_client import capture_event, is_enabled

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

def parse_markdown_questions(markdown_text: str) -> list:
    """
    Parse markdown text containing questions and convert to structured format.
    """
    questions = []
    lines = markdown_text.split('\n')
    current_question = None
    current_type = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Detect question type headers
        if line.startswith('### Long Answer Questions'):
            current_type = 'long_answer'
            continue
        elif line.startswith('### Short Answer Questions'):
            current_type = 'short_answer'
            continue
        elif line.startswith('### Very Short Answer Questions'):
            current_type = 'very_short_answer'
            continue
            
        # Detect numbered questions
        if line and line[0].isdigit() and '. ' in line:
            # Save previous question if exists
            if current_question:
                questions.append(current_question)
            
            # Extract question text
            question_text = line.split('. ', 1)[1] if '. ' in line else line
            
            # Determine marks based on question type
            marks = 5  # default
            if current_type == 'long_answer':
                marks = 10
            elif current_type == 'short_answer':
                marks = 5
            elif current_type == 'very_short_answer':
                marks = 2
                
            current_question = {
                "question": question_text,
                "question_type": current_type or "short_answer",
                "marks": marks,
                "answer": f"Answer for: {question_text}",
                "explanation": f"Explanation for: {question_text}"
            }
    
    # Add the last question
    if current_question:
        questions.append(current_question)
    
    logger.info(f"Parsed {len(questions)} questions from markdown text")
    return questions

class ModelPaperRequest(BaseModel):
    subject: str
    year: int
    semester: int
    topic: str = "General"

class ModelPaperResponse(BaseModel):
    subject: str
    topic: str
    questions: list
    answers: list
    total_questions: int
    time_limit: int
    difficulty: str
    paper_type: str = "Model Paper"
    instructions: str = "This is a comprehensive model paper with exam-style questions. Read each question carefully and select the best answer."

class PredictedQuestionsRequest(BaseModel):
    year: int
    semester: int
    subject: str

class PredictedQuestionsResponse(BaseModel):
    subject: str
    year: int
    semester: int
    predicted_questions: list
    total_questions: int
    status: str
    created_at: str

@router.post('/generate', response_model=ModelPaperResponse)
async def generate_model_paper(
    request: ModelPaperRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate a model paper from predicted questions in the database based on subject, year, and semester.
    Returns questions and answers from the model_paper_predictions table.
    """
    try:
        # Check subscription status for access control
        if should_lock_content(current_user):
            logger.info(f"Model paper access denied for user {current_user.mobile} - free trial expired")
            _track_event(
                current_user.id,
                "model_paper_access_denied",
                {
                    "subject": request.subject,
                    "year": request.year,
                    "semester": request.semester,
                    "reason": "trial_expired",
                },
            )
            raise HTTPException(
                status_code=403,
                detail="Your free trial has expired. Upgrade to premium to access exam preparation materials."
            )
        
        logger.info(f"Starting model paper generation for: {request.subject}, Year: {request.year}, Semester: {request.semester}")
        logger.info(f"User {current_user.mobile} subscription status: {current_user.subscription_status}")
        
        # Convert year and semester to string for database query
        year_str = str(request.year)
        semester_str = str(request.semester)
        
        # Try different subject name formats for matching
        subject_variations = [
            request.subject,  # Original format: "Human Anatomy and Physiology I (PS101)"
            request.subject.replace(" (PS101)", ""),  # "Human Anatomy and Physiology I"
            request.subject.replace(" (PS101)", "").replace(" (PS102)", "").replace(" (PS103)", "").replace(" (PS104)", "").replace(" (PS201)", "").replace(" (PS202)", "").replace(" (BS203)", "").replace(" (BS204)", ""),  # Remove all course codes
            f"PS101: {request.subject.replace(' (PS101)', '')}",  # "PS101: Human Anatomy and Physiology I"
            f"PS102: {request.subject.replace(' (PS102)', '')}",  # "PS102: Pharmaceutical Analysis I"
            f"PS103: {request.subject.replace(' (PS103)', '')}",  # "PS103: Pharmaceutics"
            f"PS104: {request.subject.replace(' (PS104)', '')}",  # "PS104: Pharmaceutical Inorganic Chemistry"
            f"PS201: {request.subject.replace(' (PS201)', '')}",  # "PS201: Human Anatomy and Physiology II"
            f"PS202: {request.subject.replace(' (PS202)', '')}",  # "PS202: Pharmaceutical Organic Chemistry-I"
            f"BS203: {request.subject.replace(' (BS203)', '')}",  # "BS203: Biochemistry"
            f"BS204: {request.subject.replace(' (BS204)', '')}",  # "BS204: Pathophysiology"
        ]
        
        # Remove duplicates while preserving order
        seen = set()
        unique_variations = []
        for variation in subject_variations:
            if variation not in seen:
                seen.add(variation)
                unique_variations.append(variation)
        
        logger.info(f"Trying subject variations for model paper: {unique_variations}")
        
        # Query the model_paper_predictions table with multiple subject variations
        prediction_record = None
        for subject_variation in unique_variations:
            prediction_record = db.query(ModelPaperPredictions).filter(
                ModelPaperPredictions.year == year_str,
                ModelPaperPredictions.semester == semester_str,
                ModelPaperPredictions.subject == subject_variation
            ).first()
            
            if prediction_record:
                logger.info(f"Found prediction record with subject variation: {subject_variation}")
                break
        
        if not prediction_record:
            logger.warning(f"No predicted questions found for {request.subject}, Year {request.year}, Semester {request.semester}")
            _track_event(
                current_user.id,
                "model_paper_not_found",
                {
                    "subject": request.subject,
                    "year": request.year,
                    "semester": request.semester,
                },
            )
            raise HTTPException(
                status_code=404, 
                detail=f"No model paper available for {request.subject}. Predicted questions need to be generated first."
            )
        
        # Parse the predicted_questions from the text field
        predicted_questions = []
        if prediction_record.predicted_questions:
            try:
                # First try to parse as JSON
                try:
                    parsed_data = json.loads(prediction_record.predicted_questions)
                    if isinstance(parsed_data, list):
                        predicted_questions = parsed_data
                    else:
                        predicted_questions = []
                except json.JSONDecodeError:
                    # If not JSON, treat as markdown text and parse it
                    logger.info("Predicted questions is not JSON, parsing as markdown text")
                    predicted_questions = parse_markdown_questions(prediction_record.predicted_questions)
                    
            except Exception as e:
                logger.error(f"Error parsing predicted_questions: {e}")
                predicted_questions = []
        
        if not predicted_questions:
            logger.warning(f"No questions found in prediction record for {request.subject}")
            raise HTTPException(
                status_code=404, 
                detail=f"No questions available in the model paper for {request.subject}"
            )
        
        logger.info(f"Found {len(predicted_questions)} predicted questions for {request.subject}")
        
        # Format questions and answers from predicted questions
        questions = []
        answers = []
        
        for i, q_data in enumerate(predicted_questions):
            # Format question with number and type
            question_text = f"{i + 1}. {q_data.get('question', q_data.get('text', ''))}"
            question_type = q_data.get("question_type", "multiple_choice")
            marks = q_data.get("marks", 5)
            
            questions.append({
                "question": question_text,
                "question_type": question_type,
                "marks": marks,
                "question_number": i + 1
            })
            
            # Create answer from predicted data
            answer_text = q_data.get("answer", "Answer not available")
            explanation = q_data.get("explanation", "")
            key_points = []
            
            # Extract key points from explanation if available
            if explanation:
                # Simple key points extraction - split by sentences or bullet points
                if "•" in explanation:
                    key_points = [point.strip() for point in explanation.split("•") if point.strip()]
                elif "." in explanation:
                    sentences = [s.strip() for s in explanation.split(".") if s.strip()]
                    key_points = sentences[:3]  # Take first 3 sentences as key points
                else:
                    key_points = [explanation]
            
            answers.append({
                "question": question_text,
                "answer": answer_text,
                "key_points": key_points,
                "question_number": i + 1,
                "question_type": question_type,
                "marks": marks
            })
        
        model_paper = {
            "questions": questions,
            "answers": answers,
            "total_questions": len(questions),
            "time_limit": 90,  # 90 minutes for comprehensive model paper
            "difficulty": "Advanced",
            "paper_type": "Model Paper",
            "instructions": "This is a comprehensive model paper with exam-style questions. Read each question carefully and select the best answer."
        }
        
        logger.info(f"Generated model paper with {len(questions)} questions from predicted questions")

        _track_event(
            current_user.mobile,  # Use mobile number as distinct_id instead of user.id
            "model_paper_generated",
            {
                "subject": request.subject,
                "year": request.year,
                "semester": request.semester,
                "questions": len(questions),
                "prediction_record_id": prediction_record.id,
                "user_id": current_user.id,  # Include user_id in properties for reference
            },
        )

        return ModelPaperResponse(
            subject=request.subject,
            topic=request.topic,
            questions=model_paper["questions"],
            answers=model_paper["answers"],
            total_questions=model_paper["total_questions"],
            time_limit=model_paper["time_limit"],
            difficulty=model_paper["difficulty"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating model paper: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        _track_event(
            current_user.mobile,  # Use mobile number as distinct_id instead of user.id
            "model_paper_generate_failed",
            {
                "subject": request.subject,
                "year": request.year,
                "semester": request.semester,
                "error": str(e),
                "user_id": current_user.id,  # Include user_id in properties for reference
            },
        )
        raise HTTPException(status_code=500, detail=f"Failed to generate model paper: {str(e)}")

@router.get('/available-subjects')
async def get_available_subjects(
    current_user: User = Depends(get_current_user)
):
    """
    Get list of available subjects that have model papers
    """
    try:
        # Return a list of subjects that are available in the question bank
        # This is a simplified version - you can expand this based on your question bank
        available_subjects = [
            "Human Anatomy and Physiology I (PS101)",
            "Pharmaceutical Analysis I (PS102)",
            "Pharmaceutics (PS103)",
            "Pharmaceutical Inorganic Chemistry (PS104)",
            "Human Anatomy and Physiology II (PS201)",
            "Pharmaceutical Organic Chemistry-I (PS202)",
            "Biochemistry (BS203)",
            "Pathophysiology (BS204)"
        ]
        
        return {
            "available_subjects": available_subjects,
            "total_subjects": len(available_subjects)
        }
        
    except Exception as e:
        logger.error(f"Error getting available subjects: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get available subjects: {str(e)}")

@router.post('/predicted-questions', response_model=PredictedQuestionsResponse)
async def get_predicted_questions(
    request: PredictedQuestionsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get predicted questions from model_paper_predictions table based on year, semester, and subject.
    """
    try:
        # Check subscription status for access control
        if should_lock_content(current_user):
            logger.info(f"Predicted questions access denied for user {current_user.mobile} - free trial expired")
            _track_event(
                current_user.mobile,  # Use mobile number as distinct_id instead of user.id
                "predicted_questions_access_denied",
                {
                    "subject": request.subject,
                    "year": request.year,
                    "semester": request.semester,
                    "reason": "trial_expired",
                    "user_id": current_user.id,  # Include user_id in properties for reference
                },
            )
            raise HTTPException(
                status_code=403,
                detail="Your free trial has expired. Upgrade to premium to access exam preparation materials."
            )
        
        logger.info(f"Fetching predicted questions for: {request.subject}, Year: {request.year}, Semester: {request.semester}")
        logger.info(f"User {current_user.mobile} subscription status: {current_user.subscription_status}")
        
        # Convert year and semester to string for database query
        year_str = str(request.year)
        semester_str = str(request.semester)
        
        # Try different subject name formats for matching
        subject_variations = [
            request.subject,  # Original format: "Human Anatomy and Physiology I (PS101)"
            request.subject.replace(" (PS101)", ""),  # "Human Anatomy and Physiology I"
            request.subject.replace(" (PS101)", "").replace(" (PS102)", "").replace(" (PS103)", "").replace(" (PS104)", "").replace(" (PS201)", "").replace(" (PS202)", "").replace(" (BS203)", "").replace(" (BS204)", ""),  # Remove all course codes
            f"PS101: {request.subject.replace(' (PS101)', '')}",  # "PS101: Human Anatomy and Physiology I"
            f"PS102: {request.subject.replace(' (PS102)', '')}",  # "PS102: Pharmaceutical Analysis I"
            f"PS103: {request.subject.replace(' (PS103)', '')}",  # "PS103: Pharmaceutics"
            f"PS104: {request.subject.replace(' (PS104)', '')}",  # "PS104: Pharmaceutical Inorganic Chemistry"
            f"PS201: {request.subject.replace(' (PS201)', '')}",  # "PS201: Human Anatomy and Physiology II"
            f"PS202: {request.subject.replace(' (PS202)', '')}",  # "PS202: Pharmaceutical Organic Chemistry-I"
            f"BS203: {request.subject.replace(' (BS203)', '')}",  # "BS203: Biochemistry"
            f"BS204: {request.subject.replace(' (BS204)', '')}",  # "BS204: Pathophysiology"
        ]
        
        # Remove duplicates while preserving order
        seen = set()
        unique_variations = []
        for variation in subject_variations:
            if variation not in seen:
                seen.add(variation)
                unique_variations.append(variation)
        
        logger.info(f"Trying subject variations: {unique_variations}")
        
        # Query the model_paper_predictions table with multiple subject variations
        prediction_record = None
        for subject_variation in unique_variations:
            prediction_record = db.query(ModelPaperPredictions).filter(
                ModelPaperPredictions.year == year_str,
                ModelPaperPredictions.semester == semester_str,
                ModelPaperPredictions.subject == subject_variation
            ).first()
            
            if prediction_record:
                logger.info(f"Found prediction record with subject variation: {subject_variation}")
                break
        
        if not prediction_record:
            logger.warning(f"No predicted questions found for {request.subject}, Year {request.year}, Semester {request.semester}")
            _track_event(
                current_user.mobile,  # Use mobile number as distinct_id instead of user.id
                "predicted_questions_not_found",
                {
                    "subject": request.subject,
                    "year": request.year,
                    "semester": request.semester,
                    "user_id": current_user.id,  # Include user_id in properties for reference
                },
            )
            raise HTTPException(
                status_code=404, 
                detail=f"No predicted questions found for {request.subject} (Year {request.year}, Semester {request.semester})"
            )
        
        # Parse the predicted_questions from the text field
        predicted_questions = []
        if prediction_record.predicted_questions:
            try:
                # First try to parse as JSON
                try:
                    parsed_data = json.loads(prediction_record.predicted_questions)
                    if isinstance(parsed_data, list):
                        predicted_questions = parsed_data
                    else:
                        predicted_questions = []
                except json.JSONDecodeError:
                    # If not JSON, treat as markdown text and parse it
                    logger.info("Predicted questions is not JSON, parsing as markdown text")
                    predicted_questions = parse_markdown_questions(prediction_record.predicted_questions)
                    
            except Exception as e:
                logger.error(f"Error parsing predicted_questions: {e}")
                predicted_questions = []
        
        logger.info(f"Found {len(predicted_questions)} predicted questions for {request.subject}")

        _track_event(
            current_user.mobile,  # Use mobile number as distinct_id instead of user.id
            "predicted_questions_retrieved",
            {
                "subject": prediction_record.subject,
                "year": request.year,
                "semester": request.semester,
                "question_count": len(predicted_questions),
                "prediction_record_id": prediction_record.id,
                "user_id": current_user.id,  # Include user_id in properties for reference
            },
        )

        return PredictedQuestionsResponse(
            subject=prediction_record.subject,
            year=request.year,
            semester=request.semester,
            predicted_questions=predicted_questions,
            total_questions=len(predicted_questions),
            status=prediction_record.status or "completed",
            created_at=prediction_record.created_at.isoformat() if prediction_record.created_at else ""
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching predicted questions: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        _track_event(
            current_user.mobile,  # Use mobile number as distinct_id instead of user.id
            "predicted_questions_failed",
            {
                "subject": request.subject,
                "year": request.year,
                "semester": request.semester,
                "error": str(e),
                "user_id": current_user.id,  # Include user_id in properties for reference
            },
        )
        raise HTTPException(status_code=500, detail=f"Failed to fetch predicted questions: {str(e)}")

@router.get('/check-availability-batch/{year}/{semester}')
async def check_model_paper_availability_batch(
    year: int,
    semester: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check model paper availability for all subjects in a given year and semester.
    Returns a list of subjects with their availability status.
    """
    try:
        logger.info(f"Checking model paper availability batch: Year: {year}, Semester: {semester}")
        
        # Convert year and semester to string for database query
        year_str = str(year)
        semester_str = str(semester)
        
        # Get all records for this year and semester
        prediction_records = db.query(ModelPaperPredictions).filter(
            ModelPaperPredictions.year == year_str,
            ModelPaperPredictions.semester == semester_str
        ).all()
        
        logger.info(f"Found {len(prediction_records)} prediction records for Year {year}, Semester {semester}")
        
        # Process each record to check availability
        availability_results = []
        for record in prediction_records:
            # Check if the record has valid predicted questions
            has_questions = False
            if record.predicted_questions:
                try:
                    # Try to parse as JSON first
                    try:
                        parsed_data = json.loads(record.predicted_questions)
                        has_questions = isinstance(parsed_data, list) and len(parsed_data) > 0
                    except json.JSONDecodeError:
                        # If not JSON, check if it's non-empty text
                        has_questions = len(record.predicted_questions.strip()) > 0
                except Exception as e:
                    logger.error(f"Error checking predicted_questions content for {record.subject}: {e}")
                    has_questions = False
            
            availability_results.append({
                "subject": record.subject,
                "available": has_questions,
                "status": record.status or "completed",
                "created_at": record.created_at.isoformat() if record.created_at else "",
                "course_name": record.course_name,
                "model_paper_id": record.model_paper_id
            })
        
        logger.info(f"Processed {len(availability_results)} subjects for availability check")
        
        return {
            "year": year,
            "semester": semester,
            "total_subjects": len(availability_results),
            "available_subjects": len([r for r in availability_results if r["available"]]),
            "subjects": availability_results
        }
        
    except Exception as e:
        logger.error(f"Error checking model paper availability batch: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to check model paper availability batch: {str(e)}")

@router.get('/check-availability/{year}/{semester}/{subject}')
async def check_model_paper_availability(
    year: int,
    semester: int,
    subject: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check if model paper exists in database for given year, semester, and subject.
    Returns availability status without fetching the full data.
    """
    try:
        logger.info(f"Checking model paper availability: {subject}, Year: {year}, Semester: {semester}")
        
        # Convert year and semester to string for database query
        year_str = str(year)
        semester_str = str(semester)
        
        # Try different subject name formats for matching
        subject_variations = [
            subject,  # Original format: "Human Anatomy and Physiology I (PS101)"
            subject.replace(" (PS101)", ""),  # "Human Anatomy and Physiology I"
            subject.replace(" (PS101)", "").replace(" (PS102)", "").replace(" (PS103)", "").replace(" (PS104)", "").replace(" (PS201)", "").replace(" (PS202)", "").replace(" (BS203)", "").replace(" (BS204)", ""),  # Remove all course codes
            f"PS101: {subject.replace(' (PS101)', '')}",  # "PS101: Human Anatomy and Physiology I"
            f"PS102: {subject.replace(' (PS102)', '')}",  # "PS102: Pharmaceutical Analysis I"
            f"PS103: {subject.replace(' (PS103)', '')}",  # "PS103: Pharmaceutics"
            f"PS104: {subject.replace(' (PS104)', '')}",  # "PS104: Pharmaceutical Inorganic Chemistry"
            f"PS201: {subject.replace(' (PS201)', '')}",  # "PS201: Human Anatomy and Physiology II"
            f"PS202: {subject.replace(' (PS202)', '')}",  # "PS202: Pharmaceutical Organic Chemistry-I"
            f"BS203: {subject.replace(' (BS203)', '')}",  # "BS203: Biochemistry"
            f"BS204: {subject.replace(' (BS204)', '')}",  # "BS204: Pathophysiology"
        ]
        
        # Remove duplicates while preserving order
        seen = set()
        unique_variations = []
        for variation in subject_variations:
            if variation not in seen:
                seen.add(variation)
                unique_variations.append(variation)
        
        logger.info(f"Checking subject variations: {unique_variations}")
        
        # Query the model_paper_predictions table with multiple subject variations
        prediction_record = None
        matched_subject = None
        for subject_variation in unique_variations:
            prediction_record = db.query(ModelPaperPredictions).filter(
                ModelPaperPredictions.year == year_str,
                ModelPaperPredictions.semester == semester_str,
                ModelPaperPredictions.subject == subject_variation
            ).first()
            
            if prediction_record:
                logger.info(f"Found prediction record with subject variation: {subject_variation}")
                matched_subject = subject_variation
                break
        
        if not prediction_record:
            logger.info(f"No model paper found for {subject}, Year {year}, Semester {semester}")
            return {
                "available": False,
                "subject": subject,
                "year": year,
                "semester": semester,
                "message": f"No model paper available for {subject} (Year {year}, Semester {semester})"
            }
        
        # Check if the record has valid predicted questions
        has_questions = False
        if prediction_record.predicted_questions:
            try:
                # Try to parse as JSON first
                try:
                    parsed_data = json.loads(prediction_record.predicted_questions)
                    has_questions = isinstance(parsed_data, list) and len(parsed_data) > 0
                except json.JSONDecodeError:
                    # If not JSON, check if it's non-empty text
                    has_questions = len(prediction_record.predicted_questions.strip()) > 0
            except Exception as e:
                logger.error(f"Error checking predicted_questions content: {e}")
                has_questions = False
        
        if not has_questions:
            logger.info(f"Model paper record exists but has no questions for {subject}")
            return {
                "available": False,
                "subject": subject,
                "year": year,
                "semester": semester,
                "message": f"Model paper record exists but contains no questions for {subject}"
            }
        
        logger.info(f"Model paper is available for {subject} with {len(prediction_record.predicted_questions)} characters of content")
        
        return {
            "available": True,
            "subject": matched_subject,
            "year": year,
            "semester": semester,
            "status": prediction_record.status or "completed",
            "created_at": prediction_record.created_at.isoformat() if prediction_record.created_at else "",
            "message": f"Model paper is available for {matched_subject}"
        }
        
    except Exception as e:
        logger.error(f"Error checking model paper availability: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to check model paper availability: {str(e)}")

@router.get('/predicted-questions/{year}/{semester}/{subject}')
async def get_predicted_questions_by_path(
    year: int,
    semester: int,
    subject: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get predicted questions using path parameters for easier frontend integration.
    """
    try:
        logger.info(f"Fetching predicted questions via path: {subject}, Year: {year}, Semester: {semester}")
        
        # Convert year and semester to string for database query
        year_str = str(year)
        semester_str = str(semester)
        
        # Try different subject name formats for matching
        subject_variations = [
            subject,  # Original format: "Human Anatomy and Physiology I (PS101)"
            subject.replace(" (PS101)", ""),  # "Human Anatomy and Physiology I"
            subject.replace(" (PS101)", "").replace(" (PS102)", "").replace(" (PS103)", "").replace(" (PS104)", "").replace(" (PS201)", "").replace(" (PS202)", "").replace(" (BS203)", "").replace(" (BS204)", ""),  # Remove all course codes
            f"PS101: {subject.replace(' (PS101)', '')}",  # "PS101: Human Anatomy and Physiology I"
            f"PS102: {subject.replace(' (PS102)', '')}",  # "PS102: Pharmaceutical Analysis I"
            f"PS103: {subject.replace(' (PS103)', '')}",  # "PS103: Pharmaceutics"
            f"PS104: {subject.replace(' (PS104)', '')}",  # "PS104: Pharmaceutical Inorganic Chemistry"
            f"PS201: {subject.replace(' (PS201)', '')}",  # "PS201: Human Anatomy and Physiology II"
            f"PS202: {subject.replace(' (PS202)', '')}",  # "PS202: Pharmaceutical Organic Chemistry-I"
            f"BS203: {subject.replace(' (BS203)', '')}",  # "BS203: Biochemistry"
            f"BS204: {subject.replace(' (BS204)', '')}",  # "BS204: Pathophysiology"
        ]
        
        # Remove duplicates while preserving order
        seen = set()
        unique_variations = []
        for variation in subject_variations:
            if variation not in seen:
                seen.add(variation)
                unique_variations.append(variation)
        
        logger.info(f"Trying subject variations: {unique_variations}")
        
        # Query the model_paper_predictions table with multiple subject variations
        prediction_record = None
        for subject_variation in unique_variations:
            prediction_record = db.query(ModelPaperPredictions).filter(
                ModelPaperPredictions.year == year_str,
                ModelPaperPredictions.semester == semester_str,
                ModelPaperPredictions.subject == subject_variation
            ).first()
            
            if prediction_record:
                logger.info(f"Found prediction record with subject variation: {subject_variation}")
                break
        
        if not prediction_record:
            logger.warning(f"No predicted questions found for {subject}, Year {year}, Semester {semester}")
            raise HTTPException(
                status_code=404, 
                detail=f"No predicted questions found for {subject} (Year {year}, Semester {semester})"
            )
        
        # Parse the predicted_questions from the text field
        predicted_questions = []
        if prediction_record.predicted_questions:
            try:
                # First try to parse as JSON
                try:
                    parsed_data = json.loads(prediction_record.predicted_questions)
                    if isinstance(parsed_data, list):
                        predicted_questions = parsed_data
                    else:
                        predicted_questions = []
                except json.JSONDecodeError:
                    # If not JSON, treat as markdown text and parse it
                    logger.info("Predicted questions is not JSON, parsing as markdown text")
                    predicted_questions = parse_markdown_questions(prediction_record.predicted_questions)
                    
            except Exception as e:
                logger.error(f"Error parsing predicted_questions: {e}")
                predicted_questions = []
        
        logger.info(f"Found {len(predicted_questions)} predicted questions for {subject}")
        
        return {
            "subject": prediction_record.subject,
            "year": year,
            "semester": semester,
            "predicted_questions": predicted_questions,
            "total_questions": len(predicted_questions),
            "status": prediction_record.status or "completed",
            "created_at": prediction_record.created_at.isoformat() if prediction_record.created_at else "",
            "course_name": prediction_record.course_name,
            "model_paper_id": prediction_record.model_paper_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching predicted questions: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch predicted questions: {str(e)}") 

