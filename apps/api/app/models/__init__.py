# Models module
from .user import User
from .quiz import Quiz
from .feedback import Feedback
from .notes import GeneratedNotes
from .model_paper_predictions import ModelPaperPredictions
from .subscription import Subscription
from .subscription_plan import SubscriptionPlan
from .course_structure import CourseStructure
from .device import Device
from .study_plan import StudyPlan, StudyPlanTask, StudyPlanStats
from .streak import Streak
from .user_activity import UserActivity
from .subject_progress import SubjectProgress
from .offer import Offer
from .ai_query_history import AIQueryHistory
from .ai_daily_usage import AIDailyUsage
from .curriculum import UniversityCurriculum
from .content_library import ContentLibrary
from .topic_mapping import TopicMapping

# Configure mappers after all models are imported
from sqlalchemy.orm import configure_mappers
configure_mappers() 

