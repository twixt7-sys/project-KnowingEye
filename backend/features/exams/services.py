"""Business logic for the exams feature."""

from __future__ import annotations

import csv
import io
import re
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Max, ProtectedError
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .dto import ExamLifecycleResult
from .models import Department, Exam, ExamAssignment, Question
from .serializers import option_text

User = get_user_model()


def assert_can_modify_exam(exam: Exam, user) -> None:
    """Ensure ``user`` is allowed to modify ``exam``.

    Admins (and superusers) may modify any exam. Everyone else needs both
    the ``exams.update`` action permission (a role-default grant for
    faculty, revocable per-user) AND ownership - holding the permission is a
    prerequisite, not a bypass, so it never widens editing to exams a user
    didn't create.

    Args:
        exam: The exam to be modified.
        user: The requesting user.

    Raises:
        PermissionDenied: If the user can't modify this exam.
    """
    from core.security import service as security

    if user.is_admin() or getattr(user, "is_superuser", False):
        return
    if security.can(user, "exams.update") and exam.created_by_id == getattr(user, "id", None):
        return
    raise PermissionDenied("You can only modify exams you created (or as admin).")


def assert_can_delete_exam(exam: Exam, user) -> None:
    """Ensure ``user`` is allowed to delete ``exam``.

    Same as :func:`assert_can_modify_exam`, plus an explicit ``exams.delete``
    grant (not a faculty role default - destructive, admin-delegated only)
    as an additional path, mirroring OSAS's convention of reserving deletion
    for a narrower audience than routine edits.
    """
    from core.security import service as security

    if user.is_admin() or getattr(user, "is_superuser", False):
        return
    if security.can(user, "exams.delete"):
        return
    if security.can(user, "exams.update") and exam.created_by_id == getattr(user, "id", None):
        return
    raise PermissionDenied("You do not have permission to delete this exam.")


def assert_can_view_readiness(exam: Exam, user) -> None:
    """Ensure ``user`` may see this exam's publish-readiness report.

    Two audiences legitimately need this: whoever can modify the exam
    (creator, admin - checking their own work while building) and whoever
    has Level 1 review authority (program head, admin - judging a
    submission before approving it). Requiring only the first left a
    reviewer unable to load the "Review & publish" tab for an exam they
    didn't create, silently blanking it instead of showing the checklist.

    Raises:
        PermissionDenied: If the user is neither.
    """
    try:
        assert_can_modify_exam(exam, user)
        return
    except PermissionDenied:
        pass
    assert_can_review_exam(user)


def exam_has_active_session(exam: Exam) -> bool:
    """Whether any examinee currently has an in-progress attempt on this exam.

    Directive Area 03 ("Question management"): "lock question editing once
    an exam is in progress - students may already be answering." Checked
    against the live session state rather than only exam.status, so the
    reason an edit is blocked is always the literal one the Directive names.
    """
    from features.session.models import ExamSession

    return exam.sessions.filter(
        status__in=(ExamSession.Status.SETUP, ExamSession.Status.IN_PROGRESS)
    ).exists()


def assert_exam_editable(exam: Exam) -> None:
    """Ensure structural edits are only allowed on draft exams with no live session.

    Raises:
        ValidationError: If the exam is published/archived, or an examinee
            currently has an in-progress attempt on it.
    """
    if exam.status != Exam.Status.DRAFT:
        raise ValidationError(
            {
                "status": (
                    f"Cannot modify exam while status is '{exam.status}'. "
                    "Only draft exams can be edited."
                )
            }
        )
    if exam_has_active_session(exam):
        raise ValidationError(
            {
                "status": (
                    "Cannot modify this exam - an examinee currently has it in "
                    "progress. Wait for active sessions to finish."
                )
            }
        )


def exam_schedule_state(exam: Exam) -> str | None:
    """Derived Upcoming / Active / Closed / Expired state for the scheduling window.

    Directive Area 03 ("Scheduling & exam codes"): "show clear states."
    Computed, never stored, from `status` + the `available_from`/
    `available_until` window - `None` for a draft, since the window is only
    meaningful once an exam is published.

    Returns:
        One of ``"upcoming"``, ``"active"``, ``"closed"``, ``"expired"``, or
        ``None`` if the exam is still a draft.
    """
    if exam.status == Exam.Status.DRAFT:
        return None
    if exam.status == Exam.Status.ARCHIVED:
        return "closed"

    now = timezone.now()
    if exam.available_from and now < exam.available_from:
        return "upcoming"
    if exam.available_until and now > exam.available_until:
        return "expired"
    return "active"


def assert_can_create_exam(user) -> None:
    """Ensure ``user`` has permission to create exams.

    Args:
        user: The requesting user.

    Raises:
        PermissionDenied: If the user lacks the ``exams.create`` permission
            (granted to admins always, and to faculty by role default).
    """
    from core.security import service as security

    if not security.can(user, "exams.create"):
        raise PermissionDenied("You do not have permission to create exams.")


def exam_is_open_for_taking(exam: Exam) -> bool:
    """Return whether an exam can currently be taken.

    An exam is open when it is active and the current time falls within its
    optional availability window.

    Args:
        exam: The exam to evaluate.

    Returns:
        ``True`` if the exam is active and within its scheduled window.
    """
    if exam.status != Exam.Status.ACTIVE:
        return False
    now = timezone.now()
    if exam.available_from and now < exam.available_from:
        return False
    if exam.available_until and now > exam.available_until:
        return False
    return True


def user_is_assigned_to_exam(exam: Exam, user) -> bool:
    """Return whether the user may access a roster-restricted exam."""
    if not exam.requires_assignment:
        return True
    return ExamAssignment.objects.filter(
        exam=exam,
        user=user,
        status=ExamAssignment.Status.ELIGIBLE,
    ).exists()


def attempts_remaining_for_user(exam: Exam, user) -> int | None:
    """Return remaining attempts (None = unlimited for practice exams)."""
    if exam.is_practice:
        return None

    from features.session.models import ExamSession

    completed = ExamSession.objects.filter(
        exam=exam,
        user=user,
        status__in=(
            ExamSession.Status.COMPLETED,
            ExamSession.Status.PENDING_REVIEW,
        ),
    ).count()

    max_attempts = exam.max_attempts
    if exam.requires_assignment:
        assignment = ExamAssignment.objects.filter(
            exam=exam,
            user=user,
            status=ExamAssignment.Status.ELIGIBLE,
        ).first()
        if assignment and assignment.attempts_override:
            max_attempts = assignment.attempts_override

    return max(0, max_attempts - completed)


def assert_exam_available_for_user(exam: Exam, user) -> None:
    """Validate that ``user`` may start an attempt on ``exam``."""
    if not exam_is_open_for_taking(exam):
        now = timezone.now()
        if exam.available_from and now < exam.available_from:
            raise ValidationError(
                {"exam": "This exam has not opened yet. Check the scheduled start time."}
            )
        if exam.available_until and now > exam.available_until:
            raise ValidationError({"exam": "The registration window for this exam has closed."})
        raise ValidationError({"exam": "Exam is not available for taking."})

    if exam.requires_assignment and not user_is_assigned_to_exam(exam, user):
        raise ValidationError({"exam": "You are not assigned to this exam."})

    remaining = attempts_remaining_for_user(exam, user)
    if remaining is not None and remaining <= 0:
        raise ValidationError(
            {"exam": f"Maximum attempts ({exam.max_attempts}) reached for this exam."}
        )


def exam_publish_readiness(exam: Exam) -> dict[str, Any]:
    """Assess whether an exam is ready to be published.

    Collects blocking issues (which prevent publishing) and non-blocking
    warnings (advisory only) by inspecting the exam metadata and its questions.

    Args:
        exam: The exam to evaluate.

    Returns:
        A mapping with keys ``ready`` (bool), ``issues`` (list[str]),
        ``warnings`` (list[str]), ``question_count`` (int) and
        ``total_points`` (int).
    """
    issues: list[str] = []
    warnings: list[str] = []
    questions = list(exam.questions.order_by("order"))

    if not questions:
        issues.append("Add at least one question before publishing.")

    if not (exam.title or "").strip():
        issues.append("Exam title is required.")

    if exam.duration_minutes < 1:
        issues.append("Set a valid exam duration.")

    if not exam.available_from:
        issues.append("Set an opening date before publishing.")
    if not exam.available_until:
        issues.append("Set a closing date before publishing.")
    if exam.available_from and exam.available_until:
        if exam.available_until <= exam.available_from:
            issues.append("Schedule end must be after the start time.")

    total_points = 0
    for q in questions:
        label = f"Question {q.order}"
        if not (q.question_text or "").strip():
            issues.append(f"{label}: missing question text.")
        if q.points < 1:
            warnings.append(f"{label}: points should be at least 1.")
        total_points += q.points

        if q.question_type == Question.QuestionType.MULTIPLE_CHOICE:
            option_texts = [option_text(o) for o in (q.options or [])]
            if len([t for t in option_texts if t]) < 2:
                issues.append(f"{label}: multiple choice needs at least 2 options.")
            elif q.correct_answer not in option_texts:
                issues.append(f"{label}: correct answer must match an option.")
        elif q.question_type == Question.QuestionType.TRUE_FALSE:
            if (q.correct_answer or "").lower() not in ("true", "false"):
                issues.append(f"{label}: true/false answer must be 'true' or 'false'.")
        elif not (q.correct_answer or "").strip():
            issues.append(f"{label}: missing answer key.")

    if len(questions) < 5:
        warnings.append(
            f"Only {len(questions)} question(s) - entrance exams often use more items."
        )

    return {
        "ready": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "question_count": len(questions),
        "total_points": total_points,
    }


def publish_exam(exam: Exam, user) -> ExamLifecycleResult:
    """Transition a draft exam to the active state.

    Per the Directive's Area 01 "Administrator responsibilities" hierarchy,
    a non-admin creator's exam must carry an APPROVED approval_status before
    it can go live - the administrator no longer has to touch every exam,
    but a Level 1 (program head) sign-off still gates publish. Admins retain
    the bypass they hold everywhere else in this module.

    Args:
        exam: The exam to publish.
        user: The requesting user (must be able to modify the exam).

    Returns:
        An :class:`ExamLifecycleResult` wrapping the updated exam.

    Raises:
        PermissionDenied: If the user cannot modify the exam.
        ValidationError: If the exam is not a draft, isn't approved yet, or
            fails readiness checks.
    """
    assert_can_modify_exam(exam, user)
    assert_exam_editable(exam)

    if not (user.is_admin() or getattr(user, "is_superuser", False)):
        if exam.approval_status != Exam.ApprovalStatus.APPROVED:
            raise ValidationError(
                {
                    "approval_status": (
                        "This exam must be submitted for review and approved by a "
                        "program head before it can be published."
                    )
                }
            )

    readiness = exam_publish_readiness(exam)
    if not readiness["ready"]:
        raise ValidationError({"publish": readiness["issues"]})

    exam.status = Exam.Status.ACTIVE
    exam.save(update_fields=["status", "updated_at"])
    return ExamLifecycleResult(exam=exam, message="Exam published successfully.")


def _record_approval_event(exam: Exam, actor, action: str, note: str = "") -> None:
    from .models import ExamApprovalEvent

    ExamApprovalEvent.objects.create(exam=exam, actor=actor, action=action, note=note)


def submit_exam_for_approval(exam: Exam, user) -> ExamLifecycleResult:
    """Submit a draft exam for program-head review.

    Any user who can modify the exam (creator, or admin) may submit it.
    Resets a prior rejection back into the review queue, clearing the old
    rejection note.

    Raises:
        PermissionDenied: If the user cannot modify the exam.
        ValidationError: If the exam is not a draft, or is already pending.
    """
    assert_can_modify_exam(exam, user)
    assert_exam_editable(exam)

    if exam.approval_status == Exam.ApprovalStatus.PENDING:
        raise ValidationError({"approval_status": "This exam is already pending review."})

    readiness = exam_publish_readiness(exam)
    if not readiness["ready"]:
        raise ValidationError({"submit": readiness["issues"]})

    exam.approval_status = Exam.ApprovalStatus.PENDING
    exam.submitted_by = user
    exam.submitted_at = timezone.now()
    exam.rejection_note = ""
    exam.save(
        update_fields=[
            "approval_status",
            "submitted_by",
            "submitted_at",
            "rejection_note",
            "updated_at",
        ]
    )
    _record_approval_event(exam, user, "submit")
    return ExamLifecycleResult(exam=exam, message="Exam submitted for review.")


def assert_can_review_exam(user) -> None:
    """Ensure ``user`` holds Level 1 approval authority (program head/admin)."""
    from core.security import service as security

    if user.is_admin() or getattr(user, "is_superuser", False):
        return
    if security.can(user, "exams.approve"):
        return
    raise PermissionDenied("You do not have permission to review exam submissions.")


def approve_exam(exam: Exam, user) -> ExamLifecycleResult:
    """Approve a pending exam submission.

    Raises:
        PermissionDenied: If the user lacks the ``exams.approve`` permission.
        ValidationError: If the exam is not currently pending review.
    """
    assert_can_review_exam(user)

    if exam.approval_status != Exam.ApprovalStatus.PENDING:
        raise ValidationError({"approval_status": "Only a pending exam can be approved."})

    exam.approval_status = Exam.ApprovalStatus.APPROVED
    exam.reviewed_by = user
    exam.reviewed_at = timezone.now()
    exam.save(update_fields=["approval_status", "reviewed_by", "reviewed_at", "updated_at"])
    _record_approval_event(exam, user, "approve")
    return ExamLifecycleResult(exam=exam, message="Exam approved.")


def reject_exam(exam: Exam, user, note: str = "") -> ExamLifecycleResult:
    """Reject a pending exam submission, returning it to the creator for revision.

    Raises:
        PermissionDenied: If the user lacks the ``exams.approve`` permission.
        ValidationError: If the exam is not currently pending review.
    """
    assert_can_review_exam(user)

    if exam.approval_status != Exam.ApprovalStatus.PENDING:
        raise ValidationError({"approval_status": "Only a pending exam can be rejected."})

    exam.approval_status = Exam.ApprovalStatus.REJECTED
    exam.reviewed_by = user
    exam.reviewed_at = timezone.now()
    exam.rejection_note = note
    exam.save(
        update_fields=[
            "approval_status",
            "reviewed_by",
            "reviewed_at",
            "rejection_note",
            "updated_at",
        ]
    )
    _record_approval_event(exam, user, "reject", note=note)
    return ExamLifecycleResult(exam=exam, message="Exam rejected.")


def archive_exam(exam: Exam, user) -> ExamLifecycleResult:
    """Archive an exam so it no longer accepts new attempts.

    Args:
        exam: The exam to archive.
        user: The requesting user (must be able to modify the exam).

    Returns:
        An :class:`ExamLifecycleResult` wrapping the updated exam.

    Raises:
        PermissionDenied: If the user cannot modify the exam.
        ValidationError: If the exam is already archived.
    """
    assert_can_modify_exam(exam, user)

    if exam.status == Exam.Status.ARCHIVED:
        raise ValidationError({"status": "Exam is already archived."})

    exam.status = Exam.Status.ARCHIVED
    exam.save(update_fields=["status", "updated_at"])
    return ExamLifecycleResult(exam=exam, message="Exam archived successfully.")


def delete_exam(exam: Exam, user) -> None:
    """Permanently delete an exam.

    Args:
        exam: The exam to delete.
        user: The requesting user (must be able to modify the exam).

    Raises:
        PermissionDenied: If the user cannot delete the exam.
        ValidationError: If the exam has exam sessions (attempts) on record.
    """
    assert_can_delete_exam(exam, user)
    try:
        exam.delete()
    except ProtectedError:
        raise ValidationError(
            {"detail": "Cannot delete an exam that has recorded attempts. Keep it archived instead."}
        )


def _next_question_order(exam: Exam) -> int:
    """Return the next sequential ``order`` value for a new question.

    Args:
        exam: The exam whose questions are being ordered.

    Returns:
        One greater than the current maximum order (or ``1`` when empty).
    """
    current = exam.questions.aggregate(max_order=Max("order"))["max_order"] or 0
    return current + 1


def create_question_for_exam(*, exam: Exam, user, serializer) -> Question:
    """Persist a new question for an exam, assigning an order if absent.

    Args:
        exam: The owning exam.
        user: The requesting user (must be able to modify the exam).
        serializer: A validated question serializer ready to save.

    Returns:
        The newly created :class:`Question`.

    Raises:
        PermissionDenied: If the user cannot modify the exam.
    """
    assert_can_modify_exam(exam, user)
    assert_exam_editable(exam)
    order = serializer.validated_data.get("order")
    if not order:
        serializer.validated_data["order"] = _next_question_order(exam)
    return serializer.save(exam=exam)


def update_question(question: Question, user, serializer) -> Question:
    """Persist updates to an existing question.

    Args:
        question: The question being updated.
        user: The requesting user (must be able to modify the exam).
        serializer: A validated question serializer ready to save.

    Returns:
        The updated :class:`Question`.

    Raises:
        PermissionDenied: If the user cannot modify the parent exam.
    """
    assert_can_modify_exam(question.exam, user)
    assert_exam_editable(question.exam)
    return serializer.save()


def delete_question(question: Question, user) -> None:
    """Delete a question and refresh the exam's cached question count.

    Args:
        question: The question to delete.
        user: The requesting user (must be able to modify the exam).

    Raises:
        PermissionDenied: If the user cannot modify the parent exam.
    """
    assert_can_modify_exam(question.exam, user)
    assert_exam_editable(question.exam)
    exam = question.exam
    question.delete()
    exam.update_question_count()


def reorder_questions(exam: Exam, user, ordered_ids: list[int]) -> list[Question]:
    """Reorder an exam's questions to match ``ordered_ids``.

    Uses a two-phase update so the temporary order values never collide with
    the unique ``(exam, order)`` constraint.

    Args:
        exam: The exam whose questions are reordered.
        user: The requesting user (must be able to modify the exam).
        ordered_ids: The complete list of question ids in their new order.

    Returns:
        The exam's questions ordered by their new ``order`` value.

    Raises:
        PermissionDenied: If the user cannot modify the exam.
        ValidationError: If ``ordered_ids`` does not match the exam's questions.
    """
    assert_can_modify_exam(exam, user)
    assert_exam_editable(exam)
    questions = {q.id: q for q in exam.questions.all()}
    if len(ordered_ids) != len(questions) or set(ordered_ids) != set(questions.keys()):
        raise ValidationError({"order": "Must include every question id exactly once."})

    with transaction.atomic():
        # Two-phase update avoids unique (exam, order) collisions.
        for q in questions.values():
            q.order = q.order + 10_000
            q.save(update_fields=["order", "updated_at"])
        for index, qid in enumerate(ordered_ids, start=1):
            questions[qid].order = index
            questions[qid].save(update_fields=["order", "updated_at"])

    return list(exam.questions.order_by("order"))


# Canonical import columns. The formal question-entry form offered in the UI
# (Excel, with letterhead + choice columns A-F) is parsed client-side into
# structured ``questions`` items; plain CSV with these headers is still
# accepted for scripted imports. `option_images` is optional and, when
# present, must align 1:1 with the choices (pipe-delimited, same order; leave
# a segment blank for a text-only option) - Directive Area 03 ("Bulk
# import"): "validate ... media references."
CSV_TEMPLATE_HEADERS = [
    "question_text",
    "question_type",
    "options",
    "option_images",
    "correct_answer",
    "points",
]
_REQUIRED_HEADERS = {"question_text", "question_type"}
_VALID_QUESTION_TYPES = {t.value for t in Question.QuestionType}
_CHOICE_LETTERS = "ABCDEFGHIJ"

# Friendly spellings people type (or pick from the form's dropdown) mapped to
# the stored question type. Keys are already passed through `_slug`.
_QUESTION_TYPE_ALIASES = {
    "mc": "multiple_choice",
    "mcq": "multiple_choice",
    "multiple_choices": "multiple_choice",
    "tf": "true_false",
    "t_f": "true_false",
    "true_or_false": "true_false",
    "sa": "short_answer",
    "identification": "short_answer",
    "long_answer": "essay",
}
_TRUE_FALSE_ALIASES = {"true": "true", "t": "true", "false": "false", "f": "false"}


def _slug(value: str) -> str:
    """Lower-case and collapse spaces, dashes, and slashes into underscores."""
    return "_".join(re.split(r"[\s\-/]+", value.strip().lower())).strip("_")


def _cell_text(value: Any) -> str:
    """Render one imported cell as trimmed text (spreadsheets send numbers/bools)."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def _is_plausible_media_reference(value: str) -> bool:
    """Loose validation for an option-image reference in an import row.

    Accepts an absolute http(s) URL or a same-origin media path (what the
    option-image upload endpoint returns) - anything else is almost
    certainly a typo'd filename rather than a usable reference.
    """
    return value.startswith(("http://", "https://", "/media/"))


class _RowIssues:
    """Collects problems for one import row as ``{row, field, message}`` dicts."""

    def __init__(self, line_no: Any, sink: list[dict[str, Any]]):
        self.line_no = line_no
        self.sink = sink
        self.count = 0

    def add(self, field: str, message: str) -> None:
        self.sink.append({"row": self.line_no, "field": field, "message": message})
        self.count += 1


def _split_choices(raw: Any) -> list[str]:
    """Choices arrive positionally (list, from the form) or pipe-delimited (CSV)."""
    if isinstance(raw, (list, tuple)):
        return [
            _cell_text(item.get("text") if isinstance(item, dict) else item)
            for item in raw
        ]
    text = _cell_text(raw)
    return [seg.strip() for seg in text.split("|")] if text else []


def _resolve_choice_answer(answer: str, labels: list[str], issues: _RowIssues) -> str:
    """Map a multiple-choice answer given as a letter or loose text to the choice text."""
    if answer in labels:
        return answer
    folded = [label.casefold() for label in labels]
    if folded.count(answer.casefold()) == 1:
        return labels[folded.index(answer.casefold())]

    letter = re.fullmatch(r"\(?(?:choice\s+)?([a-j])[).]?", answer.strip(), re.IGNORECASE)
    if letter:
        index = _CHOICE_LETTERS.index(letter.group(1).upper())
        if index < len(labels):
            return labels[index]
        last = _CHOICE_LETTERS[len(labels) - 1] if labels else "A"
        issues.add(
            "correct_answer",
            f"Correct answer is {letter.group(1).upper()}, but only choices A-{last} are filled in.",
        )
        return answer

    issues.add(
        "correct_answer",
        f"Correct answer '{answer}' doesn't match any choice. Enter the choice letter "
        "(A, B, C...) or the exact text of one of the choices.",
    )
    return answer


def _normalize_import_row(
    raw: dict[str, Any], line_no: Any, sink: list[dict[str, Any]]
) -> tuple[dict[str, Any], int]:
    """Normalize one imported row into serializer input, recording issues.

    Accepts both shapes the importer receives: structured items from the
    question-entry form (choices as a positional list, answer as a letter or
    text) and legacy CSV rows (pipe-delimited options). Returns the
    normalized row and how many issues it produced.
    """
    issues = _RowIssues(line_no, sink)
    question_text = _cell_text(raw.get("question_text"))
    qtype_raw = _cell_text(raw.get("question_type"))
    qtype = _QUESTION_TYPE_ALIASES.get(_slug(qtype_raw), _slug(qtype_raw))

    if not question_text:
        issues.add("question_text", "Question text is required.")
    if not qtype_raw:
        issues.add("question_type", "Question type is required.")
    elif qtype not in _VALID_QUESTION_TYPES:
        issues.add(
            "question_type",
            f"'{qtype_raw}' is not a question type. Use Multiple Choice, True/False, "
            "Short Answer, or Essay.",
        )

    choices = _split_choices(raw.get("options"))
    last_filled = max((i for i, c in enumerate(choices) if c), default=-1)
    gaps = [i for i in range(last_filled) if not choices[i]]
    if gaps:
        missing = ", ".join(_CHOICE_LETTERS[i] for i in gaps if i < len(_CHOICE_LETTERS))
        issues.add(
            "options",
            f"Choice {missing} is empty but a later choice is filled in. "
            "Fill the choices in order (A, B, C...).",
        )
    labels = [c for c in choices[: last_filled + 1] if c]

    images_raw = raw.get("option_images")
    image_refs = (
        [_cell_text(seg) for seg in images_raw]
        if isinstance(images_raw, (list, tuple))
        else [seg.strip() for seg in _cell_text(images_raw).split("|")]
        if _cell_text(images_raw)
        else []
    )
    while image_refs and not image_refs[-1]:
        image_refs.pop()
    if len(image_refs) > len(labels):
        issues.add(
            "option_images",
            f"There are {len(image_refs)} choice image(s) but only {len(labels)} choice(s). "
            "Use one image segment per choice, in the same order (leave a segment blank "
            "for a text-only choice).",
        )
        image_refs = []
    for ref in image_refs:
        if ref and not _is_plausible_media_reference(ref):
            issues.add(
                "option_images",
                f"Choice image '{ref}' doesn't look like a URL. Upload the image in the "
                "question editor first and paste the media URL it gives you.",
            )

    if labels and qtype in _VALID_QUESTION_TYPES and qtype != Question.QuestionType.MULTIPLE_CHOICE:
        issues.add(
            "options",
            "Choices are only used for Multiple Choice questions. Clear them, or change "
            "the question type to Multiple Choice.",
        )
        labels, image_refs = [], []

    answer = _cell_text(raw.get("correct_answer"))
    if not answer:
        issues.add(
            "correct_answer",
            "Correct answer is required"
            + (
                " (for essays, enter the grading guide or key points)."
                if qtype == Question.QuestionType.ESSAY
                else "."
            ),
        )
    elif qtype == Question.QuestionType.MULTIPLE_CHOICE and labels and not gaps:
        # With a gap the letters no longer line up; the gap issue says what to fix.
        answer = _resolve_choice_answer(answer, labels, issues)
    elif qtype == Question.QuestionType.TRUE_FALSE:
        normalized = _TRUE_FALSE_ALIASES.get(answer.lower())
        if normalized is None:
            issues.add("correct_answer", f"Use True or False for a True/False question (got '{answer}').")
        else:
            answer = normalized

    if qtype == Question.QuestionType.MULTIPLE_CHOICE and len(labels) < 2 and not gaps:
        issues.add("options", "Multiple Choice needs at least two choices (A and B).")

    points_raw = _cell_text(raw.get("points"))
    points = 1
    if points_raw:
        try:
            points = int(float(points_raw)) if float(points_raw).is_integer() else None
        except ValueError:
            points = None
        if points is None or points < 0:
            issues.add("points", f"Points must be a whole number of 0 or more (got '{points_raw}').")
            points = 1

    options = [
        {"text": label, "image": (image_refs[i] if i < len(image_refs) and image_refs[i] else None)}
        for i, label in enumerate(labels)
    ]
    return (
        {
            "question_text": question_text,
            "question_type": qtype,
            "options": options,
            "correct_answer": answer,
            "points": points,
        },
        issues.count,
    )


def _parse_csv_questions(csv_text: str) -> tuple[list[dict[str, Any]], list[str]]:
    """Parse CSV text with a header row into raw row dicts tagged with ``_line``.

    Returns ``(rows, errors)``. A header row naming the columns is required so the
    file is unambiguous and mistakes are easy to point at.
    """
    # Strip a leading UTF-8 BOM (Excel adds one when saving as CSV).
    text = (csv_text or "").lstrip("﻿").strip()
    errors: list[str] = []
    if not text:
        return [], errors

    first_line = text.splitlines()[0]
    first_row = next(csv.reader([first_line]), [])
    header_keys = {cell.strip().lstrip("﻿").lower() for cell in first_row if cell.strip()}
    missing = _REQUIRED_HEADERS - header_keys
    if missing:
        expected = ", ".join(CSV_TEMPLATE_HEADERS)
        errors.append(
            "Missing or invalid header row. The first line must name the columns "
            f"({expected}). Download the question form to get the exact format."
        )
        return [], errors

    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict[str, Any]] = []
    for line_no, row in enumerate(reader, start=2):
        if row is None:
            continue
        if all(not (value or "").strip() for value in row.values() if isinstance(value, str)):
            continue  # skip blank lines
        normalized = {
            (key or "").strip().lower(): (value or "").strip()
            for key, value in row.items()
            if key is not None and isinstance(value, str)
        }
        rows.append({**normalized, "_line": line_no})
    return rows, errors


def _format_serializer_issues(serializer_errors: Any, issues: _RowIssues) -> None:
    """Flatten DRF serializer errors for one row into row-tagged issues."""
    if isinstance(serializer_errors, dict):
        for field, messages in serializer_errors.items():
            if isinstance(messages, (list, tuple)):
                text = "; ".join(str(m) for m in messages)
            else:
                text = str(messages)
            issues.add("row" if field == "non_field_errors" else field, text)
    else:
        issues.add("row", str(serializer_errors))


def _import_validation_error(general: list[str], issues: list[dict[str, Any]]) -> ValidationError:
    """Build the import error payload.

    ``errors`` keeps the flat, human-readable list (one line per problem,
    prefixed with its row) for API clients; ``issues`` carries the same
    problems as ``{row, field, message}`` so the UI can point at the cell.
    """
    lines = list(general) + [f"Row {i['row']}: {i['message']}" for i in issues]
    return ValidationError({"errors": lines, "issues": issues})


def validate_question_import(
    exam: Exam,
    user,
    *,
    csv_text: str | None = None,
    items: list[dict[str, Any]] | None = None,
) -> list[Any]:
    """Validate a question import batch without saving anything.

    Every row is checked so the caller receives all problems at once.

    Args:
        exam: The exam the questions are destined for.
        user: The requesting user (must be able to modify the exam).
        csv_text: Raw CSV content with a header row. Mutually exclusive with
            ``items``.
        items: Structured rows (what the question-entry form is parsed into).
            Each may carry a ``row`` number - the spreadsheet row it came
            from - which is echoed back in error messages.

    Returns:
        Validated ``QuestionCreateUpdateSerializer`` instances, in row order,
        ready to ``save(exam=...)``.

    Raises:
        PermissionDenied: If the user cannot modify the exam.
        ValidationError: If no rows are found or any row fails validation. The
            payload carries ``errors`` (row-tagged strings) and ``issues``
            (``{row, field, message}`` dicts).
    """
    assert_can_modify_exam(exam, user)
    assert_exam_editable(exam)

    general: list[str] = []
    if csv_text:
        raw_items, parse_errors = _parse_csv_questions(csv_text)
        general.extend(parse_errors)
    else:
        raw_items = [
            {**item, "_line": item.get("row") or index}
            for index, item in enumerate(items or [], start=1)
        ]

    if not raw_items and not general:
        raise _import_validation_error(
            ["No questions found to import - fill in at least one row of the form."], []
        )

    from .serializers import QuestionCreateUpdateSerializer

    issues: list[dict[str, Any]] = []
    validated: list[QuestionCreateUpdateSerializer] = []
    order = _next_question_order(exam)
    for item in raw_items:
        line_no = item.get("_line", "?")
        row, problem_count = _normalize_import_row(item, line_no, issues)
        if problem_count:
            continue  # the friendlier row checks already explain what's wrong
        serializer = QuestionCreateUpdateSerializer(data={**row, "order": order})
        if serializer.is_valid():
            validated.append(serializer)
            order += 1
        else:
            _format_serializer_issues(serializer.errors, _RowIssues(line_no, issues))

    if general or issues:
        raise _import_validation_error(general, issues)
    return validated


def import_questions(
    exam: Exam,
    user,
    *,
    csv_text: str | None = None,
    items: list[dict[str, Any]] | None = None,
) -> list[Question]:
    """Bulk-import questions into an exam from CSV text or structured items.

    All rows are validated up front (see :func:`validate_question_import`);
    the questions are only persisted (atomically) when the entire batch is
    valid, so a file with one bad row imports nothing.

    Returns:
        The list of created :class:`Question` instances.

    Raises:
        PermissionDenied: If the user cannot modify the exam.
        ValidationError: If no rows are found or any row fails validation.
    """
    validated = validate_question_import(exam, user, csv_text=csv_text, items=items)
    created: list[Question] = []
    with transaction.atomic():
        for serializer in validated:
            created.append(serializer.save(exam=exam))
    exam.update_question_count()
    return created


def _next_exam_code_suffix(current: str | None) -> str:
    """Return the next alphabetic suffix (A, B, …, Z, AA, AB, …)."""
    if not current:
        return "A"
    chars = list(current.upper())
    index = len(chars) - 1
    while index >= 0:
        if chars[index] != "Z":
            chars[index] = chr(ord(chars[index]) + 1)
            return "".join(chars)
        chars[index] = "A"
        index -= 1
    return "A" + "".join(chars)


def generate_exam_code(department: Department, year: int | None = None) -> str:
    """Build the next unique exam code for a department and calendar year."""
    year = year or timezone.now().year
    prefix = f"{department.abbreviation.upper()}-{year}-"
    last_code = (
        Exam.objects.filter(exam_code__startswith=prefix)
        .order_by("-exam_code")
        .values_list("exam_code", flat=True)
        .first()
    )
    suffix = _next_exam_code_suffix(last_code[len(prefix) :] if last_code else None)
    return f"{prefix}{suffix}"


def duplicate_exam(exam: Exam, user) -> Exam:
    """Clone an exam with questions, sections, and pools (draft status)."""
    assert_can_modify_exam(exam, user)

    with transaction.atomic():
        new_exam = Exam.objects.create(
            title=f"{exam.title} (Copy)",
            description=exam.description,
            instructions=exam.instructions,
            duration_minutes=exam.duration_minutes,
            passing_score=exam.passing_score,
            department=exam.department,
            category=exam.category,
            available_from=exam.available_from,
            available_until=exam.available_until,
            max_attempts=exam.max_attempts,
            monitoring_enabled=exam.monitoring_enabled,
            shuffle_questions=exam.shuffle_questions,
            shuffle_options=exam.shuffle_options,
            disable_copy_paste=exam.disable_copy_paste,
            unanswered_counts_as_wrong=exam.unanswered_counts_as_wrong,
            requires_assignment=exam.requires_assignment,
            results_release_at=exam.results_release_at,
            show_correct_answers=exam.show_correct_answers,
            is_practice=exam.is_practice,
            presentation_mode=exam.presentation_mode,
            max_tab_switches=exam.max_tab_switches,
            status=Exam.Status.DRAFT,
            created_by=user,
        )
        if exam.department:
            new_exam.exam_code = generate_exam_code(exam.department)
            new_exam.save(update_fields=['exam_code'])
        new_exam.departments.set(exam.departments.all())

        section_map: dict[int, Any] = {}
        for section in exam.sections.order_by('order'):
            new_section = section.__class__.objects.create(
                exam=new_exam,
                title=section.title,
                instructions=section.instructions,
                order=section.order,
                questions_per_page=section.questions_per_page,
            )
            section_map[section.id] = new_section

        pool_map: dict[int, Any] = {}
        for pool in exam.question_pools.order_by('order'):
            new_pool = pool.__class__.objects.create(
                exam=new_exam,
                name=pool.name,
                draw_count=pool.draw_count,
                order=pool.order,
            )
            pool_map[pool.id] = new_pool

        for question in exam.questions.order_by('order'):
            new_q = Question.objects.create(
                exam=new_exam,
                section=section_map.get(question.section_id) if question.section_id else None,
                pool=pool_map.get(question.pool_id) if question.pool_id else None,
                question_text=question.question_text,
                question_type=question.question_type,
                options=question.options,
                correct_answer=question.correct_answer,
                points=question.points,
                order=question.order,
                shuffle_options_override=question.shuffle_options_override,
                acceptable_answers=question.acceptable_answers,
                case_sensitive=question.case_sensitive,
                trim_whitespace=question.trim_whitespace,
            )
            for att in question.attachments.all():
                att.pk = None
                att.question = new_q
                att.save()

        new_exam.update_question_count()
    return new_exam


def attach_creator(exam: Exam, user) -> None:
    """Set the creator of an exam in-place (without saving).

    Args:
        exam: The exam to tag.
        user: The user to record as the creator.
    """
    exam.created_by = user


def import_assignments(exam: Exam, user, *, csv_text: str) -> dict[str, Any]:
    """Import candidate roster from CSV (email, extra_time_minutes, seat_label)."""
    assert_can_modify_exam(exam, user)

    text = (csv_text or "").lstrip("\ufeff").strip()
    if not text:
        raise ValidationError({"csv": "CSV content is required."})

    reader = csv.DictReader(io.StringIO(text))
    created = 0
    updated = 0
    errors: list[str] = []

    for line_no, row in enumerate(reader, start=2):
        email = (row.get("email") or "").strip()
        if not email:
            errors.append(f"Row {line_no}: email is required.")
            continue
        candidate = User.objects.filter(email__iexact=email).first()
        if not candidate:
            errors.append(f"Row {line_no}: no user with email {email}.")
            continue
        extra_raw = (row.get("extra_time_minutes") or "0").strip()
        try:
            extra_time = int(extra_raw)
        except ValueError:
            errors.append(f"Row {line_no}: invalid extra_time_minutes.")
            continue
        seat_label = (row.get("seat_label") or "").strip()[:32]

        _, was_created = ExamAssignment.objects.update_or_create(
            exam=exam,
            user=candidate,
            defaults={
                "status": ExamAssignment.Status.ELIGIBLE,
                "extra_time_minutes": extra_time,
                "seat_label": seat_label,
            },
        )
        if was_created:
            created += 1
        else:
            updated += 1

    if errors:
        raise ValidationError({"errors": errors})

    return {"created": created, "updated": updated}


def exam_item_analytics(exam: Exam) -> dict[str, Any]:
    """Per-question statistics from completed sessions."""
    from features.session.models import ExamSession, Response

    sessions = ExamSession.objects.filter(
        exam=exam,
        status__in=(
            ExamSession.Status.COMPLETED,
            ExamSession.Status.PENDING_REVIEW,
        ),
    )
    session_count = sessions.count()
    items = []

    for question in exam.questions.order_by("order"):
        responses = Response.objects.filter(
            session__in=sessions,
            question=question,
        )
        total = responses.count()
        correct = responses.filter(is_correct=True).count()
        avg_time = 0
        if total:
            avg_time = sum(r.time_spent for r in responses) / total
        items.append({
            "question_id": question.id,
            "order": question.order,
            "question_type": question.question_type,
            "points": question.points,
            "response_count": total,
            "correct_count": correct,
            "correct_pct": round((correct / total) * 100, 1) if total else 0,
            "avg_time_spent": round(avg_time, 1),
        })

    return {
        "exam_id": exam.id,
        "session_count": session_count,
        "questions": items,
    }


def results_visible_to_user(exam: Exam, user) -> bool:
    """Whether an examinee may view results for this exam."""
    if exam.show_correct_answers == Exam.ShowCorrectAnswers.IMMEDIATELY:
        return True
    if exam.results_release_at and timezone.now() >= exam.results_release_at:
        return True
    return False
