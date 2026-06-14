"""Per-session reference-embedding store for identity verification.

Enrollment writes one reference embedding per exam session; the per-frame
analysis path reads it back (cached) to verify the examinee's identity stays
consistent. Persisting in the DB means references survive process restarts and
work identically across the WebSocket and REST monitoring paths.
"""

from __future__ import annotations

import logging
import threading

logger = logging.getLogger("knowing_eye.ai.identity_store")

# Small in-process cache so the hot per-frame path avoids a DB hit each frame.
# Maps str(session_id) -> embedding list (or None when no reference enrolled).
_CACHE: dict[str, list[float] | None] = {}
_LOCK = threading.Lock()


def store_reference(session, embedding: list[float], backend: str) -> None:
    """Persist (or replace) the reference embedding for ``session``."""
    from features.monitoring.models import SessionIdentityReference

    SessionIdentityReference.objects.update_or_create(
        session=session,
        defaults={
            "embedding": list(embedding),
            "backend": backend,
            "dims": len(embedding),
        },
    )
    with _LOCK:
        _CACHE[str(session.id)] = list(embedding)


def get_reference_embedding(session_id) -> list[float] | None:
    """Return the enrolled reference embedding for a session, or ``None``."""
    if session_id is None:
        return None
    key = str(session_id)
    with _LOCK:
        if key in _CACHE:
            return _CACHE[key]

    from features.monitoring.models import SessionIdentityReference

    try:
        ref = SessionIdentityReference.objects.get(session_id=session_id)
        embedding: list[float] | None = ref.embedding or None
    except SessionIdentityReference.DoesNotExist:
        embedding = None
    except Exception as exc:  # noqa: BLE001 - never break the analysis path
        logger.warning("identity reference lookup failed for %s: %s", session_id, exc)
        embedding = None

    with _LOCK:
        _CACHE[key] = embedding
    return embedding


def has_reference(session_id) -> bool:
    return get_reference_embedding(session_id) is not None


def clear_cache(session_id=None) -> None:
    """Drop cached references (all, or just one session). Used by tests."""
    with _LOCK:
        if session_id is None:
            _CACHE.clear()
        else:
            _CACHE.pop(str(session_id), None)
