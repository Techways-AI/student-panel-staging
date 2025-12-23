from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from ..db.session import get_db
from ..models.subscription_plan import SubscriptionPlan
from ..api.auth import get_current_user
from ..models.user import User
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Subject data organized by year and semester
SUBJECTS_DATA = [
    # Year 1 Semester 1
    ("PS101", "Human Anatomy and Physiology I", 1, 1),
    ("PS102", "Pharmaceutical Analysis I", 1, 1),
    ("PS103", "Pharmaceutics", 1, 1),
    ("PS104", "Pharmaceutical Inorganic Chemistry", 1, 1),
    ("HS105", "Communication skills", 1, 1),
    ("BS106", "Remedial Biology", 1, 1),
    ("BS107", "Remedial Mathematics", 1, 1),
    
    # Year 1 Semester 2
    ("PS201", "Human Anatomy and Physiology II", 1, 2),
    ("PS202", "Pharmaceutical Organic Chemistry-I", 1, 2),
    ("BS203", "Biochemistry", 1, 2),
    ("BS204", "Pathophysiology", 1, 2),
    ("CS205", "Computer Applications in Pharmacy", 1, 2),
    ("MC200", "NSS (Non-Credit Mandatory Course)", 1, 2),
    
    # Year 2 Semester 1
    ("PS301", "Pharmaceutical Organic Chemistry-II", 2, 1),
    ("PS302", "Physical Pharmaceutics-I", 2, 1),
    ("BS303", "Pharmaceutical Microbiology", 2, 1),
    ("PC304", "Pharmaceutical Engineering", 2, 1),
    ("MC300", "NSO (Non-Credit Mandatory Course)", 2, 1),
    
    # Year 2 Semester 2
    ("PS401", "Pharmaceutical Organic Chemistry-III", 2, 2),
    ("PC402", "Physical Pharmaceutics-II", 2, 2),
    ("PS403", "Pharmacology-I", 2, 2),
    ("PC404", "Pharmacognosy and Phytochemistry-I", 2, 2),
    ("PS405", "Pharmaceutical Jurisprudence", 2, 2),
    ("MC400", "Gender Sensitization Lab (Non-Credit Mandatory Course)", 2, 2),
    
    # Year 3 Semester 1
    ("PS501", "Medicinal Chemistry I", 3, 1),
    ("PS502", "Industrial Pharmacy - I", 3, 1),
    ("PS503", "Pharmacology II", 3, 1),
    ("PS504", "Pharmacognosy and Phytochemistry - II", 3, 1),
    ("PS505", "Generic Product Development", 3, 1),
    ("PS506", "Green Chemistry", 3, 1),
    ("PS507", "Cell and Molecular Biology", 3, 1),
    ("PS508", "Cosmetic science", 3, 1),
    ("MC500", "Environmental sciences (Non-Credit Mandatory Course)", 3, 1),
    
    # Year 3 Semester 2
    ("PS601", "Medicinal Chemistry - II", 3, 2),
    ("PS602", "Pharmacology - III", 3, 2),
    ("PS603", "Herbal Drug Technology", 3, 2),
    ("PS604", "Biopharmaceutics and Pharmacokinetics", 3, 2),
    ("PS605", "Pharmaceutical Quality Assurance", 3, 2),
    ("PS606", "Pharmaceutical Biotechnology", 3, 2),
    ("PS607", "Bioinformatics", 3, 2),
    ("PS608", "Screening Methods in Pharmacology", 3, 2),
    ("MC600", "Human Values and Professional Ethics (Non-Credit Mandatory Course)", 3, 2),
    
    # Year 4 Semester 1
    ("PS701", "Instrumental Methods of Analysis", 4, 1),
    ("PS702", "Industrial Pharmacy-II", 4, 1),
    ("PS703", "Pharmacy Practice", 4, 1),
    ("PS704", "Medicinal Chemistry - III", 4, 1),
    ("PS705", "Pharmaceutical Marketing", 4, 1),
    ("PS706", "Pharmaceutical Regulatory Science", 4, 1),
    ("PS707", "Pharmacovigilance", 4, 1),
    ("PS708", "Quality Control and Standardization of Herbals", 4, 1),
    ("PS710", "Practice School", 4, 1),
    ("PS711", "Industrial Training", 4, 1),
    
    # Year 4 Semester 2
    ("PS801", "Biostatistics and Research Methodology", 4, 2),
    ("PS802", "Social and Preventive Pharmacy", 4, 2),
    ("PS803", "Novel Drug Delivery System", 4, 2),
    ("PS804", "Computer Aided Drug Design", 4, 2),
    ("PS805", "Nano Technology", 4, 2),
    ("PS806", "Experimental Pharmacology", 4, 2),
    ("PS807", "Advanced Instrumentation Techniques", 4, 2),
    ("PS809", "Project Work", 4, 2),
]

@router.get("/subject-based")
async def get_subject_based_plans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    year: Optional[int] = Query(None, description="Filter subjects by academic year (1-4)"),
    semester: Optional[int] = Query(None, description="Filter subjects by academic semester (1-2)")
):
    """Get all available subjects for individual subscription, optionally filtered by year and semester"""
    try:
        logger.info(f"User {current_user.id} requesting subject-based plans with filters: Year={year}, Semester={semester}")
        
        # Filter subjects based on year and semester parameters
        filtered_subjects = []
        for subject_code, subject_name, subject_year, subject_semester in SUBJECTS_DATA:
            # Apply filters if provided
            if year is not None and subject_year != year:
                continue
            if semester is not None and subject_semester != semester:
                continue
                
            plan = {
                "id": f"subject_{subject_code}",
                "name": f"Subject-Based: {subject_name}",
                "description": f"Access to all topics in {subject_name} for 1 month",
                "amount": 999.00,
                "currency": "INR",
                "interval": "subject",
                "features": {
                    "subject_code": subject_code,
                    "subject_name": subject_name,
                    "year": subject_year,
                    "semester": subject_semester,
                    "duration_months": 1,
                    "access_type": "subject_based",
                    "topics_access": "all",
                    "ai_tutor_access": "unlimited",
                    "important_questions_access": "included"
                },
                "is_active": True,
                "formatted_amount": "₹999.00",
                "interval_display": "for 1 month"
            }
            filtered_subjects.append(plan)
        
        logger.info(f"Returning {len(filtered_subjects)} subjects after filtering")
        
        return {
            "plans": filtered_subjects,
            "total_count": len(filtered_subjects),
            "filters": {
                "year": year,
                "semester": semester
            },
            "message": f"Available subjects" + (f" for Year {year}, Semester {semester}" if year and semester else "")
        }
        
    except Exception as e:
        logger.error(f"Error fetching subject-based plans: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch subject-based plans"
        )

@router.get("/subject-based/{year}/{semester}")
async def get_subjects_by_year_semester(
    year: int,
    semester: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get subjects for a specific year and semester"""
    try:
        # Filter subjects by year and semester
        filtered_subjects = [
            (code, name, y, s) for code, name, y, s in SUBJECTS_DATA 
            if y == year and s == semester
        ]
        
        if not filtered_subjects:
            return {
                "plans": [],
                "total_count": 0,
                "message": f"No subjects found for Year {year}, Semester {semester}"
            }
        
        # Convert to subscription plan format
        subject_plans = []
        for subject_code, subject_name, year, semester in filtered_subjects:
            plan = {
                "id": f"subject_{subject_code}",
                "name": f"Subject-Based: {subject_name}",
                "description": f"Access to all topics in {subject_name} for 1 month",
                "amount": 1.00,
                "currency": "INR",
                "interval": "subject",
                "features": {
                    "subject_code": subject_code,
                    "subject_name": subject_name,
                    "year": year,
                    "semester": semester,
                    "duration_months": 1,
                    "access_type": "subject_based",
                    "topics_access": "all",
                    "ai_tutor_access": "unlimited",
                    "important_questions_access": "included"
                },
                "is_active": True,
                "formatted_amount": "₹1.00",
                "interval_display": "for 1 month"
            }
            subject_plans.append(plan)
        
        return {
            "plans": subject_plans,
            "total_count": len(subject_plans),
            "year": year,
            "semester": semester,
            "message": f"Subjects for Year {year}, Semester {semester}"
        }
        
    except Exception as e:
        logger.error(f"Error fetching subjects for year {year}, semester {semester}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch subjects for Year {year}, Semester {semester}"
        )

