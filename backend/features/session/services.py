"""Session lifecycle business logic."""

from __future__ import annotations

from django.utils import timezone

from features.session.models import ExamSession, SessionLog


def expire_session_if_timed_out(
    session: ExamSession,
    *,
    ip_address: str | None = None,
) -> bool:
    """
    Mark an in-progress session as expired when exam duration is exceeded.

    Returns True when the session was transitioned to ``expired``.
    """
    if session.status != ExamSession.Status.IN_PROGRESS:
        return False
    if not session.is_expired():
        return False

    session.status = ExamSession.Status.EXPIRED
    session.submitted_at = timezone.now()
    session.save(update_fields=["status", "submitted_at"])

    SessionLog.objects.create(
        session=session,
        event_type=SessionLog.EventType.EXPIRED,
        ip_address=ip_address,
        details={
            "reason": "server_timeout",
            "duration_seconds": session.duration_seconds,
            "time_elapsed": session.time_elapsed,
        },
    )
    return True


def ensure_active_session(session: ExamSession, *, ip_address: str | None = None) -> bool:
    """Expire if timed out; return True if still in progress."""
    expire_session_if_timed_out(session, ip_address=ip_address)
    return session.status == ExamSession.Status.IN_PROGRESS
