from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import logging
import sys
import datetime

from app.api import quiz_router, profile_router, auth_router, subject_content_router, presigned_url_router, ai_router, feedback_router, current_course_router, model_paper_router, device_management, dashboard_router, study_plan_router, payments_router, streak_router, subscription_plans_router, subject_subscriptions_router, user_activity_router, student_curriculum_router, student_topic_content_router
from app.api.quiz_completion import router as quiz_completion_router
from app.core.config import settings
from app.api.leaderboard import router as leaderboard_router
from app.services.analytics.posthog_client import init_client, shutdown_client, is_enabled

# Configure logging with proper stream handler for deployment platforms
log_level = logging.INFO if settings.ENVIRONMENT == "production" else logging.DEBUG
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)  # Explicitly output to stdout for Railway/deployment
    ],
    force=True  # Override any existing configuration
)

# Suppress verbose AWS SDK (boto3/botocore) DEBUG logs - set to WARNING level
# These logs show detailed HTTP requests, signatures, and S3 operations which are too verbose
for aws_logger_name in ["botocore", "botocore.hooks", "botocore.auth", "botocore.parsers", 
                        "botocore.endpoint", "botocore.httpsession", "botocore.retryhandler",
                        "botocore.regions", "boto3", "urllib3", "urllib3.connectionpool"]:
    aws_logger = logging.getLogger(aws_logger_name)
    aws_logger.setLevel(logging.WARNING)  # Only show WARNING and above

# Also configure uvicorn loggers to output properly
for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
    uvicorn_logger = logging.getLogger(logger_name)
    uvicorn_logger.handlers = [logging.StreamHandler(sys.stdout)]

logger = logging.getLogger(__name__)
logger.info(f"🚀 Starting Durrani API - Environment: {settings.ENVIRONMENT}")
 
app = FastAPI()


@app.on_event("startup")
async def startup_event() -> None:
    logger.info("✅ Durrani API started successfully")
    logger.info(f"📊 Environment: {settings.ENVIRONMENT}")
    if is_enabled():
        init_client()
        logger.info("📈 PostHog analytics initialized")


@app.on_event("shutdown")
async def shutdown_analytics() -> None:
    if is_enabled():
        shutdown_client()
 
# Add logging middleware for all requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    import time
    start_time = time.time()
    
    # Skip logging for health checks to reduce noise
    skip_paths = ["/health", "/", "/.well-known"]
    should_log = not any(request.url.path.startswith(p) for p in skip_paths)
    
    try:
        response = await call_next(request)
        
        if should_log:
            process_time = (time.time() - start_time) * 1000
            # Log all requests with appropriate level
            if response.status_code >= 500:
                logger.error(f"{request.method} {request.url.path} - {response.status_code} - {process_time:.2f}ms")
            elif response.status_code >= 400:
                logger.warning(f"{request.method} {request.url.path} - {response.status_code} - {process_time:.2f}ms")
            else:
                logger.info(f"{request.method} {request.url.path} - {response.status_code} - {process_time:.2f}ms")
        
        return response
    except Exception as e:
        logger.error(f"Request error: {request.method} {request.url.path} - Error: {str(e)}")
        raise
 
# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "durrani-api"}
 
# Root health check endpoint for load balancer
@app.get("/")
async def root_health_check():
    return {"status": "healthy", "service": "durrani-api", "message": "Service is running"}

# API test endpoint (for health checks and testing)
@app.get("/api/test")
async def api_test():
    return {"status": "ok", "message": "API is working", "service": "durrani-api"}

# CORS debug endpoint
@app.get("/api/cors-debug")
async def cors_debug():
    return {
        "status": "ok", 
        "cors_origins": settings.CORS_ORIGINS,
        "environment": settings.ENVIRONMENT,
        "message": "CORS configuration debug info"
    }

# Test endpoint for CORS headers
@app.get("/api/test-cors-headers")
async def test_cors_headers(response: Response):
    """Test endpoint to verify CORS headers are properly set"""
    response.headers["X-Test-Custom-Header"] = "test-value"
    response.headers["x-rtb-fingerprint-id"] = "test-fingerprint-123"
    response.headers["Access-Control-Expose-Headers"] = "X-Test-Custom-Header, x-rtb-fingerprint-id"
    
    return {
        "status": "ok",
        "message": "CORS headers test",
        "custom_header": "X-Test-Custom-Header",
        "fingerprint_header": "x-rtb-fingerprint-id"
    }

# Health check endpoint with dependency status
@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check with dependency status"""
    import importlib
    
    dependencies = {
        "fastapi": True,
        "uvicorn": True,
        "sqlalchemy": True,
        "boto3": True,
        "google-generativeai": True,
        "python-docx": True,
        "reportlab": False,  # Will be updated below
        "pandas": True,
        "numpy": True,
        "psycopg2": True
    }
    
    # Check reportlab specifically
    try:
        import reportlab
        dependencies["reportlab"] = True
    except ImportError:
        dependencies["reportlab"] = False
    
    # Check other critical dependencies
    for dep in ["pandas", "numpy", "boto3"]:
        try:
            importlib.import_module(dep)
        except ImportError:
            dependencies[dep] = False
    
    return {
        "status": "healthy" if all(dependencies.values()) else "degraded",
        "service": "durrani-api",
        "dependencies": dependencies,
        "timestamp": str(datetime.datetime.now())
    }
 
# Chrome DevTools: Silences 404 for /.well-known/appspecific/com.chrome.devtools.json
@app.get("/.well-known/appspecific/com.chrome.devtools.json")
async def chrome_devtools_json():
    return "", 204
 
# Add CORS preflight handler middleware
@app.middleware("http")
async def cors_preflight_handler(request: Request, call_next):
    """Handle CORS preflight requests before they reach the main CORS middleware"""
    if request.method == "OPTIONS":
        # For OPTIONS requests, return a simple 200 response
        response = Response()
        response.headers["Access-Control-Allow-Origin"] = request.headers.get("origin", "*")
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Requested-With, Accept, X-API-Key, X-Device-UUID, X-Device-Type, X-Device-Fingerprint, Origin, X-RTB-Fingerprint-ID, Cache-Control, Pragma, Expires"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Max-Age"] = "86400"  # 24 hours
        return response
    
    response = await call_next(request)
    return response

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "Accept", "X-API-Key", "X-Device-UUID", "X-Device-Type", "X-Device-Fingerprint", "Origin", "X-RTB-Fingerprint-ID", "Cache-Control", "Pragma", "Expires"],
    expose_headers=["*", "x-rtb-fingerprint-id", "X-RTB-Fingerprint-ID"],
)
 
# Include routers
app.include_router(auth_router, prefix="/api/auth")
app.include_router(quiz_router, prefix="/api/quiz")
app.include_router(profile_router, prefix="/api/profile")
app.include_router(subject_content_router, prefix="/api/subject-content")
app.include_router(presigned_url_router, prefix="/api")
app.include_router(ai_router, prefix="/api/ai")
app.include_router(feedback_router, prefix="/api/feedback")
app.include_router(leaderboard_router, prefix="/api")
app.include_router(current_course_router, prefix="/api")
app.include_router(model_paper_router, prefix="/api/model-paper")
app.include_router(device_management.router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(study_plan_router, prefix="/api/study-plan")
app.include_router(streak_router, prefix="/api/streak")

app.include_router(payments_router, prefix="/api/payments")
app.include_router(subscription_plans_router, prefix="/api/subscription-plans")
app.include_router(subject_subscriptions_router, prefix="/api/subject-subscriptions")
app.include_router(quiz_completion_router, prefix="/api/quiz")
app.include_router(user_activity_router, prefix="/api")
app.include_router(student_curriculum_router, prefix="/api")
app.include_router(student_topic_content_router, prefix="/api")

# Redirect endpoints for backward compatibility
@app.post("/api/mark-notes-read")
async def mark_notes_read_redirect(request: Request):
    """Redirect to the daily-goal endpoint for backward compatibility"""
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=308,  # Permanent Redirect
        content={"detail": "This endpoint has moved to /api/daily-goal/mark-notes-read"},
        headers={"Location": "/api/daily-goal/mark-notes-read"}
    )

@app.get("/api/subscription-plans/subscription/status")
async def subscription_status_redirect(request: Request):
    """Redirect to the payments endpoint for backward compatibility"""
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=308,  # Permanent Redirect
        content={"detail": "This endpoint has moved to /api/payments/status"},
        headers={"Location": "/api/payments/status"}
    )

