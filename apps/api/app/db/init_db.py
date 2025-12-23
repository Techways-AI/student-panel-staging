from .session import engine
from ..models.base import Base
from ..models.user import User
from ..models.feedback import Feedback

def init_db():
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!") 

