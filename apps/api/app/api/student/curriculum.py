from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import UniversityCurriculum, User
from app.api.auth import get_current_user

router = APIRouter(prefix="/student", tags=["Student Curriculum"])


@router.get("/curriculum")
def get_student_curriculum(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1️⃣ Get user's university
    university = current_user.university
    if not university:
        raise HTTPException(status_code=400, detail="University not assigned")

    # 2️⃣ Fetch all active curriculum records
    curricula = (
        db.query(UniversityCurriculum)
        .filter(
            UniversityCurriculum.university == university,
            UniversityCurriculum.status == "active"
        )
        .all()
    )

    if not curricula:
        raise HTTPException(status_code=404, detail="Curriculum not found")

    # 3️⃣ Merge all records into a single hierarchy
    merged_years = {}

    for curriculum in curricula:
        curriculum_data = curriculum.curriculum_data or {}
        years = curriculum_data.get("years", [])
        
        for year_data in years:
            year_num = year_data.get("year")
            if year_num not in merged_years:
                merged_years[year_num] = {"year": year_num, "semesters": {}}
            
            semesters = year_data.get("semesters", [])
            for sem_data in semesters:
                # Normalize semester to 1 or 2 (e.g., 3 -> 1, 4 -> 2)
                raw_sem = sem_data.get("semester")
                sem_num = ((raw_sem - 1) % 2) + 1
                
                if sem_num not in merged_years[year_num]["semesters"]:
                    merged_years[year_num]["semesters"][sem_num] = {"semester": sem_num, "subjects": []}
                
                subjects = sem_data.get("subjects", [])
                merged_years[year_num]["semesters"][sem_num]["subjects"].extend(subjects)

    # Convert nested dicts back to lists
    final_years = []
    for year_num in sorted(merged_years.keys()):
        year_obj = merged_years[year_num]
        semesters_list = []
        for sem_num in sorted(year_obj["semesters"].keys()):
            semesters_list.append(year_obj["semesters"][sem_num])
        year_obj["semesters"] = semesters_list
        final_years.append(year_obj)

    # 4️⃣ Return full hierarchy
    return {
        "university": university,
        "years": final_years
    }
