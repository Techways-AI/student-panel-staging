from .auth import router as auth_router
from .quiz import router as quiz_router
from .profile import router as profile_router
from .subject_content import router as subject_content_router
from .presigned_url import router as presigned_url_router
from .ai import router as ai_router
from .feedback import router as feedback_router
from .current_course import router as current_course_router
from .model_paper import router as model_paper_router
from .dashboard import router as dashboard_router 
from .study_plan import router as study_plan_router
from .payments import router as payments_router
from .streak import router as streak_router
from .subscription_plans import router as subscription_plans_router
from .subject_subscriptions import router as subject_subscriptions_router
from .user_activity import router as user_activity_router
from .student import curriculum_router as student_curriculum_router, topic_content_router as student_topic_content_router

