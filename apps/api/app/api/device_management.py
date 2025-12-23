from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import logging

from ..db.session import get_db
from ..models.user import User
from ..models.device import Device
from ..services.device_service import DeviceService
from ..api.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

class DeviceInfo(BaseModel):
    id: int
    device_uuid: str
    device_type: str
    ip_address: Optional[str]
    user_agent: Optional[str]
    is_active: bool
    created_at: str
    last_used: str

class DeviceReplaceRequest(BaseModel):
    old_device_uuid: str
    new_device_uuid: Optional[str] = None
    fingerprint: Optional[dict] = None

class DeviceRegisterRequest(BaseModel):
    device_uuid: Optional[str] = None
    fingerprint: Optional[dict] = None

@router.get("/devices", response_model=List[DeviceInfo])
async def get_user_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all active devices for the current user
    """
    try:
        devices = DeviceService.get_user_devices(db, current_user.id)
        
        device_list = []
        for device in devices:
            device_list.append(DeviceInfo(
                id=device.id,
                device_uuid=str(device.device_uuid),
                device_type=device.device_type,
                ip_address=device.ip_address,
                user_agent=device.user_agent,
                is_active=device.is_active,
                created_at=device.created_at.isoformat() if device.created_at else "",
                last_used=device.last_used.isoformat() if device.last_used else ""
            ))
        
        logger.info(f"Retrieved {len(device_list)} devices for user {current_user.id}")
        return device_list
        
    except Exception as e:
        logger.error(f"Error retrieving devices for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve devices"
        )

@router.post("/devices/register")
async def register_device(
    request_data: DeviceRegisterRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually register the current device
    """
    try:
        device, is_new_device = DeviceService.register_device(
            db=db,
            user_id=current_user.id,
            device_uuid=request_data.device_uuid,
            fingerprint_data=request_data.fingerprint,
            request=request
        )
        
        logger.info(f"Device {'registered' if is_new_device else 'recognized'} for user {current_user.id}")
        
        return {
            "success": True,
            "message": f"{device.device_type.capitalize()} device {'registered' if is_new_device else 'recognized'} successfully",
            "device_uuid": str(device.device_uuid),
            "device_type": device.device_type,
            "is_new_device": is_new_device
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error registering device for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register device"
        )

@router.post("/devices/replace")
async def replace_device(
    request_data: DeviceReplaceRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Replace an existing device with a new one
    """
    try:
        new_device = DeviceService.replace_device(
            db=db,
            user_id=current_user.id,
            old_device_uuid=request_data.old_device_uuid,
            new_device_uuid=request_data.new_device_uuid,
            fingerprint_data=request_data.fingerprint,
            request=request
        )
        
        logger.info(f"Device replaced for user {current_user.id}: {request_data.old_device_uuid} -> {new_device.device_uuid}")
        
        return {
            "success": True,
            "message": f"{new_device.device_type.capitalize()} device replaced successfully",
            "new_device_uuid": str(new_device.device_uuid),
            "device_type": new_device.device_type
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error replacing device for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to replace device"
        )

@router.delete("/devices/{device_uuid}")
async def deactivate_device(
    device_uuid: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deactivate a specific device
    """
    try:
        success = DeviceService.deactivate_device(db, current_user.id, device_uuid)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found"
            )
        
        logger.info(f"Device {device_uuid} deactivated for user {current_user.id}")
        
        return {
            "success": True,
            "message": "Device deactivated successfully"
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error deactivating device {device_uuid} for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate device"
        )

@router.get("/devices/status")
async def get_device_status(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the status of the current device
    """
    try:
        # Get device info from request headers or body
        device_uuid = request.headers.get("X-Device-UUID")
        fingerprint_data = None
        
        # Try to get fingerprint from request body if available
        try:
            body = await request.body()
            if body:
                import json
                body_data = json.loads(body)
                fingerprint_data = body_data.get("fingerprint")
        except:
            pass
        
        if device_uuid:
            # Check if device is registered
            device = db.query(Device).filter(
                Device.device_uuid == device_uuid,
                Device.user_id == current_user.id,
                Device.is_active == True
            ).first()
            
            if device:
                return {
                    "status": "registered",
                    "message": "Current device is registered and active",
                    "device_uuid": str(device.device_uuid),
                    "device_type": device.device_type
                }
        
        # If no device UUID or not found, check if we can register
        user_agent = request.headers.get("user-agent", "")
        device_type = DeviceService.detect_device_type(user_agent)
        
        # Check if user already has a device of this type
        existing_device = db.query(Device).filter(
            Device.user_id == current_user.id,
            Device.device_type == device_type,
            Device.is_active == True
        ).first()
        
        if existing_device:
            return {
                "status": "limit_reached",
                "message": f"You already have a {device_type} device registered",
                "device_type": device_type,
                "existing_device_uuid": str(existing_device.device_uuid)
            }
        else:
            return {
                "status": "unregistered",
                "message": "Current device can be registered",
                "device_type": device_type
            }
            
    except Exception as e:
        logger.error(f"Error checking device status for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check device status"
        )

@router.post("/devices/cleanup")
async def cleanup_inactive_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Clean up inactive devices (admin function)
    """
    try:
        # Only allow admin users to cleanup devices
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin users can cleanup devices"
            )
        
        count = DeviceService.cleanup_inactive_devices(db, days_threshold=30)
        
        logger.info(f"Cleaned up {count} inactive devices")
        
        return {
            "success": True,
            "message": f"Cleaned up {count} inactive devices",
            "count": count
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error cleaning up inactive devices: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cleanup inactive devices"
        )

