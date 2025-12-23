import hashlib
import hmac
import json
import logging
import re
import uuid
from typing import Optional, Tuple, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status, Request
from ..models.device import Device
from ..models.user import User
from ..services.device_monitoring_service import device_monitoring
from ..core.config import settings

logger = logging.getLogger(__name__)

class DeviceService:
    """Production-ready device management service using UUIDs and fingerprinting"""
    
    @staticmethod
    def detect_device_type(user_agent: str) -> str:
        """Detect if the device is mobile or desktop based on user agent"""
        if not user_agent:
            return "desktop"
        
        # Mobile device patterns - more specific to avoid false positives
        mobile_patterns = [
            r'Android\s+\d+',  # Android with version number
            r'iPhone\s+OS\s+\d+',  # iPhone with OS version
            r'iPad.*OS\s+\d+',  # iPad with OS version
            r'Windows Phone\s+\d+',  # Windows Phone with version
            r'BlackBerry\s+\d+',  # BlackBerry with version
            r'Opera Mini',  # Opera Mini browser
            r'IEMobile',  # Internet Explorer Mobile
            r'webOS',  # webOS
            r'Symbian',  # Symbian
            r'Kindle',  # Kindle
            r'Silk',  # Silk browser
        ]
        
        # Check for specific mobile patterns first
        for pattern in mobile_patterns:
            if re.search(pattern, user_agent, re.IGNORECASE):
                return "mobile"
        
        # Additional checks for generic mobile indicators
        # But be more careful about "Mobile" - it can appear in desktop browsers
        if re.search(r'Mobile.*Safari', user_agent, re.IGNORECASE):
            return "mobile"
        
        # Check for tablet patterns
        if re.search(r'iPad|Android.*Tablet|Kindle.*Fire', user_agent, re.IGNORECASE):
            return "mobile"
        
        return "desktop"
    
    @staticmethod
    def get_client_ip(request: Request) -> str:
        """Extract client IP address from request"""
        # Check for forwarded headers first (for load balancers/proxies)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct connection
        if hasattr(request, 'client') and request.client:
            return request.client.host
        
        return "127.0.0.1"
    
    @staticmethod
    def compute_fingerprint_hash(fingerprint_data: Dict[str, Any]) -> str:
        """Compute HMAC SHA256 hash of fingerprint data"""
        try:
            if not fingerprint_data:
                return None
            
            # Sort keys for consistent hashing
            sorted_data = json.dumps(fingerprint_data, sort_keys=True, separators=(',', ':'))
            
            # Use device secret from config
            secret = getattr(settings, 'DEVICE_SECRET', 'default-device-secret-key')
            
            # Compute HMAC SHA256
            hash_result = hmac.new(
                secret.encode('utf-8'),
                sorted_data.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            logger.debug(f"Computed fingerprint hash: {hash_result[:16]}...")
            return hash_result
            
        except Exception as e:
            logger.error(f"Error computing fingerprint hash: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process device fingerprint"
            )
    
    @staticmethod
    def compute_stable_device_hash(fingerprint_data: Dict[str, Any]) -> str:
        """Compute a stable hash based on hardware characteristics that don't change between browsers
        This helps identify the same physical device across different browsers/incognito modes
        """
        try:
            if not fingerprint_data:
                return None
            
            # Extract stable hardware characteristics that don't change between browsers
            stable_components = {}
            
            # Screen resolution and pixel ratio (hardware characteristic)
            if 'screen' in fingerprint_data:
                stable_components['screen'] = fingerprint_data['screen']
            
            # Hardware concurrency (CPU cores)
            if 'hw' in fingerprint_data:
                stable_components['hw'] = fingerprint_data['hw']
            
            # Platform (OS)
            if 'platform' in fingerprint_data:
                stable_components['platform'] = fingerprint_data['platform']
            
            # Timezone (location-based, stable)
            if 'timezone' in fingerprint_data:
                stable_components['timezone'] = fingerprint_data['timezone']
            
            # Language (user preference, relatively stable)
            if 'language' in fingerprint_data:
                stable_components['language'] = fingerprint_data['language']
            
            # Note: We intentionally exclude 'isIncognito' from stable hash
            # because incognito mode can change between sessions but it's the same physical device
            
            if not stable_components:
                return None
            
            # Sort keys for consistent hashing
            sorted_data = json.dumps(stable_components, sort_keys=True, separators=(',', ':'))
            
            # Use device secret from config
            secret = getattr(settings, 'DEVICE_SECRET', 'default-device-secret-key')
            
            # Compute HMAC SHA256
            stable_hash = hmac.new(
                secret.encode('utf-8'),
                sorted_data.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            logger.debug(f"Computed stable device hash: {stable_hash[:16]}...")
            return stable_hash
            
        except Exception as e:
            logger.error(f"Failed to compute stable device hash: {str(e)}")
            return None

    @staticmethod
    def precheck_device_binding(
        db: Session,
        user_id: int,
        device_uuid: str = None,
        fingerprint_data: Dict[str, Any] = None,
        request: Request = None,
        device_type_override: str = None
    ) -> None:
        """Validate that the device identifiers are not already bound to another user without creating a record."""
        try:
            # Get request info
            ip_address = DeviceService.get_client_ip(request) if request else None
            user_agent = request.headers.get("user-agent", "") if request else ""

            # Use device type override from frontend if provided, otherwise detect from user agent
            if device_type_override and device_type_override in ['mobile', 'desktop']:
                device_type = device_type_override
                logger.info(f"Using device type from frontend: {device_type}")
            else:
                device_type = DeviceService.detect_device_type(user_agent)
                logger.info(f"Detected device type from user agent: {device_type}")

            # Compute fingerprint hash if provided
            fingerprint_hash = None
            stable_device_hash = None
            if fingerprint_data:
                fingerprint_hash = DeviceService.compute_fingerprint_hash(fingerprint_data)
                stable_device_hash = DeviceService.compute_stable_device_hash(fingerprint_data)

            logger.info(f"🔍 Pre-checking device binding for user {user_id}:")
            logger.info(f"   - Device UUID: {device_uuid}")
            logger.info(f"   - Device Type: {device_type}")
            logger.info(f"   - IP: {ip_address}")
            logger.info(f"   - Fingerprint Hash: {fingerprint_hash[:16] if fingerprint_hash else 'None'}...")
            logger.info(f"   - Stable Device Hash: {stable_device_hash[:16] if stable_device_hash else 'None'}...")

            # Check if device UUID belongs to another user
            if device_uuid:
                existing_device = db.query(Device).filter(
                    Device.device_uuid == device_uuid,
                    Device.is_active == True
                ).first()

                if existing_device and existing_device.user_id != user_id:
                    logger.warning(f"🚫 Device UUID {device_uuid} already bound to user {existing_device.user_id}, blocking user {user_id}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="This device is already registered to another account. Each device can only be used by one user."
                    )

            # CRITICAL: Check if fingerprint belongs to another user (PERMANENT BINDING)
            if fingerprint_hash:
                existing_fingerprint_other_user = db.query(Device).filter(
                    Device.fingerprint_hash == fingerprint_hash,
                    Device.user_id != user_id,
                    Device.is_active == True
                ).first()

                if existing_fingerprint_other_user:
                    logger.warning(f"🚫 Fingerprint already registered to different user {existing_fingerprint_other_user.user_id}, blocking user {user_id}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="This device fingerprint is already registered to another account. Each device can only be used by one user."
                    )

                # CRITICAL: Check if stable device hash belongs to another user (PERMANENT BINDING)
                # This prevents device sharing between users for both mobile and desktop
                existing_stable_other_user = db.query(Device).filter(
                    Device.user_id != user_id,
                    Device.device_type == device_type,
                    Device.is_active == True
                ).all()

                for device in existing_stable_other_user:
                    if device.fingerprint_components:
                        existing_stable_hash = DeviceService.compute_stable_device_hash(device.fingerprint_components)
                        if existing_stable_hash == stable_device_hash:
                            logger.warning(f"🚫 Physical {device_type} device already registered to different user {device.user_id}, blocking user {user_id}")
                            raise HTTPException(
                                status_code=status.HTTP_403_FORBIDDEN,
                                detail="This device is already registered to another account. Each device can only be used by one user."
                            )

            # Log successful precheck
            device_monitoring.log_device_registration(
                user_id=user_id,
                device_uuid=device_uuid,
                device_type=device_type,
                ip_address=ip_address,
                user_agent=user_agent,
                fingerprint_hash=fingerprint_hash,
                is_new_device=False  # Precheck, not actual registration
            )

            logger.info(f"✅ Pre-check passed for user {user_id} (UUID: {device_uuid}, IP: {ip_address}, Device Type: {device_type})")

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error pre-checking device binding: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to validate device identity"
            )

    @staticmethod
    def register_device(
        db: Session, 
        user_id: int, 
        device_uuid: str = None,
        fingerprint_data: Dict[str, Any] = None,
        request: Request = None,
        device_type_override: str = None
    ) -> Tuple[Device, bool]:
        """
        Register a new device for the user
        
        Returns:
            Tuple[Device, bool]: (device, is_new_device)
        """
        try:
            # Generate device UUID if not provided
            if not device_uuid:
                logger.warning(f"⚠️ No device UUID provided for user {user_id}, generating new one")
                device_uuid = str(uuid.uuid4())
            
            # Get request info
            ip_address = DeviceService.get_client_ip(request) if request else None
            user_agent = request.headers.get("user-agent", "") if request else ""
            
            # Use device type override from frontend if provided, otherwise detect from user agent
            if device_type_override and device_type_override in ['mobile', 'desktop']:
                device_type = device_type_override
                logger.info(f"Using device type from frontend: {device_type}")
            else:
                device_type = DeviceService.detect_device_type(user_agent)
                logger.info(f"Detected device type from user agent: {device_type}")
            
            # Compute fingerprint hash if provided
            fingerprint_hash = None
            stable_device_hash = None
            if fingerprint_data:
                fingerprint_hash = DeviceService.compute_fingerprint_hash(fingerprint_data)
                stable_device_hash = DeviceService.compute_stable_device_hash(fingerprint_data)
            
            logger.info(f"🔍 Registering device for user {user_id}:")
            logger.info(f"   - Device UUID: {device_uuid}")
            logger.info(f"   - Device Type: {device_type}")
            logger.info(f"   - IP: {ip_address}")
            logger.info(f"   - Fingerprint Hash: {fingerprint_hash[:16] if fingerprint_hash else 'None'}...")
            logger.info(f"   - Stable Device Hash: {stable_device_hash[:16] if stable_device_hash else 'None'}...")
            
            # Check if device already exists by UUID
            existing_device = db.query(Device).filter(
                Device.device_uuid == device_uuid,
                Device.is_active == True
            ).first()
            
            if existing_device:
                if existing_device.user_id == user_id:
                    # Device belongs to this user - update last_used
                    existing_device.last_used = datetime.utcnow()
                    if ip_address:
                        existing_device.ip_address = ip_address
                    if user_agent:
                        existing_device.user_agent = user_agent
                    db.commit()
                    logger.info(f"✅ Device already registered for user {user_id}, updated last_used")
                    return existing_device, False
                else:
                    # Device belongs to different user - PERMANENT BINDING ENFORCEMENT
                    logger.warning(f"🚫 Device UUID {device_uuid} belongs to different user {existing_device.user_id}, blocking user {user_id}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="This device is already registered to another account. Each device can only be used by one user."
                    )
            
            # Check if user has a device with same fingerprint (same physical device)
            # Use more flexible matching for better cross-browser compatibility
            if fingerprint_hash and stable_device_hash:
                # First try exact fingerprint match
                existing_fingerprint_device = db.query(Device).filter(
                    Device.user_id == user_id,
                    Device.fingerprint_hash == fingerprint_hash,
                    Device.is_active == True
                ).first()
                
                if existing_fingerprint_device:
                    # Same physical device, different browser - allow and update
                    logger.info(f"✅ Exact fingerprint match detected for user {user_id}, updating browser info")
                    existing_fingerprint_device.last_used = datetime.utcnow()
                    existing_fingerprint_device.user_agent = user_agent
                    existing_fingerprint_device.ip_address = ip_address
                    db.commit()
                    return existing_fingerprint_device, False
                
                # Try stable device hash match (more stable across browsers/incognito modes)
                # This helps detect same physical device across different browsers
                # Works for both mobile and desktop - any browser on same device should work
                existing_stable_device = db.query(Device).filter(
                    Device.user_id == user_id,
                    Device.device_type == device_type,
                    Device.is_active == True
                ).all()
                
                for device in existing_stable_device:
                    if device.fingerprint_components:
                        existing_stable_hash = DeviceService.compute_stable_device_hash(device.fingerprint_components)
                        if existing_stable_hash == stable_device_hash:
                            # Same physical device, different browser/incognito mode - allow and update
                            logger.info(f"✅ Stable {device_type} device match detected for user {user_id}, updating browser info")
                            device.last_used = datetime.utcnow()
                            device.user_agent = user_agent
                            device.ip_address = ip_address
                            device.fingerprint_hash = fingerprint_hash
                            device.fingerprint_components = fingerprint_data
                            db.commit()
                            return device, False
                
                # CRITICAL: Check if fingerprint belongs to another user (PERMANENT BINDING)
                existing_fingerprint_other_user = db.query(Device).filter(
                    Device.fingerprint_hash == fingerprint_hash,
                    Device.user_id != user_id,
                    Device.is_active == True
                ).first()
                
                if existing_fingerprint_other_user:
                    logger.warning(f"🚫 Fingerprint already registered to different user {existing_fingerprint_other_user.user_id}, blocking user {user_id}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="This device fingerprint is already registered to another account. Each device can only be used by one user."
                    )
                
                # CRITICAL: Check if stable device hash belongs to another user (PERMANENT BINDING)
                # This prevents device sharing between users for both mobile and desktop
                existing_stable_other_user = db.query(Device).filter(
                    Device.user_id != user_id,
                    Device.device_type == device_type,
                    Device.is_active == True
                ).all()
                
                for device in existing_stable_other_user:
                    if device.fingerprint_components:
                        existing_stable_hash = DeviceService.compute_stable_device_hash(device.fingerprint_components)
                        if existing_stable_hash == stable_device_hash:
                            logger.warning(f"🚫 Physical {device_type} device already registered to different user {device.user_id}, blocking user {user_id}")
                            raise HTTPException(
                                status_code=status.HTTP_403_FORBIDDEN,
                                detail="This device is already registered to another account. Each device can only be used by one user."
                            )
                
                # Try IP-based matching for same physical device (works for both mobile and desktop)
                if ip_address:
                    existing_ip_device = db.query(Device).filter(
                        Device.user_id == user_id,
                        Device.ip_address == ip_address,
                        Device.device_type == device_type,
                        Device.is_active == True
                    ).first()
                    
                    if existing_ip_device:
                        # Same IP and device type - likely same physical device, different browser
                        logger.info(f"✅ Same IP and {device_type} device type detected for user {user_id}, updating browser info")
                        existing_ip_device.last_used = datetime.utcnow()
                        existing_ip_device.user_agent = user_agent
                        existing_ip_device.fingerprint_hash = fingerprint_hash
                        existing_ip_device.fingerprint_components = fingerprint_data
                        db.commit()
                        return existing_ip_device, False
            
            # Check if user already has a device of this type
            # Policy: 1 mobile + 1 desktop per user, STRICT BINDING
            # User cannot switch devices - must contact support to change device
            # Any browser on the SAME registered device should work
            existing_user_device = db.query(Device).filter(
                Device.user_id == user_id,
                Device.device_type == device_type,
                Device.is_active == True
            ).first()
            
            if existing_user_device:
                # User already has a device of this type - BLOCK login on different device
                # User must use the same registered device until admin deletes it from database
                logger.warning(f"� User {user_id} already has a {device_type} device registered - blocking new device")
                
                # Log device limit reached event
                device_monitoring.log_device_limit_reached(
                    user_id=user_id,
                    device_type=device_type,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    existing_devices_count=1
                )
                
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Device limit reached. You already have a {device_type} device registered. Please contact support to change your device."
                )
            
            # Create new device
            new_device = Device(
                user_id=user_id,
                device_uuid=device_uuid,
                device_type=device_type,
                fingerprint_hash=fingerprint_hash,
                fingerprint_components=fingerprint_data,
                ip_address=ip_address,
                user_agent=user_agent,
                is_active=True,
                created_at=datetime.utcnow(),
                last_used=datetime.utcnow()
            )
            
            db.add(new_device)
            db.commit()
            db.refresh(new_device)
            
            # Log device registration event
            device_monitoring.log_device_registration(
                user_id=user_id,
                device_uuid=device_uuid,
                device_type=device_type,
                ip_address=ip_address,
                user_agent=user_agent,
                fingerprint_hash=fingerprint_hash,
                is_new_device=True
            )
            
            logger.info(f" New {device_type} device registered for user {user_id}")
            return new_device, True
            
        except IntegrityError as e:
            db.rollback()
            logger.error(f" Database integrity error during device registration: {str(e)}")
            # For desktop devices, any integrity error likely means the (user_id, device_type)
            # unique constraint was hit. In that case, reuse the existing desktop device
            # instead of blocking login, so multiple browsers on the same machine work.
            if "device_type" in locals() and device_type == "desktop":
                try:
                    existing_user_device = db.query(Device).filter(
                        Device.user_id == user_id,
                        Device.device_type == device_type,
                        Device.is_active == True
                    ).first()
                    
                    if existing_user_device:
                        existing_user_device.last_used = datetime.utcnow()
                        if "ip_address" in locals() and ip_address:
                            existing_user_device.ip_address = ip_address
                        if "user_agent" in locals() and user_agent:
                            existing_user_device.user_agent = user_agent
                        if "fingerprint_hash" in locals() and fingerprint_hash:
                            existing_user_device.fingerprint_hash = fingerprint_hash
                            existing_user_device.fingerprint_components = fingerprint_data
                        db.commit()
                        logger.info(f" Reused existing {device_type} device for user {user_id} after integrity error")
                        return existing_user_device, False
                except Exception as recovery_error:
                    db.rollback()
                    logger.error(f" Failed to recover from device registration integrity error: {str(recovery_error)}")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Device registration conflict. Please try again."
            )
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Error registering device: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to register device"
            )
    
    @staticmethod
    def find_device_by_fingerprint(
        db: Session, 
        user_id: int, 
        fingerprint_data: Dict[str, Any],
        device_type: str
    ) -> Optional[Device]:
        """Find existing device by fingerprint hash - ENFORCES USER BINDING"""
        try:
            fingerprint_hash = DeviceService.compute_fingerprint_hash(fingerprint_data)
            
            # First check if fingerprint belongs to this user
            device = db.query(Device).filter(
                Device.user_id == user_id,
                Device.device_type == device_type,
                Device.fingerprint_hash == fingerprint_hash,
                Device.is_active == True
            ).first()
            
            if device:
                logger.info(f"🔍 Found existing device by fingerprint for user {user_id}")
                # Update last_used
                device.last_used = datetime.utcnow()
                db.commit()
                return device
            
            # CRITICAL: Check if fingerprint belongs to another user (PERMANENT BINDING)
            other_user_device = db.query(Device).filter(
                Device.fingerprint_hash == fingerprint_hash,
                Device.user_id != user_id,
                Device.is_active == True
            ).first()
            
            if other_user_device:
                logger.warning(f"🚫 Fingerprint belongs to different user {other_user_device.user_id}, blocking user {user_id}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This device fingerprint is already registered to another account. Each device can only be used by one user."
                )
            
            return None
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error finding device by fingerprint: {str(e)}")
            return None
    
    @staticmethod
    def get_user_devices(db: Session, user_id: int) -> list[Device]:
        """Get all active devices for a user"""
        return db.query(Device).filter(
            Device.user_id == user_id,
            Device.is_active == True
        ).order_by(Device.last_used.desc()).all()
    
    @staticmethod
    def deactivate_device(db: Session, user_id: int, device_uuid: str) -> bool:
        """Deactivate a device for a user"""
        try:
            device = db.query(Device).filter(
                Device.user_id == user_id,
                Device.device_uuid == device_uuid,
                Device.is_active == True
            ).first()
            
            if not device:
                return False
            
            device.is_active = False
            db.commit()
            
            # Log device deactivation event
            device_monitoring.log_device_deactivation(
                user_id=user_id,
                device_uuid=device_uuid,
                device_type=device.device_type,
                reason="user_requested"
            )
            
            logger.info(f"✅ Device {device_uuid} deactivated for user {user_id}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error deactivating device: {str(e)}")
            return False
    
    @staticmethod
    def replace_device(
        db: Session, 
        user_id: int, 
        old_device_uuid: str,
        new_device_uuid: str = None,
        fingerprint_data: Dict[str, Any] = None,
        request: Request = None
    ) -> Device:
        """Replace an existing device with a new one"""
        try:
            # Deactivate old device
            if not DeviceService.deactivate_device(db, user_id, old_device_uuid):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Old device not found"
                )
            
            # Register new device
            new_device, _ = DeviceService.register_device(
                db, user_id, new_device_uuid, fingerprint_data, request
            )
            
            logger.info(f"✅ Device replaced for user {user_id}: {old_device_uuid} -> {new_device.device_uuid}")
            return new_device
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error replacing device: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to replace device"
            )
    
    @staticmethod
    def cleanup_inactive_devices(db: Session, days_threshold: int = 30) -> int:
        """Clean up devices that haven't been used for specified days"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_threshold)
            
            inactive_devices = db.query(Device).filter(
                Device.last_used < cutoff_date,
                Device.is_active == True
            ).all()
            
            count = len(inactive_devices)
            
            for device in inactive_devices:
                device.is_active = False
            
            db.commit()
            
            logger.info(f"✅ Cleaned up {count} inactive devices")
            return count
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error cleaning up inactive devices: {str(e)}")
            return 0
    
    @staticmethod
    def reset_device_binding(db: Session, device_uuid: str, admin_user_id: int) -> bool:
        """
        ADMIN ONLY: Reset device binding to allow it to be used by any user
        This should only be used in cases where device ownership changes
        """
        try:
            device = db.query(Device).filter(
                Device.device_uuid == device_uuid,
                Device.is_active == True
            ).first()
            
            if not device:
                logger.warning(f"Device {device_uuid} not found for reset")
                return False
            
            # Log the reset action
            logger.warning(f"🔧 ADMIN RESET: Device {device_uuid} binding reset by admin {admin_user_id}")
            logger.warning(f"   - Previous owner: {device.user_id}")
            logger.warning(f"   - Device type: {device.device_type}")
            logger.warning(f"   - Fingerprint: {device.fingerprint_hash[:16] if device.fingerprint_hash else 'None'}...")
            
            # Deactivate the device
            device.is_active = False
            db.commit()
            
            # Log device reset event
            device_monitoring.log_device_deactivation(
                user_id=device.user_id,
                device_uuid=device_uuid,
                device_type=device.device_type,
                reason="admin_reset"
            )
            
            logger.info(f"✅ Device {device_uuid} binding reset successfully")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error resetting device binding: {str(e)}")
            return False

