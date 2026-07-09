"""Exam submission and response persistence helpers."""

from __future__ import annotations

from django.utils import timezone

from features.session.models import ExamSession, Response, SessionLog


def upsert_response(
    session: ExamSession,
    *,
    question,
    answer_text: str = '',
    time_spent: int = 0,
    flagged_for_review: bool = False,
    autosave: bool = False,
) -> Response:
    """Create or update a single response for an in-progress session."""
    if session.status != ExamSession.Status.IN_PROGRESS:
        raise ValueError('Cannot save responses outside an in-progress session.')

    defaults = {
        'answer_text': answer_text,
        'time_spent': time_spent,
        'flagged_for_review': flagged_for_review,
    }
    if autosave:
        defaults['autosaved_at'] = timezone.now()

    response, created = Response.objects.get_or_create(
        session=session,
        question=question,
        defaults=defaults,
    )
    if not created:
        response.answer_text = answer_text
        response.time_spent = time_spent
        response.flagged_for_review = flagged_for_review
        if autosave:
            response.autosaved_at = timezone.now()
        response.points_awarded = None
        response.check_correctness()
        response.save()
    return response


def finalize_unanswered_responses(session: ExamSession) -> int:
    """Create empty responses for presented questions not yet answered."""
    presented_ids = set(session.presented_question_ids())
    answered_ids = set(session.responses.values_list('question_id', flat=True))
    missing_ids = presented_ids - answered_ids
    if not missing_ids:
        return 0

    questions = session.exam.questions.filter(id__in=missing_ids)
    created = 0
    for question in questions:
        Response.objects.create(
            session=session,
            question=question,
            answer_text='',
            time_spent=0,
            is_correct=False,
            flagged_for_review=False,
        )
        created += 1
    return created


def submit_session_with_responses(
    session: ExamSession,
    *,
    responses_data: list[dict] | None = None,
    time_remaining: int = 0,
    ip_address: str | None = None,
    source: str = 'manual',
) -> ExamSession:
    """Persist responses, fill gaps, score, and complete the session."""
    if responses_data:
        for item in responses_data:
            upsert_response(
                session,
                question=item['question'],
                answer_text=item.get('answer_text', ''),
                time_spent=item.get('time_spent', 0),
                flagged_for_review=item.get('flagged_for_review', False),
            )

    finalize_unanswered_responses(session)
    session.submit_session(time_remaining=time_remaining)

    SessionLog.objects.create(
        session=session,
        event_type=SessionLog.EventType.SUBMITTED,
        ip_address=ip_address,
        details={
            'source': source,
            'responses_count': session.responses.count(),
            'time_remaining': time_remaining,
            'total_score': session.total_score,
            'percentage_score': float(session.percentage_score)
            if session.percentage_score is not None
            else 0,
            'status': session.status,
        },
    )
    return session


def auto_submit_expired_session(
    session: ExamSession,
    *,
    ip_address: str | None = None,
) -> bool:
    """Auto-submit an expired in-progress session using saved responses."""
    if session.status != ExamSession.Status.IN_PROGRESS:
        return False
    if not session.is_expired():
        return False

    submit_session_with_responses(
        session,
        time_remaining=0,
        ip_address=ip_address,
        source='auto_timeout',
    )
    return True
