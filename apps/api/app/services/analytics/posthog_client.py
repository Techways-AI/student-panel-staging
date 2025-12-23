import logging
from typing import Any, Dict, Optional
from threading import Lock

from posthog import Posthog

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: Optional[Posthog] = None
_client_lock: Lock = Lock()


def is_enabled() -> bool:
    """Return True when PostHog is configured and enabled."""
    return settings.ENABLE_POSTHOG and bool(settings.POSTHOG_API_KEY)


def _create_client() -> Optional[Posthog]:
    if not is_enabled():
        return None

    try:
        client = Posthog(
            project_api_key=settings.POSTHOG_API_KEY,
            host=settings.POSTHOG_HOST,
            debug=settings.POSTHOG_DEBUG,
        )
        logger.info("PostHog analytics client initialised")
        return client
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Failed to initialise PostHog client: %s", exc)
        return None


def init_client() -> Optional[Posthog]:
    """Initialise the PostHog client once and reuse it."""
    global _client

    if _client is not None:
        return _client

    with _client_lock:
        if _client is None:
            _client = _create_client()
    return _client


def get_client() -> Optional[Posthog]:
    return init_client()


def capture_event(
    distinct_id: str,
    event_name: str,
    properties: Optional[Dict[str, Any]] = None,
) -> None:
    if not is_enabled():
        return

    client = init_client()
    if client is None:
        return

    try:
        client.capture(distinct_id=distinct_id, event=event_name, properties=properties or {})
        if settings.POSTHOG_DEBUG:
            logger.debug("PostHog capture: %s %s", event_name, properties)
    except Exception as exc:  # pragma: no cover
        logger.debug("PostHog capture failed: %s", exc)


def identify_user(distinct_id: str, properties: Optional[Dict[str, Any]] = None) -> None:
    if not is_enabled():
        return

    client = init_client()
    if client is None:
        return

    try:
        client.identify(distinct_id=distinct_id, properties=properties or {})
        if settings.POSTHOG_DEBUG:
            logger.debug("PostHog identify: %s %s", distinct_id, properties)
    except Exception as exc:  # pragma: no cover
        logger.debug("PostHog identify failed: %s", exc)


def shutdown_client() -> None:
    global _client
    if _client is None:
        return

    try:
        _client.flush()
        _client.shutdown()
        logger.info("PostHog analytics client shutdown")
    except Exception as exc:  # pragma: no cover
        logger.debug("PostHog shutdown error: %s", exc)
    finally:
        _client = None

