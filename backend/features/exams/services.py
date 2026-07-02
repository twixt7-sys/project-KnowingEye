"""Business logic for the exams feature."""

from __future__ import annotations

import csv
import io
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .dto import ExamLifecycleResult
from .models import Department, Exam, Question

User = get_user_model()


def _is_owner_or_superuser(exam: Exam, user) -> bool:
    """Return whether ``user`` owns ``exam`` or has elevated privileges.

    Args:
        exam: The exam being checked.
        user: The requesting user.

    Returns:
        ``True`` if the user is an admin, the exam's creator, or a superuser.
    """
    if getattr(user, "is_admin", lambda: False)():
        return True
    return exam.created_by_id == getattr(user, "id", None) or getattr(
        user, "is_superuser", False
    )


def assert_can_modify_exam(exam: Exam, user) -> None:
    """Ensure ``user`` is allowed to modify ``exam``.

    Args:
        exam: The exam to be modified.
        user: The requesting user.

    Raises:
        PermissionDenied: If the user neither owns the exam nor is a superuser.
    """
    if not _is_owner_or_superuser(exam, user):
        raise PermissionDenied(
            "You can only modify exams you created (or as superuser)."
        )


def assert_can_create_exam(user) -> None:
    """Ensure ``user`` has permission to create exams.

    Args:
        user: The requesting user.

    Raises:
        PermissionDenied: If the user is not an admin.
    """
    if not getattr(user, "is_admin", lambda: False)():
        raise PermissionDenied("Only admins can create exams.")


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


def assert_exam_available_for_user(exam: Exam, user) -> None:
    """Validate that ``user`` may start an attempt on ``exam``.

    Args:
        exam: The exam the user wants to take.
        user: The requesting user.

    Raises:
        ValidationError: If the exam is outside its scheduling window or the
            user has already used all of their allowed attempts.
    """
    if not exam_is_open_for_taking(exam):
        now = timezone.now()
        if exam.available_from and now < exam.available_from:
            raise ValidationError(
                {"exam": "This exam has not opened yet. Check the scheduled start time."}
            )
        if exam.available_until and now > exam.available_until:
            raise ValidationError({"exam": "The registration window for this exam has closed."})
        raise ValidationError({"exam": "Exam is not available for taking."})

    from features.session.models import ExamSession

    completed = ExamSession.objects.filter(
        exam=exam,
        user=user,
        status=ExamSession.Status.COMPLETED,
    ).count()
    if completed >= exam.max_attempts:
        raise ValidationError(
            {
                "exam": f"Maximum attempts ({exam.max_attempts}) reached for this exam."
            }
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
            if len(q.options or []) < 2:
                issues.append(f"{label}: multiple choice needs at least 2 options.")
            elif q.correct_answer not in (q.options or []):
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

    Args:
        exam: The exam to publish.
        user: The requesting user (must be able to modify the exam).

    Returns:
        An :class:`ExamLifecycleResult` wrapping the updated exam.

    Raises:
        PermissionDenied: If the user cannot modify the exam.
        ValidationError: If the exam is not a draft or fails readiness checks.
    """
    assert_can_modify_exam(exam, user)

    if exam.status != Exam.Status.DRAFT:
        raise ValidationError(
            {"status": f"Cannot publish exam with status '{exam.status}'."}
        )

    readiness = exam_publish_readiness(exam)
    if not readiness["ready"]:
        raise ValidationError({"publish": readiness["issues"]})

    exam.status = Exam.Status.ACTIVE
    exam.save(update_fields=["status", "updated_at"])
    return ExamLifecycleResult(exam=exam, message="Exam published successfully.")


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
        PermissionDenied: If the user cannot modify the exam.
    """
    assert_can_modify_exam(exam, user)
    exam.delete()


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
    questions = {q.id: q for q in exam.questions.all()}
    if set(ordered_ids) != set(questions.keys()):
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


# Canonical import template - matches the spreadsheet template offered in the UI.
CSV_TEMPLATE_HEADERS = [
    "question_text",
    "question_type",
    "options",
    "correct_answer",
    "points",
]
_REQUIRED_HEADERS = {"question_text", "question_type"}
_VALID_QUESTION_TYPES = {t.value for t in Question.QuestionType}


def _row_from_mapping(
    row: dict[str, str], line_no: int, errors: list[str]
) -> dict[str, Any]:
    """Build a question dict from one CSV row, appending friendly errors by row."""
    question_text = (row.get("question_text") or "").strip()
    qtype = (row.get("question_type") or "").strip().lower()

    if not question_text:
        errors.append(f"Row {line_no}: 'question_text' is required.")
    if not qtype:
        errors.append(f"Row {line_no}: 'question_type' is required.")
    elif qtype not in _VALID_QUESTION_TYPES:
        valid = ", ".join(sorted(_VALID_QUESTION_TYPES))
        errors.append(
            f"Row {line_no}: '{qtype}' is not a valid question_type. Use one of: {valid}."
        )

    options_raw = (row.get("options") or "").strip()
    options = [o.strip() for o in options_raw.split("|") if o.strip()] if options_raw else []
    correct_answer = (row.get("correct_answer") or "").strip()

    points_raw = (row.get("points") or "").strip()
    points = 1
    if points_raw:
        try:
            points = int(points_raw)
        except ValueError:
            errors.append(
                f"Row {line_no}: points value '{points_raw}' must be a whole number."
            )

    return {
        "question_text": question_text,
        "question_type": qtype,
        "options": options,
        "correct_answer": correct_answer,
        "points": points,
        "_line": line_no,
    }


def _parse_csv_questions(csv_text: str) -> tuple[list[dict[str, Any]], list[str]]:
    """Parse the spreadsheet template into rows, collecting all errors with row numbers.

    Returns ``(rows, errors)``. A header row naming the columns is required so the
    file is unambiguous and mistakes are easy to point at.
    """
    # Strip a leading UTF-8 BOM (Excel adds one when saving as CSV).
    text = (csv_text or "").lstrip("\ufeff").strip()
    errors: list[str] = []
    if not text:
        return [], errors

    first_line = text.splitlines()[0]
    first_row = next(csv.reader([first_line]), [])
    header_keys = {cell.strip().lstrip("\ufeff").lower() for cell in first_row if cell.strip()}
    missing = _REQUIRED_HEADERS - header_keys
    if missing:
        expected = ", ".join(CSV_TEMPLATE_HEADERS)
        errors.append(
            "Missing or invalid header row. The first line must name the columns "
            f"({expected}). Download the template to get the exact format."
        )
        return [], errors

    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict[str, Any]] = []
    for line_no, row in enumerate(reader, start=2):
        if row is None:
            continue
        if all(not (value or "").strip() for value in row.values()):
            continue  # skip blank lines
        normalized = {
            (key or "").strip().lower(): (value or "").strip()
            for key, value in row.items()
            if key is not None
        }
        rows.append(_row_from_mapping(normalized, line_no, errors))
    return rows, errors


def _format_serializer_errors(serializer_errors: Any, line_no: Any) -> list[str]:
    """Flatten DRF serializer errors for one row into friendly, row-tagged strings."""
    out: list[str] = []
    if isinstance(serializer_errors, dict):
        for field, messages in serializer_errors.items():
            if isinstance(messages, (list, tuple)):
                text = "; ".join(str(m) for m in messages)
            else:
                text = str(messages)
            label = "error" if field == "non_field_errors" else field
            out.append(f"Row {line_no}: {label} - {text}")
    else:
        out.append(f"Row {line_no}: {serializer_errors}")
    return out


def import_questions(
    exam: Exam,
    user,
    *,
    csv_text: str | None = None,
    items: list[dict[str, Any]] | None = None,
) -> list[Question]:
    """Bulk-import questions into an exam from CSV text or structured items.

    All rows are validated up front so the caller receives every problem at
    once; the questions are only persisted (atomically) when the entire batch
    is valid.

    Args:
        exam: The exam to import questions into.
        user: The requesting user (must be able to modify the exam).
        csv_text: Raw CSV content following the import template. Mutually
            exclusive with ``items``.
        items: Pre-structured question dictionaries. Used when ``csv_text`` is
            not provided.

    Returns:
        The list of created :class:`Question` instances.

    Raises:
        PermissionDenied: If the user cannot modify the exam.
        ValidationError: If no rows are found or any row fails validation. The
            error payload contains a ``errors`` list of row-tagged messages.
    """
    assert_can_modify_exam(exam, user)

    errors: list[str] = []
    if csv_text:
        raw_items, parse_errors = _parse_csv_questions(csv_text)
        errors.extend(parse_errors)
    else:
        raw_items = [
            {**item, "_line": index}
            for index, item in enumerate(items or [], start=1)
        ]

    if not raw_items and not errors:
        raise ValidationError(
            {"errors": ["No questions found to import - the file appears to be empty."]}
        )

    from .serializers import QuestionCreateUpdateSerializer

    # Validate every row first so the proctor sees all problems at once, then
    # commit atomically (all-or-nothing) only if the whole file is clean.
    validated: list[QuestionCreateUpdateSerializer] = []
    order = _next_question_order(exam)
    for item in raw_items:
        line_no = item.get("_line", "?")
        serializer = QuestionCreateUpdateSerializer(
            data={
                "question_text": item.get("question_text", ""),
                "question_type": item.get(
                    "question_type", Question.QuestionType.MULTIPLE_CHOICE
                ),
                "options": item.get("options") or [],
                "correct_answer": item.get("correct_answer", ""),
                "points": item.get("points", 1),
                "order": order,
            }
        )
        if serializer.is_valid():
            validated.append(serializer)
            order += 1
        else:
            errors.extend(_format_serializer_errors(serializer.errors, line_no))

    if errors:
        raise ValidationError({"errors": errors})

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


def attach_creator(exam: Exam, user) -> None:
    """Set the creator of an exam in-place (without saving).

    Args:
        exam: The exam to tag.
        user: The user to record as the creator.
    """
    exam.created_by = user
