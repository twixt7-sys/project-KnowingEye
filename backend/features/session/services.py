"""Session lifecycle business logic."""

from __future__ import annotations

from datetime import timedelta

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ai.identity_store import has_reference
from features.session.models import ExamSession, SessionLog

SETUP_MAX_MINUTES = 30


def touch_setup_activity(session: ExamSession) -> None:
    """Reset the setup idle timer while the examinee is actively configuring proctoring."""
    if session.status != ExamSession.Status.SETUP:
        return
    session.started_at = timezone.now()
    session.save(update_fields=["started_at"])


def expire_setup_session_if_idle(
    session: ExamSession,
    *,
    ip_address: str | None = None,
    max_minutes: int = SETUP_MAX_MINUTES,
) -> bool:
    """Expire setup sessions that idle too long before the exam begins."""
    if session.status != ExamSession.Status.SETUP:
        return False
    idle_seconds = (timezone.now() - session.started_at).total_seconds()
    if idle_seconds <= max_minutes * 60:
        return False

    session.status = ExamSession.Status.EXPIRED
    session.submitted_at = timezone.now()
    session.save(update_fields=["status", "submitted_at"])

    SessionLog.objects.create(
        session=session,
        event_type=SessionLog.EventType.EXPIRED,
        ip_address=ip_address,
        details={
            "reason": "setup_timeout",
            "idle_seconds": int(idle_seconds),
            "max_minutes": max_minutes,
        },
    )
    return True


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
    """Expire if timed out; return True if proctoring/exam is still active."""
    expire_setup_session_if_idle(session, ip_address=ip_address)
    expire_session_if_timed_out(session, ip_address=ip_address)
    return session.status in (
        ExamSession.Status.SETUP,
        ExamSession.Status.IN_PROGRESS,
    )


def begin_exam_session(
    session: ExamSession,
    *,
    ip_address: str | None = None,
) -> ExamSession:
    """Transition from setup to timed in-progress after identity enrollment."""
    if not session.can_begin_exam():
        raise ValidationError(
            {"status": f"Cannot begin exam with status '{session.status}'."}
        )
    if session.exam.monitoring_enabled and not has_reference(session.id):
        raise ValidationError(
            {"identity": "Enroll a reference face before beginning the exam."}
        )

    session.status = ExamSession.Status.IN_PROGRESS
    session.exam_started_at = timezone.now()
    session.time_remaining = session.duration_seconds
    session.save(update_fields=["status", "exam_started_at", "time_remaining"])

    SessionLog.objects.create(
        session=session,
        event_type=SessionLog.EventType.EXAM_BEGAN,
        ip_address=ip_address,
        details={
            "duration_minutes": session.exam.duration_minutes,
            "monitoring_enabled": session.exam.monitoring_enabled,
        },
    )
    return session


def _create_in_progress_session(
    user,
    exam,
    *,
    ip_address: str | None,
    user_agent: str,
) -> ExamSession:
    """Create a session that starts the exam timer immediately (no proctoring)."""
    now = timezone.now()
    session = ExamSession.objects.create(
        exam=exam,
        user=user,
        ip_address=ip_address,
        user_agent=user_agent,
        status=ExamSession.Status.IN_PROGRESS,
        exam_started_at=now,
        time_remaining=exam.duration_minutes * 60,
    )
    SessionLog.objects.create(
        session=session,
        event_type=SessionLog.EventType.EXAM_BEGAN,
        ip_address=ip_address,
        details={
            "exam_title": exam.title,
            "duration_minutes": exam.duration_minutes,
            "monitoring_enabled": False,
        },
    )
    return session


def get_or_create_setup_session(user, exam, *, ip_address: str | None, user_agent: str) -> tuple[ExamSession, bool]:
    """Return an existing active session or create one for the examinee."""
    if not exam.monitoring_enabled:
        return _get_or_create_unmonitored_session(
            user,
            exam,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    existing = ExamSession.objects.filter(
        exam=exam,
        user=user,
        status=ExamSession.Status.SETUP,
    ).first()
    if existing:
        touch_setup_activity(existing)
        return existing, False

    active = ExamSession.objects.filter(
        exam=exam,
        user=user,
        status=ExamSession.Status.IN_PROGRESS,
    ).first()
    if active:
        raise ValidationError(
            {"exam": f"You already have an active session for this exam (ID: {active.id})."}
        )

    session = ExamSession.objects.create(
        exam=exam,
        user=user,
        ip_address=ip_address,
        user_agent=user_agent,
        status=ExamSession.Status.SETUP,
    )
    SessionLog.objects.create(
        session=session,
        event_type=SessionLog.EventType.STARTED,
        ip_address=ip_address,
        details={"exam_title": exam.title, "phase": "setup"},
    )
    return session, True


def _get_or_create_unmonitored_session(
    user,
    exam,
    *,
    ip_address: str | None,
    user_agent: str,
) -> tuple[ExamSession, bool]:
    """Resume or create an in-progress session when proctoring is disabled."""
    existing = ExamSession.objects.filter(
        exam=exam,
        user=user,
        status=ExamSession.Status.IN_PROGRESS,
    ).first()
    if existing:
        return existing, False

    stale_setup = ExamSession.objects.filter(
        exam=exam,
        user=user,
        status=ExamSession.Status.SETUP,
    ).first()
    if stale_setup:
        begin_exam_session(stale_setup, ip_address=ip_address)
        return stale_setup, False

    session = _create_in_progress_session(
        user,
        exam,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return session, True
