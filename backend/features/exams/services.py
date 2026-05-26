"""Business logic for the exams feature.

The view layer should call into these functions instead of mutating models
directly. Each service is responsible for invariant checks (ownership,
lifecycle transitions, dependent-object rules) and raises the appropriate
DRF/Django exceptions so the controller layer can stay thin.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from django.contrib.auth import get_user_model
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Exam, Question

User = get_user_model()


# ---------------------------------------------------------------------------
# Ownership / authorization helpers
# ---------------------------------------------------------------------------


def _is_owner_or_superuser(exam: Exam, user) -> bool:
    return exam.created_by_id == getattr(user, "id", None) or getattr(
        user, "is_superuser", False
    )


def assert_can_modify_exam(exam: Exam, user) -> None:
    """Raise :class:`PermissionDenied` unless ``user`` may modify ``exam``."""
    if not _is_owner_or_superuser(exam, user):
        raise PermissionDenied(
            "You can only modify exams you created (or as superuser)."
        )


def assert_can_create_exam(user) -> None:
    if not getattr(user, "is_admin", lambda: False)():
        raise PermissionDenied("Only admins can create exams.")


# ---------------------------------------------------------------------------
# Lifecycle transitions
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ExamLifecycleResult:
    exam: Exam
    message: str


def publish_exam(exam: Exam, user) -> ExamLifecycleResult:
    """Promote an exam from DRAFT to ACTIVE.

    Performs ownership and integrity checks (must be DRAFT and have at least
    one question) and persists the new status.
    """
    assert_can_modify_exam(exam, user)

    if exam.status != Exam.Status.DRAFT:
        raise ValidationError(
            {"status": f"Cannot publish exam with status '{exam.status}'."}
        )

    if not exam.questions.exists():
        raise ValidationError(
            {"questions": "Cannot publish an exam with no questions."}
        )

    exam.status = Exam.Status.ACTIVE
    exam.save(update_fields=["status", "updated_at"])
    return ExamLifecycleResult(exam=exam, message="Exam published successfully.")


def archive_exam(exam: Exam, user) -> ExamLifecycleResult:
    """Move an exam to ARCHIVED."""
    assert_can_modify_exam(exam, user)

    if exam.status == Exam.Status.ARCHIVED:
        raise ValidationError({"status": "Exam is already archived."})

    exam.status = Exam.Status.ARCHIVED
    exam.save(update_fields=["status", "updated_at"])
    return ExamLifecycleResult(exam=exam, message="Exam archived successfully.")


def delete_exam(exam: Exam, user) -> None:
    assert_can_modify_exam(exam, user)
    exam.delete()


# ---------------------------------------------------------------------------
# Question helpers
# ---------------------------------------------------------------------------


def create_question_for_exam(
    *, exam: Exam, user, serializer
) -> Question:
    """Persist a new question against an exam after checking ownership."""
    assert_can_modify_exam(exam, user)
    return serializer.save(exam=exam)


def update_question(question: Question, user, serializer) -> Question:
    assert_can_modify_exam(question.exam, user)
    return serializer.save()


def delete_question(question: Question, user) -> None:
    assert_can_modify_exam(question.exam, user)
    question.delete()


# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------


def attach_creator(exam: Exam, user) -> None:
    """Stamp ``created_by`` on a freshly-built exam (used from perform_create)."""
    exam.created_by = user
