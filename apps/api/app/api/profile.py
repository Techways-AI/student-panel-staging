from fastapi import APIRouter, HTTPException, Depends, Request
from app.api.auth import get_current_user
from app.models.user import User
from sqlalchemy.orm import Session
from app.db.session import get_db
from pydantic import BaseModel
from typing import Optional
from app.services.device_service import DeviceService
from app.api.auth import is_profile_complete
import logging

logger = logging.getLogger(__name__)

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    college_name: Optional[str] = None
    university: Optional[str] = None
    gender: Optional[str] = None
    year: Optional[int] = None
    semester: Optional[int] = None

router = APIRouter()

@router.get("/me")
async def get_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile - requires authentication"""
    return {
        "id": current_user.id,
        "mobile": current_user.mobile,
        "name": current_user.name,
        "role": current_user.role,
        "email": current_user.email,
        "gender": current_user.gender,
        "college_name": current_user.college_name,
        "university": current_user.university,
        "year": current_user.year,
        "semester": current_user.semester
    }

@router.get("/greeting")
async def get_user_greeting(current_user: User = Depends(get_current_user)):
    """Get user greeting data - optimized for dashboard display"""
    return {
        "id": current_user.id,
        "name": current_user.name or "Student",  # Fallback to "Student" if name is None
        "mobile": current_user.mobile,
        "role": current_user.role,
        "year": current_user.year or 1,
        "semester": current_user.semester or 1
    }

@router.get("/name")
async def get_user_name(current_user: User = Depends(get_current_user)):
    """Get just the user's name - fastest possible response"""
    return {
        "name": current_user.name or "Student",
        "mobile": current_user.mobile
    }

@router.put("/update")
async def update_profile(
    profile_data: ProfileUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile - requires authentication"""
    print(f" Profile update called for user: {current_user.mobile}")
    print(f" Received data: {profile_data.dict()}")

    # Check if profile was incomplete before update
    was_profile_complete = is_profile_complete(current_user)
    print(f" Profile was complete before update: {was_profile_complete}")

    if profile_data.name:
        current_user.name = profile_data.name
        print(f" Updated name to: {profile_data.name}")
    if profile_data.email:
        current_user.email = profile_data.email
        print(f" Updated email to: {profile_data.email}")
    if profile_data.college_name:
        current_user.college_name = profile_data.college_name
        print(f" Updated college_name to: {profile_data.college_name}")
    if profile_data.university:
        current_user.university = profile_data.university
        print(f" Updated university to: {profile_data.university}")
    if profile_data.gender:
        current_user.gender = profile_data.gender
        print(f" Updated gender to: {profile_data.gender}")
    if profile_data.year:
        current_user.year = profile_data.year
        print(f" Updated year to: {profile_data.year}")
    if profile_data.semester:
        current_user.semester = profile_data.semester
        print(f" Updated semester to: {profile_data.semester}")

    db.commit()
    db.refresh(current_user)

    print(f" Profile update successful for user: {current_user.mobile}")
    print(f" Final user data: name={current_user.name}, email={current_user.email}, gender={current_user.gender}")

    # Check if profile became complete after this update
    is_now_complete = is_profile_complete(current_user)
    print(f"🔍 Profile is complete after update: {is_now_complete}")

    # If profile just became complete and user has no devices registered, register device
    if is_now_complete and not was_profile_complete:
        logger.info(f"🎉 User {current_user.id} just completed their profile! Registering device...")

        # Get device information from request headers (sent by frontend)
        device_uuid = request.headers.get("x-device-uuid")
        device_type = request.headers.get("x-device-type")
        fingerprint_json = request.headers.get("x-device-fingerprint")

        logger.info(f"🔍 Device info from headers: UUID={device_uuid}, Type={device_type}, Fingerprint={fingerprint_json}")

        if device_uuid and device_type and fingerprint_json:
            try:
                import json
                fingerprint_data = json.loads(fingerprint_json)

                # Register the device now that profile is complete
                device, is_new_device = DeviceService.register_device(
                    db=db,
                    user_id=current_user.id,
                    device_uuid=device_uuid,
                    fingerprint_data=fingerprint_data,
                    request=request,  # Contains full request context
                    device_type_override=device_type
                )

                logger.info(f"✅ Device {'registered' if is_new_device else 'recognized'} for user {current_user.id} after profile completion: {device.device_uuid}")

            except json.JSONDecodeError as e:
                logger.error(f"❌ Failed to parse device fingerprint JSON: {e}")
            except Exception as e:
                logger.error(f"❌ Failed to register device after profile completion: {e}")
                # Don't fail the profile update if device registration fails
        else:
            logger.warning(f"⚠️ Missing device information in headers for user {current_user.id}")
            logger.warning(f"   - Device UUID: {device_uuid}")
            logger.warning(f"   - Device Type: {device_type}")
            logger.warning(f"   - Fingerprint: {fingerprint_json}")
            logger.info(f"💡 Frontend should send device info in headers when completing profile")

    return {"message": "Profile updated successfully", "user": current_user} 

@router.get("/user-profile")
async def get_user_profile(current_user: User = Depends(get_current_user)):
    """Get user profile - endpoint matches frontend expectation"""
    return {
        "id": current_user.id,
        "mobile": current_user.mobile,
        "name": current_user.name,
        "role": current_user.role,
        "email": current_user.email,
        "gender": current_user.gender,
        "college_name": current_user.college_name,
        "university": current_user.university,
        "year": current_user.year,
        "semester": current_user.semester
    } 

