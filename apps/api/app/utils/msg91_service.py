import asyncio
import json
import logging
import random
import string
import time
from typing import Any, Dict, Optional, List

import requests

from ..core.config import settings
from .redis_service import redis_client

try:
    from redis.exceptions import RedisError
except ImportError:  # pragma: no cover - redis optional in some environments
    class RedisError(Exception):
        """Fallback RedisError when redis package is unavailable."""
        pass

logger = logging.getLogger(__name__)


class MSG91Service:
    """Service for handling MSG91 WhatsApp OTP integration"""

    def __init__(self):
        self.auth_key = settings.MSG91_AUTH_KEY
        self.template_id = settings.MSG91_TEMPLATE_ID
        self.sender_id = settings.MSG91_SENDER_ID
        self.base_url = settings.MSG91_BASE_URL
        self.namespace = settings.MSG91_NAMESPACE
        self.integrated_number = settings.MSG91_INTEGRATED_NUMBER
        self.otp_length = settings.MSG91_OTP_LENGTH
        self.otp_expiry_seconds = settings.MSG91_OTP_EXPIRY_MINUTES * 60
        self.resend_interval_seconds = settings.MSG91_RESEND_INTERVAL_SECONDS
        self._fallback_store: Dict[str, Dict[str, Any]] = {}
        self._fallback_lock = asyncio.Lock()
        self._resend_fallback_store: Dict[str, float] = {}
        self._resend_lock = asyncio.Lock()

    async def _redis_set(self, key: str, value: str) -> bool:
        if redis_client is None:
            return False
        try:
            await redis_client.set(key, value, ex=self.otp_expiry_seconds)
            return True
        except (RedisError, Exception) as exc:  # type: ignore[arg-type]
            logger.warning("Redis set failed for key %s: %s. Falling back to local store.", key, exc)
            return False

    async def _redis_get(self, key: str) -> Optional[str]:
        if redis_client is None:
            return None
        try:
            return await redis_client.get(key)
        except (RedisError, Exception) as exc:  # type: ignore[arg-type]
            logger.warning("Redis get failed for key %s: %s. Checking local fallback store.", key, exc)
            return None

    async def _redis_delete(self, key: str) -> None:
        if redis_client is None:
            return
        try:
            await redis_client.delete(key)
        except (RedisError, Exception) as exc:  # type: ignore[arg-type]
            logger.warning("Redis delete failed for key %s: %s. Cleaning up local store instead.", key, exc)

    async def _redis_ttl(self, key: str) -> Optional[int]:
        if redis_client is None:
            return None
        try:
            ttl = await redis_client.ttl(key)
            return ttl
        except (RedisError, Exception) as exc:  # type: ignore[arg-type]
            logger.warning("Redis TTL failed for key %s: %s. Using local store TTL if available.", key, exc)
            return None

    async def _fallback_set(self, key: str, data: Dict[str, Any], expires_at: Optional[float] = None) -> bool:
        otp = data.get("otp")
        if otp is None:
            return False
        attempts = data.get("attempts", 0)
        expiry = expires_at if expires_at is not None else time.time() + self.otp_expiry_seconds
        async with self._fallback_lock:
            self._fallback_store[key] = {
                "otp": otp,
                "attempts": attempts,
                "expires_at": expiry,
            }
        logger.info("📦 Stored OTP in in-memory fallback for key %s (expires in %ss)", key, int(expiry - time.time()))
        return True

    async def _fallback_get(self, key: str) -> Optional[Dict[str, Any]]:
        async with self._fallback_lock:
            data = self._fallback_store.get(key)
            if not data:
                return None
            if data.get("expires_at", 0) <= time.time():
                del self._fallback_store[key]
                return None
            return data.copy()

    async def _fallback_delete(self, key: str) -> None:
        async with self._fallback_lock:
            self._fallback_store.pop(key, None)

    async def _fallback_ttl(self, key: str) -> Optional[int]:
        async with self._fallback_lock:
            data = self._fallback_store.get(key)
            if not data:
                return None
            ttl = int(data.get("expires_at", 0) - time.time())
            if ttl <= 0:
                self._fallback_store.pop(key, None)
                return None
            return ttl

    async def _resend_fallback_set(self, key: str) -> None:
        expires_at = time.time() + self.resend_interval_seconds
        async with self._resend_lock:
            self._resend_fallback_store[key] = expires_at
        logger.info(
            "⏱️ Enforcing resend interval for %s (fallback %ss)",
            key,
            self.resend_interval_seconds,
        )

    async def _resend_fallback_ttl(self, key: str) -> Optional[int]:
        async with self._resend_lock:
            expires_at = self._resend_fallback_store.get(key)
            if not expires_at:
                return None
            ttl = int(expires_at - time.time())
            if ttl <= 0:
                self._resend_fallback_store.pop(key, None)
                return None
            return ttl

    async def _set_resend_lock(self, key: str) -> None:
        stored = False
        if redis_client is not None:
            try:
                await redis_client.set(key, "1", ex=self.resend_interval_seconds)
                stored = True
            except (RedisError, Exception) as exc:  # type: ignore[arg-type]
                logger.warning(
                    "Redis set failed for resend key %s: %s. Falling back to local store.",
                    key,
                    exc,
                )
        if not stored:
            await self._resend_fallback_set(key)

    async def _check_resend_lock(self, key: str) -> Optional[int]:
        ttl = await self._redis_ttl(key)
        if ttl is not None and ttl > 0:
            return ttl
        fallback_ttl = await self._resend_fallback_ttl(key)
        if fallback_ttl is not None and fallback_ttl > 0:
            return fallback_ttl
        return None

    def generate_otp(self) -> str:
        """Generate a random OTP"""
        return ''.join(random.choices(string.digits, k=self.otp_length))

    def format_mobile_number(self, mobile: str) -> str:
        """Format mobile number for MSG91 API"""
        clean_mobile = ''.join(filter(str.isdigit, mobile))

        if len(clean_mobile) == 10:
            return f"91{clean_mobile}"
        if len(clean_mobile) == 12 and clean_mobile.startswith('91'):
            return clean_mobile
        raise ValueError(f"Invalid mobile number format: {mobile}")

    def send_otp_via_whatsapp(self, mobile: str, otp: str) -> Dict[str, Any]:
        """Send OTP via WhatsApp using MSG91 API"""
        if not self.auth_key:
            logger.warning("MSG91_AUTH_KEY not configured, using fallback OTP")
            return {
                "success": True,
                "message": "OTP sent successfully (fallback mode)",
                "otp": otp,
                "fallback": True,
            }

        try:
            formatted_mobile = self.format_mobile_number(mobile)

            payload = {
                "integrated_number": self.integrated_number,
                "content_type": "template",
                "payload": {
                    "messaging_product": "whatsapp",
                    "type": "template",
                    "template": {
                        "name": self.template_id,
                        "language": {
                            "code": "en",
                            "policy": "deterministic"
                        },
                        "namespace": self.namespace,
                        "to_and_components": [
                            {
                                "to": [formatted_mobile],
                                "components": {
                                    "body_1": {
                                        "type": "text",
                                        "value": otp
                                    },
                                    "button_1": {
                                        "subtype": "url",
                                        "type": "text",
                                        "value": otp
                                    }
                                }
                            }
                        ]
                    }
                }
            }

            logger.info("📱 Sending WhatsApp OTP to %s", formatted_mobile)
            logger.debug("📱 MSG91 payload prepared for %s", formatted_mobile)

            response = requests.post(
                self.base_url,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "authkey": self.auth_key,
                },
                timeout=30,
            )

            logger.info("📱 MSG91 response status: %s", response.status_code)
            logger.debug("📱 MSG91 response: %s", response.text)

            if response.status_code == 200:
                return {
                    "success": True,
                    "message": "OTP sent successfully via WhatsApp",
                    "response": response.json(),
                    "mobile": formatted_mobile,
                }
            logger.error(
                "❌ MSG91 API error: %s - %s", response.status_code, response.text
            )
            return {
                "success": False,
                "message": f"Failed to send OTP: {response.text}",
                "error": response.text,
            }

        except requests.exceptions.RequestException as exc:
            logger.error("❌ MSG91 API request failed: %s", exc)
            return {
                "success": False,
                "message": f"Network error: {exc}",
                "error": str(exc),
            }
        except Exception as exc:
            logger.error("❌ MSG91 service error: %s", exc)
            return {
                "success": False,
                "message": f"Service error: {exc}",
                "error": str(exc),
            }

    async def store_otp(self, mobile: str, otp: str) -> None:
        clean_mobile = ''.join(filter(str.isdigit, mobile))
        key = f"otp:{clean_mobile}"
        payload = json.dumps({"otp": otp, "attempts": 0})

        stored = await self._redis_set(key, payload)
        if not stored:
            await self._fallback_set(key, {"otp": otp, "attempts": 0})
        logger.info(
            "📱 Stored OTP for %s with expiry %ss (redis=%s)",
            clean_mobile,
            self.otp_expiry_seconds,
            stored,
        )

    async def get_otp_status(self, mobile: str) -> Dict[str, Any]:
        clean_mobile = ''.join(filter(str.isdigit, mobile))
        key = f"otp:{clean_mobile}"

        ttl = await self._redis_ttl(key)
        data: Optional[Dict[str, Any]] = None

        if ttl is None:
            data = await self._fallback_get(key)
            if not data:
                return {"exists": False, "message": "OTP not found or expired"}
            ttl = await self._fallback_ttl(key)
            if ttl is None or ttl <= 0:
                await self._fallback_delete(key)
                return {"exists": False, "message": "OTP not found or expired"}
        else:
            if ttl <= 0:
                await self._redis_delete(key)
                await self._fallback_delete(key)
                return {"exists": False, "message": "OTP not found or expired"}
            payload = await self._redis_get(key)
            if payload:
                data = json.loads(payload)
            else:
                data = await self._fallback_get(key)
                if not data:
                    return {"exists": False, "message": "OTP not found or expired"}
                ttl = await self._fallback_ttl(key)
                if ttl is None or ttl <= 0:
                    await self._fallback_delete(key)
                    return {"exists": False, "message": "OTP not found or expired"}

        return {
            "exists": True,
            "expires_in_seconds": ttl,
            "attempts": data.get("attempts", 0),
            "max_attempts": 3,
        }

    async def verify_otp(self, mobile: str, provided_otp: str) -> Dict[str, Any]:
        clean_mobile = ''.join(filter(str.isdigit, mobile))
        key = f"otp:{clean_mobile}"

        payload = await self._redis_get(key)
        if payload:
            data = json.loads(payload)
        else:
            data = await self._fallback_get(key)
            if data is None:
                logger.warning("❌ No OTP found for mobile: %s", clean_mobile)
                return {"success": False, "message": "OTP not found or expired"}

        if data.get("otp") == provided_otp:
            await self._redis_delete(key)
            await self._fallback_delete(key)
            logger.info("✅ OTP verified successfully for mobile: %s", clean_mobile)
            return {"success": True, "message": "OTP verified successfully"}

        attempts = data.get("attempts", 0) + 1
        data["attempts"] = attempts

        if attempts >= 3:
            await self._redis_delete(key)
            await self._fallback_delete(key)
            logger.warning("❌ Too many failed attempts for mobile: %s", clean_mobile)
            return {"success": False, "message": "Too many failed attempts"}

        serialized = json.dumps({k: v for k, v in data.items() if k != "expires_at"})
        if not await self._redis_set(key, serialized):
            await self._fallback_set(key, data, data.get("expires_at"))
        logger.warning("❌ Invalid OTP for mobile: %s, attempt %s", clean_mobile, attempts)
        return {"success": False, "message": "Invalid OTP"}

    async def send_and_store_otp(self, mobile: str) -> Dict[str, Any]:
        clean_mobile = ''.join(filter(str.isdigit, mobile))
        resend_key = f"otp-resend:{clean_mobile}"

        wait_ttl = await self._check_resend_lock(resend_key)
        if wait_ttl is not None and wait_ttl > 0:
            retry_seconds = max(int(wait_ttl), 1)
            logger.info(
                "⏳ OTP resend blocked for %s, retry after %ss",
                clean_mobile,
                retry_seconds,
            )
            return {
                "success": False,
                "message": f"Please wait {retry_seconds} seconds to request a new OTP",
                "retry_after_seconds": retry_seconds,
                "error_code": "OTP_RESEND_TOO_SOON",
            }

        otp = self.generate_otp()
        logger.info("📱 Generated OTP for %s", clean_mobile)

        send_result = await asyncio.to_thread(self.send_otp_via_whatsapp, mobile, otp)
        if not send_result.get("success"):
            return send_result

        await self.store_otp(mobile, otp)
        await self._set_resend_lock(resend_key)
        return {
            "success": True,
            "message": "OTP sent successfully",
            "mobile": mobile,
            "expires_in_minutes": settings.MSG91_OTP_EXPIRY_MINUTES,
            "resend_interval_seconds": self.resend_interval_seconds,
        }

    async def send_bulk_otp(
        self,
        mobiles: List[str],
        *,
        concurrency: int = 10,
    ) -> Dict[str, Any]:
        """Send OTPs to multiple mobiles concurrently with rate limiting.

        Args:
            mobiles: List of mobile numbers (10-digit or prefixed with country code).
            concurrency: Maximum number of concurrent OTP send operations.

        Returns:
            Dict summarizing successes and failures per mobile number.
        """

        semaphore = asyncio.Semaphore(max(1, concurrency))
        successes: Dict[str, Dict[str, Any]] = {}
        failures: Dict[str, Dict[str, Any]] = {}
        logger.info(f"📱 Starting bulk OTP send for {len(mobiles)} numbers")

        async def _process(mobile: str) -> None:
            clean_mobile = ''.join(filter(str.isdigit, mobile))
            if not clean_mobile:
                failures[mobile] = {
                    "success": False,
                    "message": "Invalid mobile number format",
                }
                return

            async with semaphore:
                try:
                    result = await self.send_and_store_otp(clean_mobile)
                    if result.get("success"):
                        successes[clean_mobile] = result
                        logger.info(f"✅ Bulk OTP sent successfully to {clean_mobile}")
                    else:
                        failures[clean_mobile] = result
                        logger.warning(f"❌ Bulk OTP failed for {clean_mobile}: {result.get('message')}")
                except Exception as exc:
                    logger.exception(f"Bulk OTP send error for {clean_mobile}: {exc}")
                    failures[clean_mobile] = {
                        "success": False,
                        "message": str(exc),
                    }

        await asyncio.gather(*(_process(mobile) for mobile in mobiles), return_exceptions=True)

        success_count = len(successes)
        failure_count = len(failures)
        
        logger.info(f"📱 Bulk OTP completed: {success_count} success, {failure_count} failed out of {len(mobiles)} total")
        
        return {
            "success": len(failures) == 0,
            "total": len(mobiles),
            "sent_count": success_count,
            "failed_count": failure_count,
            "sent": successes,
            "failed": failures,
        }



msg91_service = MSG91Service()

