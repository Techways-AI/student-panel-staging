import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from ..models.device import Device
from ..models.user import User

logger = logging.getLogger(__name__)

class DeviceMonitoringService:
    """Service for monitoring and logging device events"""
    
    @staticmethod
    def log_device_event(
        event_type: str,
        user_id: int,
        device_uuid: str = None,
        device_type: str = None,
        ip_address: str = None,
        user_agent: str = None,
        additional_data: Dict[str, Any] = None
    ):
        """Log device-related events for monitoring and analytics"""
        try:
            event_data = {
                "timestamp": datetime.utcnow().isoformat(),
                "event_type": event_type,
                "user_id": user_id,
                "device_uuid": device_uuid,
                "device_type": device_type,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "additional_data": additional_data or {}
            }
            
            # Log to application logger
            logger.info(f"🔍 Device Event: {event_type}", extra=event_data)
            
            # In production, you might want to send this to external monitoring services
            # like DataDog, New Relic, or custom analytics platforms
            
        except Exception as e:
            logger.error(f"Failed to log device event: {str(e)}")
    
    @staticmethod
    def log_device_registration(
        user_id: int,
        device_uuid: str,
        device_type: str,
        ip_address: str,
        user_agent: str,
        fingerprint_hash: str,
        is_new_device: bool
    ):
        """Log device registration events"""
        DeviceMonitoringService.log_device_event(
            event_type="device_registered",
            user_id=user_id,
            device_uuid=device_uuid,
            device_type=device_type,
            ip_address=ip_address,
            user_agent=user_agent,
            additional_data={
                "fingerprint_hash": fingerprint_hash[:16] + "..." if fingerprint_hash else None,
                "is_new_device": is_new_device
            }
        )
    
    @staticmethod
    def log_device_deactivation(
        user_id: int,
        device_uuid: str,
        device_type: str,
        reason: str = "user_requested"
    ):
        """Log device deactivation events"""
        DeviceMonitoringService.log_device_event(
            event_type="device_deactivated",
            user_id=user_id,
            device_uuid=device_uuid,
            device_type=device_type,
            additional_data={
                "reason": reason
            }
        )
    
    @staticmethod
    def log_device_replacement(
        user_id: int,
        old_device_uuid: str,
        new_device_uuid: str,
        device_type: str,
        reason: str = "user_requested"
    ):
        """Log device replacement events"""
        DeviceMonitoringService.log_device_event(
            event_type="device_replaced",
            user_id=user_id,
            device_uuid=new_device_uuid,
            device_type=device_type,
            additional_data={
                "old_device_uuid": old_device_uuid,
                "reason": reason
            }
        )
    
    @staticmethod
    def log_device_limit_reached(
        user_id: int,
        device_type: str,
        ip_address: str,
        user_agent: str,
        existing_devices_count: int
    ):
        """Log when device limit is reached"""
        DeviceMonitoringService.log_device_event(
            event_type="device_limit_reached",
            user_id=user_id,
            device_type=device_type,
            ip_address=ip_address,
            user_agent=user_agent,
            additional_data={
                "existing_devices_count": existing_devices_count,
                "limit_type": f"max_{device_type}_devices"
            }
        )
    
    @staticmethod
    def log_device_conflict(
        user_id: int,
        device_uuid: str,
        device_type: str,
        ip_address: str,
        user_agent: str,
        conflict_reason: str
    ):
        """Log device conflicts (e.g., UUID belongs to different user)"""
        DeviceMonitoringService.log_device_event(
            event_type="device_conflict",
            user_id=user_id,
            device_uuid=device_uuid,
            device_type=device_type,
            ip_address=ip_address,
            user_agent=user_agent,
            additional_data={
                "conflict_reason": conflict_reason
            }
        )
    
    @staticmethod
    def log_token_validation_failure(
        user_id: int,
        device_uuid: str,
        failure_reason: str
    ):
        """Log token validation failures due to device issues"""
        DeviceMonitoringService.log_device_event(
            event_type="token_validation_failure",
            user_id=user_id,
            device_uuid=device_uuid,
            additional_data={
                "failure_reason": failure_reason
            }
        )
    
    @staticmethod
    def log_fingerprint_mismatch(
        user_id: int,
        device_type: str,
        ip_address: str,
        user_agent: str,
        fingerprint_hash: str
    ):
        """Log fingerprint mismatches during device recognition"""
        DeviceMonitoringService.log_device_event(
            event_type="fingerprint_mismatch",
            user_id=user_id,
            device_type=device_type,
            ip_address=ip_address,
            user_agent=user_agent,
            additional_data={
                "fingerprint_hash": fingerprint_hash[:16] + "..." if fingerprint_hash else None
            }
        )
    
    @staticmethod
    def get_device_analytics(db: Session, days: int = 30) -> Dict[str, Any]:
        """Get device analytics for monitoring dashboard"""
        try:
            from datetime import timedelta
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            # Total active devices
            total_devices = db.query(Device).filter(
                Device.is_active == True
            ).count()
            
            # Devices by type
            mobile_devices = db.query(Device).filter(
                Device.device_type == "mobile",
                Device.is_active == True
            ).count()
            
            desktop_devices = db.query(Device).filter(
                Device.device_type == "desktop",
                Device.is_active == True
            ).count()
            
            # Recent registrations
            recent_registrations = db.query(Device).filter(
                Device.created_at >= cutoff_date
            ).count()
            
            # Recently active devices
            recently_active = db.query(Device).filter(
                Device.last_used >= cutoff_date,
                Device.is_active == True
            ).count()
            
            # Inactive devices
            inactive_devices = db.query(Device).filter(
                Device.last_used < cutoff_date,
                Device.is_active == True
            ).count()
            
            return {
                "total_devices": total_devices,
                "mobile_devices": mobile_devices,
                "desktop_devices": desktop_devices,
                "recent_registrations": recent_registrations,
                "recently_active": recently_active,
                "inactive_devices": inactive_devices,
                "analytics_period_days": days
            }
            
        except Exception as e:
            logger.error(f"Failed to get device analytics: {str(e)}")
            return {}
    
    @staticmethod
    def log_security_event(
        event_type: str,
        user_id: int = None,
        device_uuid: str = None,
        ip_address: str = None,
        severity: str = "medium",
        description: str = None
    ):
        """Log security-related device events"""
        DeviceMonitoringService.log_device_event(
            event_type=f"security_{event_type}",
            user_id=user_id,
            device_uuid=device_uuid,
            ip_address=ip_address,
            additional_data={
                "severity": severity,
                "description": description
            }
        )

# Global instance
device_monitoring = DeviceMonitoringService()

