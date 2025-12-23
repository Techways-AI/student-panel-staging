import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Get DATABASE_URL from environment, fallback to PostgreSQL if not provided
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/durranis_pharma")

# OPTIMIZED: Create engine with connection pooling and performance optimizations
engine = create_engine(
    DATABASE_URL,
    # Connection pooling optimizations
    pool_size=20,                    # Number of connections to maintain in pool
    max_overflow=30,                 # Additional connections beyond pool_size
    pool_pre_ping=True,              # Verify connections before use
    pool_recycle=3600,               # Recycle connections every hour
    
    # Performance optimizations
    echo=False,                      # Disable SQL logging for production
    connect_args={
        "connect_timeout": 10,       # Connection timeout
        "application_name": "durranis_pharma_api"
    }
)

# OPTIMIZED: Create session factory with optimizations
SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine,
    expire_on_commit=False          # Prevent unnecessary queries after commit
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 

