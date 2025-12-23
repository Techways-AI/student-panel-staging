from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional
from datetime import datetime, date


class StudyPlanTaskBase(BaseModel):
    """Base schema for study plan tasks"""
    task_id: str = Field(..., description="Unique identifier for the task")
    title: str = Field(..., description="Task title")
    subject: str = Field(..., description="Subject name")
    priority: str = Field(..., description="Priority level: High, Medium, Low")
    task_type: str = Field(..., description="Type of task: Study Session, Review, Practice, etc.")
    duration: str = Field(..., description="Expected duration")
    scheduled_time: str = Field(..., description="Scheduled time")
    notes: Optional[str] = Field(None, description="Optional notes")

    @validator('priority')
    def validate_priority(cls, v):
        if v not in ['High', 'Medium', 'Low']:
            raise ValueError('Priority must be High, Medium, or Low')
        return v

    class Config:
        from_attributes = True


class StudyPlanTaskCreate(StudyPlanTaskBase):
    """Schema for creating a new study plan task"""
    date: str = Field(..., description="Date in YYYY-MM-DD format")


class StudyPlanTaskUpdate(BaseModel):
    """Schema for updating study plan tasks"""
    title: Optional[str] = None
    subject: Optional[str] = None
    priority: Optional[str] = None
    task_type: Optional[str] = None
    duration: Optional[str] = None
    scheduled_time: Optional[str] = None
    notes: Optional[str] = None
    completed: Optional[bool] = None

    @validator('priority')
    def validate_priority(cls, v):
        if v is not None and v not in ['High', 'Medium', 'Low']:
            raise ValueError('Priority must be High, Medium, or Low')
        return v


class StudyPlanTask(StudyPlanTaskBase):
    """Complete study plan task schema with all fields"""
    id: int
    date: str
    completed: bool
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DailyPlan(BaseModel):
    """Schema for daily study plan"""
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    tasks: List[StudyPlanTask] = Field(default_factory=list, description="List of tasks for the day")


class GenerateStudyPlanRequest(BaseModel):
    """Request schema for generating a study plan"""
    exam_date: str = Field(..., description="Exam date in YYYY-MM-DD format")
    year: Optional[int] = Field(None, ge=1, le=4, description="Academic year")
    semester: Optional[int] = Field(None, ge=1, le=2, description="Semester")

    @validator('exam_date')
    def validate_exam_date(cls, v):
        try:
            # Try YYYY-MM-DD format
            datetime.strptime(v, "%Y-%m-%d")
            return v
        except ValueError:
            try:
                # Try mm/dd/yyyy format and convert
                dt = datetime.strptime(v, "%m/%d/%Y")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                raise ValueError('exam_date must be in YYYY-MM-DD or mm/dd/yyyy format')


class StudyPlanBase(BaseModel):
    """Base study plan schema"""
    plan_type: str = "Exam-Focused"
    start_date: str
    exam_date: str
    days_remaining: int
    year: int
    semester: int


class StudyPlan(StudyPlanBase):
    """Complete study plan schema"""
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    is_active: bool
    daily: List[DailyPlan] = Field(default_factory=list, description="Daily plans")

    class Config:
        from_attributes = True


class GenerateStudyPlanResponse(StudyPlanBase):
    """Response schema for generated study plan"""
    daily: List[DailyPlan] = Field(default_factory=list, description="Daily study plans")


class TaskToggleRequest(BaseModel):
    """Request schema for toggling task completion"""
    task_id: str = Field(..., description="ID of the task to toggle")
    completed: bool = Field(..., description="New completion status")


class TaskToggleResponse(BaseModel):
    """Response schema for task toggle operations"""
    success: bool
    task: StudyPlanTask
    message: str
    xp_awarded: Optional[int] = None


class StudyPlanStatsResponse(BaseModel):
    """Response schema for study plan statistics"""
    weekly_streak: int
    hours_this_week: str
    today_hours_label: str = "0 mins"
    subjects_covered: str
    total_plans_created: int
    total_tasks_completed: int
    total_study_hours: str
    # Added: current-day study hours comparison
    your_study_hours: float = 0.0
    topper_study_hours: float = 0.0
    # Added: weekly hours (floats) for progress bars
    your_weekly_hours: float = 0.0
    topper_weekly_hours: float = 0.0


class StudyPlanListResponse(BaseModel):
    """Response schema for listing user's study plans"""
    study_plans: List[StudyPlan]
    active_plan: Optional[StudyPlan] = None


class TasksForDateRequest(BaseModel):
    """Request schema for getting tasks for a specific date"""
    date: str = Field(..., description="Date in YYYY-MM-DD format")

    @validator('date')
    def validate_date(cls, v):
        try:
            datetime.strptime(v, "%Y-%m-%d")
            return v
        except ValueError:
            raise ValueError('date must be in YYYY-MM-DD format')


class TasksForDateResponse(BaseModel):
    """Response schema for tasks on a specific date"""
    date: str
    tasks: List[StudyPlanTask]
    total_tasks: int
    completed_tasks: int
    progress_percentage: int


class WeeklyProgressResponse(BaseModel):
    """Response schema for weekly progress"""
    week_dates: List[Dict[str, Any]]
    current_week_completion: int
    total_weekly_tasks: int


class BulkTaskUpdateRequest(BaseModel):
    """Request schema for bulk task updates"""
    updates: List[Dict[str, Any]] = Field(..., description="List of task updates with task_id and fields to update")


class BulkTaskUpdateResponse(BaseModel):
    """Response schema for bulk task updates"""
    success: bool
    updated_count: int
    failed_updates: List[Dict[str, Any]] = Field(default_factory=list)
    message: str


