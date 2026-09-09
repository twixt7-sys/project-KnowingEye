"""Session lifecycle business logic."""

from __future__ import annotations

import logging
import random
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ai.identity_store import has_reference
from features.exams.models import ExamAssignment
from features.session.models import ExamSession, SessionLog
from features.session.submission import auto_submit_expired_session

logger = logging.getLogger(__name__)


def build_question_order(exam) -> list[int]:
    """Return question IDs in presentation order for a new attempt (pools + shuffle)."""
    pools = list(exam.question_pools.prefetch_related('questions').order_by('order'))
    pooled_ids: set[int] = set()
    ordered: list[int] = []

    for pool in pools:
        pool_qids = list(pool.questions.order_by('order').values_list('id', flat=True))
        pooled_ids.update(pool_qids)
        draw = min(pool.draw_count, len(pool_qids))
        if draw > 0:
            ordered.extend(random.sample(pool_qids, draw))

    non_pooled = list(
        exam.questions.exclude(id__in=pooled_ids).order_by('order').values_list('id', flat=True)
    )
    ordered.extend(non_pooled)

    if exam.shuffle_questions:
        random.shuffle(ordered)
    return ordered


def build_option_order(exam, question_ids: list[int]) -> dict[str, list[str]]:
    """Build per-question shuffled option lists for an attempt."""
    result: dict[str, list[str]] = {}
    questions = exam.questions.filter(id__in=question_ids).only(
        'id', 'options', 'question_type', 'shuffle_options_override'
    )
    for question in questions:
        if question.question_type not in ('multiple_choice', 'true_false'):
            continue
        shuffle = exam.shuffle_options
        if question.shuffle_options_override is not None:
            shuffle = question.shuffle_options_override
        options = list(question.options or [])
        if question.question_type == 'true_false' and not options:
            # Match the {text, image} shape every other option uses (see
            # exams/serializers.py option_text()) - the taking UI reads
            # option.text, so plain strings here render as blank, unclickable
            # choices once shuffled into option_order.
            options = [{'text': 'True', 'image': None}, {'text': 'False', 'image': None}]
        if shuffle and len(options) > 1:
            options = options.copy()
            random.shuffle(options)
        result[str(question.id)] = options
    return result


def get_assignment_accommodation(exam, user) -> tuple[int, int]:
    """Return (extra_time_minutes, attempts_override or 0)."""
    if not exam.requires_assignment:
        return 0, 0
    assignment = ExamAssignment.objects.filter(
        exam=exam,
        user=user,
        status=ExamAssignment.Status.ELIGIBLE,
    ).first()
    if not assignment:
        return 0, 0
    return assignment.extra_time_minutes, assignment.attempts_override or 0


def compute_deadline(session: ExamSession) -> timezone.datetime:
    anchor = session.exam_started_at or timezone.now()
    return anchor + timedelta(seconds=session.duration_seconds)

SETUP_MAX_MINUTES = 30

ACTIVE_STATUSES = (
    ExamSession.Status.SETUP,
    ExamSession.Status.IN_PROGRESS,
)


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
    Auto-submit or expire when exam duration is exceeded.

    Returns True when the session was transitioned out of in_progress.
    """
    if session.status != ExamSession.Status.IN_PROGRESS:
        return False
    if not session.is_expired():
        return False

    if auto_submit_expired_session(session, ip_address=ip_address):
        return True

    session.status = ExamSession.Status.EXPIRED
    session.submitted_at = timezone.now()
    session.save(update_fields=['status', 'submitted_at'])

    SessionLog.objects.create(
        session=session,
        event_type=SessionLog.EventType.EXPIRED,
        ip_address=ip_address,
        details={
            'reason': 'server_timeout',
            'duration_seconds': session.duration_seconds,
            'time_elapsed': session.time_elapsed,
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


def assert_no_other_active_exam(user, exam, *, ip_address: str | None = None) -> None:
    """Block starting a different exam while another session is still active."""
    others = (
        ExamSession.objects.filter(user=user, status__in=ACTIVE_STATUSES)
        .exclude(exam_id=exam.pk)
        .select_related("exam")
        .order_by("-started_at")
    )
    for other in others:
        if not ensure_active_session(other, ip_address=ip_address):
            continue
        phase = (
            "being set up"
            if other.status == ExamSession.Status.SETUP
            else "in progress"
        )
        raise ValidationError(
            {
                "exam": (
                    f'You already have an exam {phase}: "{other.exam.title}". '
                    "Finish or wait for that session to end before starting another exam."
                )
            }
        )


def _raise_if_integrity_blocks_create(user, exam, *, ip_address: str | None = None) -> None:
    """Turn a unique-active-session IntegrityError into a clear validation error."""
    assert_no_other_active_exam(user, exam, ip_address=ip_address)
    active = ExamSession.objects.filter(
        user=user,
        exam=exam,
        status__in=ACTIVE_STATUSES,
    ).first()
    if active:
        raise ValidationError(
            {"exam": f"You already have an active session for this exam (ID: {active.id})."}
        )
    raise ValidationError(
        {"exam": "Could not start exam session because another active session exists."}
    )


def _identity_check_bypassable() -> bool:
    """True only when running with DEBUG on and the AI pipeline explicitly
    disabled (``KE_ENABLE_PIPELINE=False``) - i.e. an environment where no
    real camera enrollment can ever succeed (CI, a headless dev/test box).
    Never true outside DEBUG, so this can't loosen monitoring anywhere real
    (staging/production always run with DEBUG off)."""
    if not settings.DEBUG:
        return False
    ke_settings = getattr(settings, "KNOWING_EYE", {})
    return not ke_settings.get("ENABLE_PIPELINE", True)


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
        if _identity_check_bypassable():
            logger.warning(
                "Bypassing identity enrollment check for session %s: DEBUG is on "
                "and the AI pipeline is disabled, so no reference could ever be "
                "enrolled here.",
                session.id,
            )
        else:
            raise ValidationError(
                {"identity": "Enroll a reference face before beginning the exam."}
            )

    extra_time, _ = get_assignment_accommodation(session.exam, session.user)
    session.accommodation_extra_minutes = extra_time
    session.status = ExamSession.Status.IN_PROGRESS
    session.exam_started_at = timezone.now()
    session.time_remaining = session.duration_seconds
    question_order = build_question_order(session.exam)
    session.question_order = question_order
    session.option_order = build_option_order(session.exam, question_order)
    session.deadline_at = compute_deadline(session)
    session.save(
        update_fields=[
            "status",
            "exam_started_at",
            "time_remaining",
            "question_order",
            "option_order",
            "deadline_at",
            "accommodation_extra_minutes",
        ]
    )

    SessionLog.objects.create(
        session=session,
        event_type=SessionLog.EventType.EXAM_BEGAN,
        ip_address=ip_address,
        details={
            "duration_minutes": session.exam.duration_minutes,
            "monitoring_enabled": session.exam.monitoring_enabled,
            "shuffle_questions": session.exam.shuffle_questions,
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
    assert_no_other_active_exam(user, exam, ip_address=ip_address)
    extra_time, _ = get_assignment_accommodation(exam, user)
    now = timezone.now()
    question_order = build_question_order(exam)
    try:
        with transaction.atomic():
            session = ExamSession.objects.create(
                exam=exam,
                user=user,
                ip_address=ip_address,
                user_agent=user_agent,
                status=ExamSession.Status.IN_PROGRESS,
                exam_started_at=now,
                time_remaining=exam.duration_minutes * 60 + extra_time * 60,
                accommodation_extra_minutes=extra_time,
                question_order=question_order,
                option_order=build_option_order(exam, question_order),
            )
            session.deadline_at = compute_deadline(session)
            session.save(update_fields=['deadline_at'])
    except IntegrityError:
        _raise_if_integrity_blocks_create(user, exam, ip_address=ip_address)
        raise  # pragma: no cover

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


def finalize_grading_if_complete(session: ExamSession) -> bool:
    """Recompute score and release results once every flagged response is graded.

    Directive Area 03 ("Results"): "hold essay results for manual grading
    (can't auto-release)" and "add email notification on result release."
    A session moves to PENDING_REVIEW at submit time when it has essay/
    unmatched short-answer responses (see ExamSession.submit_session); this
    is the other half - called after each manual grade so the session
    flips to COMPLETED, with a fresh score, the moment the last flagged
    response is graded, and the examinee is emailed that results are ready.

    Returns:
        True if this call completed the session (grading just finished).
    """
    if session.status != ExamSession.Status.PENDING_REVIEW:
        return False
    if session.responses.filter(flagged_for_review=True, points_awarded__isnull=True).exists():
        return False

    session.calculate_score()
    session.status = ExamSession.Status.COMPLETED
    session.save(update_fields=["status", "total_score", "percentage_score", "passed"])

    if session.user.email:
        send_mail(
            subject="Your exam results are ready",
            message=(
                f'Grading for "{session.exam.title}" is complete and your results '
                "are now available in Knowing Eye."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[session.user.email],
            fail_silently=True,
        )
    return True


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

    assert_no_other_active_exam(user, exam, ip_address=ip_address)

    try:
        with transaction.atomic():
            session = ExamSession.objects.create(
                exam=exam,
                user=user,
                ip_address=ip_address,
                user_agent=user_agent,
                status=ExamSession.Status.SETUP,
            )
    except IntegrityError:
        _raise_if_integrity_blocks_create(user, exam, ip_address=ip_address)
        raise  # pragma: no cover

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
