from fastapi import APIRouter, HTTPException, Depends, Request, status, Header
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from app.api.auth import get_current_user
from app.models.user import User
from app.models.ai_query_history import AIQueryHistory
from app.models.ai_daily_usage import AIDailyUsage
from sqlalchemy.orm import Session
from app.db.session import get_db
import logging
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import os
import datetime
from app.core.config import settings
from app.utils.header_sanitizer import sanitize_headers, create_safe_auth_header, validate_headers_for_grpc, sanitize_header_value
from app.utils.subscription_utils import should_lock_content

logger = logging.getLogger(__name__)

router = APIRouter()

"""Authentication helpers for AI endpoints."""

# Dual authentication function that accepts both JWT and API keys
async def get_dual_auth_user(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Dual authentication: accepts either JWT token or API key.

    This keeps existing behavior: API key requests are authenticated as a special
    "api" user, while JWT-only requests return a real User from the database.
    """
    # Try API key first (preserve existing behavior)
    if x_api_key:
        logger.info("🔑 API key authentication attempt")
        logger.info(f"🔑 Received API key: {x_api_key[:20]}...{x_api_key[-20:] if len(x_api_key) > 40 else ''}")
        logger.info(f"🔑 Expected API key: {settings.SME_PANEL_API_KEY[:20] if settings.SME_PANEL_API_KEY else 'NOT SET'}...{settings.SME_PANEL_API_KEY[-20:] if settings.SME_PANEL_API_KEY and len(settings.SME_PANEL_API_KEY) > 40 else ''}")
        logger.info(f"🔑 API key length comparison: received={len(x_api_key)}, expected={len(settings.SME_PANEL_API_KEY) if settings.SME_PANEL_API_KEY else 0}")

        # Check if API key matches the configured one
        if x_api_key == settings.SME_PANEL_API_KEY:
            logger.info("✅ API key authentication successful")
            # Return a mock user for API key requests
            return {
                "mobile": "api_user",
                "role": "api",
                "id": "api_user_id",
            }
        else:
            logger.error("❌ Invalid API key")
            logger.error(f"❌ Key mismatch: received='{x_api_key}' vs expected='{settings.SME_PANEL_API_KEY}'")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # Try JWT token if no API key
    if authorization and authorization.startswith("Bearer "):
        logger.info("🔐 JWT authentication attempt")
        try:
            token = authorization.split(" ", 1)[1]

            # Sanitize the token to prevent gRPC errors
            sanitized_token = sanitize_header_value(token)
            if not sanitized_token:
                logger.error("Token is empty after sanitization")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token format",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            payload = jwt.decode(
                sanitized_token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
            user_mobile = payload.get("sub")
            if not user_mobile:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Get user from database by mobile (matches auth.py behavior)
            user = db.query(User).filter(User.mobile == user_mobile).first()
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            logger.info("✅ JWT authentication successful")
            return user

        except JWTError:
            logger.error("❌ JWT validation failed")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # No valid authentication found
    logger.error("❌ No valid authentication provided")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )

# Health check endpoint for AI service
@router.get("/health")
async def ai_health_check():
    """Health check endpoint for AI service"""
    return {
        "status": "healthy",
        "service": "ai",
        "endpoints": {
            "ask": "/api/ai/ask",
            "suggest-prompts": "/api/ai/suggest-prompts"
        },
        "timestamp": str(datetime.datetime.now())
    }

# JWT settings
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user_from_token(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload  # You can extract user info here if needed
    except JWTError:
        raise credentials_exception


def get_user_from_authorization_header(authorization: Optional[str], db: Session) -> Optional[User]:
    """Best-effort helper to resolve a real User from an Authorization header.

    This is used only for storing AI query history for browser-originated
    API key requests that also include a valid JWT. It does not affect
    authentication/authorization decisions.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None

    try:
        token = authorization.split(" ", 1)[1]
        sanitized_token = sanitize_header_value(token)
        if not sanitized_token:
            return None

        payload = jwt.decode(
            sanitized_token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        mobile = payload.get("sub")
        if not mobile:
            return None

        user = db.query(User).filter(User.mobile == mobile).first()
        return user
    except Exception as e:
        logger.error(f"❌ Failed to resolve user from Authorization header for AI history: {str(e)}")
        return None

def store_ai_query(
    db: Session,
    user_id: int,
    query_text: str,
    source: str = "ai_tutor",
    document_id: Optional[str] = None,
    topic: Optional[str] = None,
    year: Optional[str] = None,
    semester: Optional[str] = None
):
    """
    Store AI query in history and maintain only last 5 queries per user.
    This runs after successful AI response.
    """
    try:
        # Create new query record
        new_query = AIQueryHistory(
            user_id=user_id,
            query_text=query_text,
            source=source,
            document_id=document_id,
            topic=topic,
            year=year,
            semester=semester,
            created_at=datetime.datetime.utcnow()
        )
        db.add(new_query)
        db.flush()  # Get the ID without committing
        
        # Get count of queries for this user
        query_count = db.query(AIQueryHistory).filter(
            AIQueryHistory.user_id == user_id
        ).count()
        
        # If more than 5, delete the oldest ones
        if query_count > 5:
            # Get oldest queries to delete (keep only 5 most recent)
            queries_to_delete = db.query(AIQueryHistory).filter(
                AIQueryHistory.user_id == user_id
            ).order_by(AIQueryHistory.created_at.asc()).limit(query_count - 5).all()
            
            for query in queries_to_delete:
                db.delete(query)
        
        db.commit()
        logger.info(f"✅ Stored AI query for user {user_id}: '{query_text[:50]}...'")
        
    except Exception as e:
        logger.error(f"❌ Error storing AI query: {str(e)}")
        db.rollback()
        # Don't raise - query storage failure shouldn't break the AI response

def generate_local_ai_response(question, document_id=None, year=None, semester=None, unit=None, topic=None, metadata_filter=None):
    """Generate AI response locally"""
    # You can implement your local AI logic here
    # For now, returning a placeholder response
    
    # Build context-aware response
    context_parts = []
    if document_id:
        context_parts.append(f"Document: {document_id}")
    if year:
        context_parts.append(f"Year: {year}")
    if semester:
        context_parts.append(f"Semester: {semester}")
    if unit:
        context_parts.append(f"Unit: {unit}")
    if topic:
        context_parts.append(f"Topic: {topic}")
    
    # Create a more informative response based on context
    if document_id:
        response = {
            "answer": f"I'm analyzing the document (ID: {document_id}) to answer your question: '{question}'. This is a local fallback response while the main AI service is being configured.",
            "sources": [f"Document: {document_id}"],
            "confidence": 0.7
        }
    else:
        response = {
            "answer": f"Local AI response to: {question}",
            "sources": [],
            "confidence": 0.5
        }
    
    # Add context information if provided
    if context_parts:
        response["answer"] += f" | Context: {', '.join(context_parts)}"
    
    return response

class AIAskRequest(BaseModel):
    question: str
    document_id: Optional[str] = None
    year: Optional[str] = None
    semester: Optional[str] = None
    unit: Optional[str] = None
    topic: Optional[str] = None
    metadata_filter: Optional[Dict[str, Any]] = None
    use_cache: Optional[bool] = True

class AIAskResponse(BaseModel):
    answer: str
    sources: Optional[list] = None
    confidence: Optional[float] = None

class AISuggestPromptsRequest(BaseModel):
    topic: str = None
    fileName: str = None
    document_id: str = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "topic": "Pharmacology",
                "fileName": "Introduction_to_Pharmacology.pdf",
                "document_id": "doc_12345"
            },
            "description": "Request model for generating context-aware prompt suggestions. At least one of topic, fileName, or document_id should be provided for best results."
        }

class AISuggestPromptsResponse(BaseModel):
    prompts: list[str]
    count: int
    context: dict
    
    class Config:
        json_schema_extra = {
            "example": {
                "prompts": [
                    "What would you like to know about Pharmacology?",
                    "How can I help you understand this material better?",
                    "What questions do you have about this content?"
                ],
                "count": 3,
                "context": {
                    "topic": "Pharmacology",
                    "fileName": "Introduction_to_Pharmacology.pdf",
                    "document_id": "doc_12345",
                    "source": "sme_panel"
                }
            },
            "description": "Response model containing prompt suggestions fetched from the SME panel based on the provided context."
        }

def student_or_sme(current_user: User = Depends(get_dual_auth_user)):
    """Require that the user has student, admin, or SME role, or is an API user"""
    # Check if this is an API key request
    if isinstance(current_user, dict) and current_user.get("role") == "api":
        logger.info("✅ API key user authenticated - allowing access")
        return current_user
    
    # For JWT users, check their role
    if current_user.role not in {"student", "admin", "sme"}:
        raise HTTPException(status_code=403, detail="Forbidden: Only students, SMEs, and API users can access this endpoint")
    return current_user

@router.post("/ask", response_model=AIAskResponse)
async def ask_ai(
    request: AIAskRequest,
    fastapi_request: Request,
    current_user: Any = Depends(get_dual_auth_user),
    db: Session = Depends(get_db),
):
    """
    Ask AI questions. Available to students, SMEs, and API key users.
    Stores the last 5 queries per user in history.
    """
    # Log user info and request details
    if isinstance(current_user, dict) and current_user.get("role") == "api":
        logger.info(f"AI question from API key user: {request.question}")
    else:
        logger.info(f"AI question from user {current_user.mobile} (role: {current_user.role}): {request.question}")
    
    # Log document context for debugging
    logger.info(f"Document context: document_id={request.document_id}, year={request.year}, semester={request.semester}, unit={request.unit}, topic={request.topic}")
    
    # Check subscription status for non-API users
    if not (isinstance(current_user, dict) and current_user.get("role") == "api"):
        # This is a regular user, check if their content should be locked
        if should_lock_content(current_user):
            logger.info(f"AI access denied for user {current_user.mobile} - free trial expired")
            raise HTTPException(
                status_code=403,
                detail="Your free trial has expired. Upgrade to premium to access the AI Tutor."
            )
    
    # Store query in history IMMEDIATELY (only for real users, not API key users)
    # This ensures the query is saved even if the AI response fails.
    #
    # Existing behavior: for JWT-authenticated users, we store directly via
    # current_user. For pure API-key requests (no JWT), we do NOT store.
    if not (isinstance(current_user, dict) and current_user.get("role") == "api"):
        store_ai_query(
            db=db,
            user_id=current_user.id,
            query_text=request.question,
            source="ai_tutor",
            document_id=request.document_id,
            topic=request.topic,
            year=request.year,
            semester=request.semester,
        )
        logger.info(f"💾 Query stored immediately for user {current_user.mobile}")
    else:
        # API key user: attempt to resolve a real user from Authorization header
        # so that browser-originated API key calls (which also send JWT) can
        # still have their queries stored in history without changing auth.
        auth_header = fastapi_request.headers.get("authorization") or fastapi_request.headers.get("Authorization")
        real_user = get_user_from_authorization_header(auth_header, db)
        if real_user:
            try:
                store_ai_query(
                    db=db,
                    user_id=real_user.id,
                    query_text=request.question,
                    source="ai_tutor",
                    document_id=request.document_id,
                    topic=request.topic,
                    year=request.year,
                    semester=request.semester,
                )
                logger.info(
                    f"💾 Query stored for API key + JWT user {real_user.mobile} (history only, auth unchanged)"
                )
            except Exception as e:
                # History write failure must never affect AI response
                logger.error(f"❌ Failed to store AI query for API key + JWT user: {str(e)}")
    
    try:
        # Import httpx here to avoid affecting other code
        import httpx
        
        # Prepare the request payload for SME panel
        sme_panel_payload = {
            'question': request.question,
            'document_id': request.document_id,
            'year': request.year,
            'semester': request.semester,
            'unit': request.unit,
            'topic': request.topic,
            'metadata_filter': request.metadata_filter or {}
        }
        
        logger.info(f"Forwarding request to SME panel at {settings.SME_PANEL_URL}/api/ai/ask")
        logger.info(f"SME panel payload: {sme_panel_payload}")
        
        # Call the SME panel's API with sanitized headers
        headers = {
            'X-API-Key': settings.SME_PANEL_API_KEY,
            'Content-Type': 'application/json'
        }
        
        # Sanitize headers to prevent gRPC errors
        sanitized_headers = sanitize_headers(headers)
        
        # Validate headers before making the request
        if not validate_headers_for_grpc(sanitized_headers):
            logger.error("Headers failed gRPC validation, using fallback")
            raise HTTPException(status_code=500, detail="Header validation failed")
        
        logger.info(f"Using sanitized headers: {sanitized_headers}")
        
        async with httpx.AsyncClient(timeout=settings.SME_PANEL_TIMEOUT) as client:
            response = await client.post(
                f"{settings.SME_PANEL_URL}/api/ai/ask",
                headers=sanitized_headers,
                json=sme_panel_payload
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Successfully fetched answer from SME panel for user {current_user.mobile if not isinstance(current_user, dict) else 'API key user'}")
                logger.info(f"SME panel response: {data}")
                
                # Query already stored immediately at the start of the function
                
                return AIAskResponse(
                    answer=data.get('answer', 'No answer received'),
                    sources=data.get('sources', []),
                    confidence=data.get('confidence', 0.0)
                )
            else:
                logger.error(f"SME panel API error: {response.status_code} - {response.text}")
                # Fallback to local response if SME panel fails
                if isinstance(current_user, dict) and current_user.get("role") == "api":
                    logger.info(f"Falling back to local AI response for API key user")
                else:
                    logger.info(f"Falling back to local AI response for user {current_user.mobile}")
                ai_response = generate_local_ai_response(
                    question=request.question,
                    document_id=request.document_id,
                    year=request.year,
                    semester=request.semester,
                    unit=request.unit,
                    topic=request.topic,
                    metadata_filter=request.metadata_filter or {}
                )
                
                # Query already stored immediately at the start of the function
                
                return AIAskResponse(
                    answer=ai_response["answer"],
                    sources=ai_response["sources"],
                    confidence=ai_response["confidence"]
                )
                
    except ImportError:
        logger.warning("httpx not available, using local AI response")
        # Fallback to local response if httpx is not available
        ai_response = generate_local_ai_response(
            question=request.question,
            document_id=request.document_id,
            year=request.year,
            semester=request.semester,
            unit=request.unit,
            topic=request.topic,
            metadata_filter=request.metadata_filter or {}
        )
        
        # Query already stored immediately at the start of the function
        
        return AIAskResponse(
            answer=ai_response["answer"],
            sources=ai_response["sources"],
            confidence=ai_response["confidence"]
        )
        
    except httpx.TimeoutException:
        if isinstance(current_user, dict) and current_user.get("role") == "api":
            logger.error(f"Timeout calling SME panel API for API key user")
        else:
            logger.error(f"Timeout calling SME panel API for user {current_user.mobile}")
        # Fallback to local response on timeout
        ai_response = generate_local_ai_response(
            question=request.question,
            document_id=request.document_id,
            year=request.year,
            semester=request.semester,
            unit=request.unit,
            topic=request.topic,
            metadata_filter=request.metadata_filter or {}
        )
        
        # Query already stored immediately at the start of the function
        
        return AIAskResponse(
            answer=ai_response["answer"],
            sources=ai_response["sources"],
            confidence=ai_response["confidence"]
        )
        
    except Exception as e:
        if isinstance(current_user, dict) and current_user.get("role") == "api":
            logger.error(f"Error calling SME panel API for API key user: {str(e)}")
        else:
            logger.error(f"Error calling SME panel API for user {current_user.mobile}: {str(e)}")
        # Fallback to local response on any error
        ai_response = generate_local_ai_response(
            question=request.question,
            document_id=request.document_id,
            year=request.year,
            semester=request.semester,
            unit=request.unit,
            topic=request.topic,
            metadata_filter=request.metadata_filter or {}
        )
        
        # Query already stored immediately at the start of the function
        
        return AIAskResponse(
            answer=ai_response["answer"],
            sources=ai_response["sources"],
            confidence=ai_response["confidence"]
        )

@router.post("/log-query")
async def log_ai_query(
    request: AIAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Log AI query from frontend to database.
    Separate endpoint for browser-based query logging.
    """
    try:
        store_ai_query(
            db=db,
            user_id=current_user.id,
            query_text=request.question,
            source="ask_ai",
            document_id=request.document_id,
            topic=request.topic,
            year=request.year,
            semester=request.semester,
        )
        logger.info(f"💾 Query logged via /log-query for user {current_user.mobile}: '{request.question[:50]}...'")
        return {"success": True, "message": "Query logged successfully"}
    except Exception as e:
        logger.error(f"❌ Failed to log query via /log-query: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to log query: {str(e)}"
        )

@router.post("/suggest-prompts", response_model=AISuggestPromptsResponse)
async def suggest_prompts(
    request: AISuggestPromptsRequest,
    current_user: Any = Depends(get_dual_auth_user)
):
    """
    Suggest prompt questions based on the document, topic, and filename.
    This endpoint fetches context-aware prompts from the SME panel.
    """
    # Log route hit for debugging
    logger.info(f"🎯 SUGGEST PROMPTS ENDPOINT HIT - Route: /api/ai/suggest-prompts")
    
    # Log user info and request details
    if isinstance(current_user, dict) and current_user.get("role") == "api":
        logger.info(f"🔑 Prompt suggestions request from API key user")
    else:
        logger.info(f"👤 Prompt suggestions request from user {current_user.mobile} (role: {current_user.role})")
    
    logger.info(f"📋 Request data: topic={request.topic}, fileName={request.fileName}, document_id={request.document_id}")
    
    # Log SME panel configuration for debugging
    logger.info(f"🔧 SME Panel Configuration:")
    logger.info(f"   - URL: {settings.SME_PANEL_URL}")
    logger.info(f"   - API Key: {settings.SME_PANEL_API_KEY[:20] if settings.SME_PANEL_API_KEY else 'NOT SET'}...")
    logger.info(f"   - Timeout: {settings.SME_PANEL_TIMEOUT}s")
    
    try:
        topic = (request.topic or "").strip()
        document_id = (request.document_id or "").strip()
        fileName = (request.fileName or "").strip()
        
        # Import httpx here to avoid affecting other code
        import httpx
        
        # Prepare the request payload for SME panel
        sme_panel_payload = {
            'topic': topic,
            'fileName': fileName,
            'document_id': document_id,
            'request_type': 'suggest_prompts'
        }
        
        logger.info(f"Forwarding prompt suggestions request to SME panel at {settings.SME_PANEL_URL}/api/ai/suggest-prompts")
        logger.info(f"SME panel payload: {sme_panel_payload}")
        
        # Call the SME panel's API for prompt suggestions
        async with httpx.AsyncClient(timeout=settings.SME_PANEL_TIMEOUT) as client:
            response = await client.post(
                f"{settings.SME_PANEL_URL}/api/ai/suggest-prompts",
                headers={
                    'X-API-Key': settings.SME_PANEL_API_KEY,
                    'Content-Type': 'application/json'
                },
                json=sme_panel_payload
            )
            
            logger.info(f"SME panel response status: {response.status_code}")
            logger.info(f"SME panel response headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Successfully fetched prompt suggestions from SME panel for user {current_user.mobile if not isinstance(current_user, dict) else 'API key user'}")
                logger.info(f"SME panel response: {data}")
                
                # Extract prompts from SME panel response
                prompts = data.get('prompts', [])
                if not prompts:
                    logger.warning("SME panel returned no prompts, using fallback")
                    prompts = get_fallback_prompts(topic, fileName, document_id)
                
                # Ensure we always return exactly 8 prompts
                if len(prompts) < 8:
                    fallback_prompts = get_fallback_prompts(topic, fileName, document_id)
                    prompts.extend(fallback_prompts[:8-len(prompts)])
                elif len(prompts) > 8:
                    prompts = prompts[:8]
                
                logger.info(f"✅ Generated {len(prompts)} prompt suggestions from SME panel")
                logger.info(f"📝 Prompts: {prompts}")
                
                # Prepare context information
                context = {
                    "topic": topic,
                    "fileName": fileName,
                    "document_id": document_id,
                    "has_topic": bool(topic),
                    "has_fileName": bool(fileName),
                    "has_document_id": bool(document_id),
                    "source": "sme_panel"
                }
                
                return AISuggestPromptsResponse(
                    prompts=prompts,
                    count=len(prompts),
                    context=context
                )
            else:
                logger.error(f"SME panel API error: {response.status_code} - {response.text}")
                logger.error(f"SME panel response headers: {dict(response.headers)}")
                # Fallback to intelligent prompts if SME panel fails
                logger.info(f"Falling back to intelligent prompt generation due to SME panel failure")
                prompts = get_fallback_prompts(topic, fileName, document_id)
                
                context = {
                    "topic": topic,
                    "fileName": fileName,
                    "document_id": document_id,
                    "has_topic": bool(topic),
                    "has_fileName": bool(fileName),
                    "has_document_id": bool(document_id),
                    "source": "fallback",
                    "sme_panel_error": f"HTTP {response.status_code}: {response.text}"
                }
                
                return AISuggestPromptsResponse(
                    prompts=prompts,
                    count=len(prompts),
                    context=context
                )
                
    except ImportError:
        logger.warning("httpx not available, using fallback prompt generation")
        prompts = get_fallback_prompts(topic, fileName, document_id)
        
        context = {
            "topic": topic,
            "fileName": fileName,
            "document_id": document_id,
            "has_topic": bool(topic),
            "has_fileName": bool(fileName),
            "has_document_id": bool(document_id),
            "source": "fallback",
            "error": "httpx not available"
        }
        
        return AISuggestPromptsResponse(
            prompts=prompts,
            count=len(prompts),
            context=context
        )
        
    except httpx.TimeoutException:
        logger.error(f"Timeout calling SME panel API for prompt suggestions")
        prompts = get_fallback_prompts(topic, fileName, document_id)
        
        context = {
            "topic": topic,
            "fileName": fileName,
            "document_id": document_id,
            "has_topic": bool(topic),
            "has_fileName": bool(fileName),
            "has_document_id": bool(document_id),
            "source": "fallback",
            "error": "SME panel timeout"
        }
        
        return AISuggestPromptsResponse(
            prompts=prompts,
            count=len(prompts),
            context=context
        )
        
    except Exception as e:
        logger.error(f"❌ Error fetching prompt suggestions from SME panel: {str(e)}")
        logger.error(f"🔍 Exception type: {type(e).__name__}")
        logger.error(f"📋 Exception details: {str(e)}")
        
        # Return intelligent fallback prompts instead of failing
        prompts = get_fallback_prompts(topic, fileName, document_id)
        
        logger.info(f"🔄 Returning fallback prompts due to error")
        return AISuggestPromptsResponse(
            prompts=prompts,
            count=len(prompts),
            context={
                "topic": topic,
                "fileName": fileName,
                "document_id": document_id,
                "has_topic": bool(topic),
                "has_fileName": bool(fileName),
                "has_document_id": bool(document_id),
                "source": "fallback",
                "error": str(e)
            }
        )

def get_fallback_prompts(topic: str, fileName: str, document_id: str) -> list[str]:
    """
    Generate intelligent fallback prompts when SME panel is unavailable.
    These are minimal, generic prompts that don't contain hardcoded content.
    """
    prompts = []
    
    if topic and fileName and document_id:
        # All three parameters available - generate minimal prompts
        prompts = [
            f"What would you like to know about {topic}?",
            f"What questions do you have about this {topic} material?",
            f"How can I help you understand {topic} better?",
            f"What aspects of {topic} would you like to explore?",
            f"What concepts in {topic} need clarification?",
            f"How can I assist you with {topic}?",
            f"What would be most helpful for learning {topic}?",
            f"What topic areas should we focus on?"
        ]
    elif topic:
        # Only topic available
        prompts = [
            f"What would you like to learn about {topic}?",
            f"How can I help you understand {topic}?",
            f"What questions do you have about {topic}?",
            f"What aspects of {topic} interest you?",
            f"How can I assist you with {topic}?",
            f"What would be most helpful for {topic}?",
            f"What concepts in {topic} need explanation?",
            f"What topic areas should we explore?"
        ]
    elif fileName or document_id:
        # Document context available
        prompts = [
            "What would you like to know about this material?",
            "How can I help you understand this content?",
            "What questions do you have about this document?",
            "What aspects of this material interest you?",
            "How can I assist you with this content?",
            "What would be most helpful for your studies?",
            "What concepts need clarification?",
            "What topic areas should we focus on?"
        ]
    else:
        # No specific context - generate general learning prompts
        prompts = [
            "What would you like to learn about today?",
            "How can I help you understand this better?",
            "What questions do you have?",
            "What topic would you like to explore?",
            "How can I assist you in your studies?",
            "What would be most helpful for you?",
            "What concept would you like me to explain?",
            "What area should we focus on?"
        ]
    
    return prompts 

# Pydantic model for query history response
class AIQueryHistoryItem(BaseModel):
    id: int
    query_text: str
    source: str
    created_at: datetime.datetime
    document_id: Optional[str] = None
    topic: Optional[str] = None
    year: Optional[str] = None
    semester: Optional[str] = None
    
    class Config:
        from_attributes = True

class AIQueryHistoryResponse(BaseModel):
    queries: List[AIQueryHistoryItem]
    count: int

@router.get("/query-history", response_model=AIQueryHistoryResponse)
def get_query_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the last 5 AI queries for the current user.
    Returns queries in reverse chronological order (newest first).
    """
    try:
        # Fetch last 5 queries for this user, ordered by most recent first
        queries = db.query(AIQueryHistory).filter(
            AIQueryHistory.user_id == current_user.id
        ).order_by(AIQueryHistory.created_at.desc()).limit(5).all()
        
        logger.info(f"📜 Retrieved {len(queries)} query history items for user {current_user.mobile}")
        
        return AIQueryHistoryResponse(
            queries=queries,
            count=len(queries)
        )
    except Exception as e:
        logger.error(f"❌ Error retrieving query history: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve query history: {str(e)}"
        )

# Query usage tracking for AI Tutor
# Plan-based limits with per-plan semantics
PLAN_LIMITS = {
    # Free users: 5 queries total (lifetime, no daily reset)
    "free": {"type": "lifetime", "limit": 5},
    # Plus: 2 queries per day
    "plus": {"type": "daily", "limit": 2},
    # Pro plans: 20 queries per day
    "pro": {"type": "daily", "limit": 20},
    "pharma_pro": {"type": "daily", "limit": 20},
    # Add-on plans: treat as Pro for AI Tutor usage
    "add-on": {"type": "daily", "limit": 20},
}

DEFAULT_PLAN_CONFIG = {"type": "lifetime", "limit": 5}

@router.get("/query-count")
def get_ai_query_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return current AI Tutor query usage without incrementing the counter."""

    # Safety check for column presence
    if not hasattr(current_user, "ai_tutor_queries"):
        raise HTTPException(status_code=500, detail="User model missing 'ai_tutor_queries' column")

    # Determine user's plan (same logic as increment_ai_query_count)
    status_str = str(getattr(current_user, "subscription_status", "") or "").lower()
    cycle_str = str(getattr(current_user, "subscription_plan", "") or "").lower()
    raw_plan = f"{status_str} {cycle_str}".strip()

    plan_key = "free"
    if "pro" in raw_plan:
        plan_key = "pro"
    elif "plus" in raw_plan:
        plan_key = "plus"
    elif any(token in raw_plan for token in ("add-on", "addon", "addon_exam", "add_on")):
        plan_key = "add-on"
    else:
        plan_key = "free"

    config = PLAN_LIMITS.get(plan_key, DEFAULT_PLAN_CONFIG)
    limit_type = config.get("type", "lifetime")
    max_queries = config.get("limit", 5)

    lifetime_count = int(current_user.ai_tutor_queries or 0)

    # Lifetime limit (e.g. free users)
    if limit_type == "lifetime":
        locked = lifetime_count >= max_queries
        remaining = max(max_queries - lifetime_count, 0)
        return {
            "locked": locked,
            "query_count": lifetime_count,
            "remaining": remaining,
            "limit": max_queries,
            "period": "lifetime",
        }

    # Daily limits (Plus / Pro / Add-on) using persistent AIDailyUsage table
    today = datetime.date.today()
    daily_usage = (
        db.query(AIDailyUsage)
        .filter(AIDailyUsage.user_id == current_user.id, AIDailyUsage.date == today)
        .first()
    )

    if daily_usage and daily_usage.used_queries is not None:
        current_daily_count = int(daily_usage.used_queries)
    else:
        current_daily_count = 0

    locked = current_daily_count >= max_queries
    remaining = max(max_queries - current_daily_count, 0)
    return {
        "locked": locked,
        "query_count": current_daily_count,
        "remaining": remaining,
        "limit": max_queries,
        "period": "daily",
    }

@router.post("/query-count")
def increment_ai_query_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Increment AI Tutor query count with plan-based limits and return lock status."""

    # Safety check for column presence
    if not hasattr(current_user, "ai_tutor_queries"):
        raise HTTPException(status_code=500, detail="User model missing 'ai_tutor_queries' column")

    # Determine user's plan (normalize across possible fields/labels)
    # IMPORTANT: subscription_plan is the billing cycle (e.g. 'semester', 'yearly'),
    # while subscription_status / plan_id carries the actual tier (plus / pro).
    status_str = str(getattr(current_user, "subscription_status", "") or "").lower()
    cycle_str = str(getattr(current_user, "subscription_plan", "") or "").lower()

    # Combine both for robust detection (handles values like 'pharma pro', 'pharma_pro', etc.)
    raw_plan = f"{status_str} {cycle_str}".strip()

    plan_key = "free"

    # Pro tiers: anything with 'pro' in subscription_status / plan_id
    if "pro" in raw_plan:
        plan_key = "pro"
    # Plus tiers: anything with 'plus' in subscription_status / plan_id
    elif "plus" in raw_plan:
        plan_key = "plus"
    # Add-on / exam add-on plans
    elif any(token in raw_plan for token in ("add-on", "addon", "addon_exam", "add_on")):
        plan_key = "add-on"
    else:
        # Default to free / trial users
        plan_key = "free"

    config = PLAN_LIMITS.get(plan_key, DEFAULT_PLAN_CONFIG)
    limit_type = config.get("type", "lifetime")
    max_queries = config.get("limit", 5)

    # Current lifetime count stored on the user (for analytics and lifetime limits)
    lifetime_count = int(current_user.ai_tutor_queries or 0)

    # Lifetime limit (e.g. free users)
    if limit_type == "lifetime":
        if lifetime_count >= max_queries:
            return {
                "locked": True,
                "query_count": lifetime_count,
                "remaining": 0,
                "limit": max_queries,
                "period": "lifetime",
            }

        next_count = lifetime_count + 1
        db.query(User).filter(User.id == current_user.id).update(
            {User.ai_tutor_queries: next_count}, synchronize_session=False
        )
        db.commit()

        remaining = max(max_queries - next_count, 0)
        return {
            "locked": False,
            "query_count": next_count,
            "remaining": remaining,
            "limit": max_queries,
            "period": "lifetime",
        }

    # Daily limits (Plus / Pro / Add-on) using persistent AIDailyUsage table
    today = datetime.date.today()
    daily_usage = (
        db.query(AIDailyUsage)
        .filter(AIDailyUsage.user_id == current_user.id, AIDailyUsage.date == today)
        .first()
    )

    if not daily_usage:
        daily_usage = AIDailyUsage(
            user_id=current_user.id,
            date=today,
            used_queries=0,
            plan_snapshot=plan_key,
        )
        db.add(daily_usage)
        db.flush()

    current_daily_count = int(daily_usage.used_queries or 0)

    if current_daily_count >= max_queries:
        return {
            "locked": True,
            "query_count": current_daily_count,
            "remaining": 0,
            "limit": max_queries,
            "period": "daily",
        }

    next_daily_count = current_daily_count + 1
    daily_usage.used_queries = next_daily_count

    # Also increment lifetime counter for analytics (does not affect daily limits)
    next_lifetime = lifetime_count + 1
    db.query(User).filter(User.id == current_user.id).update(
        {User.ai_tutor_queries: next_lifetime}, synchronize_session=False
    )
    db.commit()

    remaining = max(max_queries - next_daily_count, 0)
    return {
        "locked": False,
        "query_count": next_daily_count,
        "remaining": remaining,
        "limit": max_queries,
        "period": "daily",
    }

