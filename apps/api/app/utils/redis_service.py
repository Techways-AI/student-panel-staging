import logging
from urllib.parse import urlparse

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None

from ..core.config import settings

logger = logging.getLogger(__name__)

# Redis is optional - if not configured, redis_client will be None
# Services using redis_client should check for None and use fallback mechanisms
redis_client = None

# Try to initialize Redis if available, but don't fail if it's not configured
try:
    # Check if REDIS_URL exists in settings (it was removed, so this will fail gracefully)
    if hasattr(settings, 'REDIS_URL') and settings.REDIS_URL:
        redis_url = settings.REDIS_URL.strip()
        if redis_url and REDIS_AVAILABLE:
            parsed = urlparse(redis_url)
            host = parsed.hostname or "<unknown>"
            port = parsed.port or 6379
            db = parsed.path.lstrip("/") or "0"
            logger.info("🔗 Connecting to Redis at %s:%s (db %s)", host, port, db)
            redis_client = redis.from_url(redis_url, decode_responses=True)
        else:
            logger.info("⚠️ Redis not configured or redis package not available - using fallback storage")
    else:
        logger.info("⚠️ Redis not configured - using fallback storage")
except Exception as e:
    logger.warning(f"⚠️ Failed to initialize Redis: {e} - using fallback storage")
    redis_client = None

