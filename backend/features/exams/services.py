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
from .models import Exam, Question

User = get_user_model()


def _is_owner_or_superuser(exam: Exam, user) -> bool:
    if getattr(user, "is_admin", lambda: False)():
        return True
    return exam.created_by_id == getattr(user, "id", None) or getattr(
        user, "is_superuser", False
    )


def assert_can_modify_exam(exam: Exam, user) -> None:
    if not _is_owner_or_superuser(exam, user):
        raise PermissionDenied(
            "You can only modify exams you created (or as superuser)."
        )


def assert_can_create_exam(user) -> None:
    if not getattr(user, "is_admin", lambda: False)():
        raise PermissionDenied("Only admins can create exams.")


def exam_is_open_for_taking(exam: Exam) -> bool:
    if exam.status != Exam.Status.ACTIVE:
        return False
    now = timezone.now()
    if exam.available_from and now < exam.available_from:
        return False
    if exam.available_until and now > exam.available_until:
        return False
    return True


def assert_exam_available_for_user(exam: Exam, user) -> None:
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
            f"Only {len(questions)} question(s) — entrance exams often use more items."
        )

    return {
        "ready": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "question_count": len(questions),
        "total_points": total_points,
    }


def publish_exam(exam: Exam, user) -> ExamLifecycleResult:
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
    assert_can_modify_exam(exam, user)

    if exam.status == Exam.Status.ARCHIVED:
        raise ValidationError({"status": "Exam is already archived."})

    exam.status = Exam.Status.ARCHIVED
    exam.save(update_fields=["status", "updated_at"])
    return ExamLifecycleResult(exam=exam, message="Exam archived successfully.")


def delete_exam(exam: Exam, user) -> None:
    assert_can_modify_exam(exam, user)
    exam.delete()


def _next_question_order(exam: Exam) -> int:
    current = exam.questions.aggregate(max_order=Max("order"))["max_order"] or 0
    return current + 1


def create_question_for_exam(*, exam: Exam, user, serializer) -> Question:
    assert_can_modify_exam(exam, user)
    order = serializer.validated_data.get("order")
    if not order:
        serializer.validated_data["order"] = _next_question_order(exam)
    return serializer.save(exam=exam)


def update_question(question: Question, user, serializer) -> Question:
    assert_can_modify_exam(question.exam, user)
    return serializer.save()


def delete_question(question: Question, user) -> None:
    assert_can_modify_exam(question.exam, user)
    exam = question.exam
    question.delete()
    exam.update_question_count()


def reorder_questions(exam: Exam, user, ordered_ids: list[int]) -> list[Question]:
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


def _parse_csv_questions(csv_text: str) -> list[dict[str, Any]]:
    reader = csv.reader(io.StringIO(csv_text.strip()))
    rows: list[dict[str, Any]] = []
    for line_no, row in enumerate(reader, start=1):
        if not row or all(not cell.strip() for cell in row):
            continue
        if row[0].strip().lower().startswith("question"):
            continue
        if len(row) < 3:
            raise ValidationError(
                {
                    "csv": (
                        f"Line {line_no}: expected at least "
                        "question_text,type,correct_answer[,options][,points]"
                    )
                }
            )
        question_text = row[0].strip()
        qtype = row[1].strip().lower()
        options: list[str] = []
        correct_answer = ""
        points = 1

        if qtype == Question.QuestionType.MULTIPLE_CHOICE:
            if len(row) < 4:
                raise ValidationError(
                    {"csv": f"Line {line_no}: MC needs options and correct answer columns."}
                )
            options = [o.strip() for o in row[2].split("|") if o.strip()]
            correct_answer = row[3].strip()
            if len(row) > 4 and row[4].strip():
                points = int(row[4])
        else:
            correct_answer = row[2].strip()
            if len(row) > 3 and row[3].strip():
                points = int(row[3])

        rows.append(
            {
                "question_text": question_text,
                "question_type": qtype,
                "options": options,
                "correct_answer": correct_answer,
                "points": points,
            }
        )
    return rows


def import_questions(
    exam: Exam,
    user,
    *,
    csv_text: str | None = None,
    items: list[dict[str, Any]] | None = None,
) -> list[Question]:
    assert_can_modify_exam(exam, user)
    raw_items = items or []
    if csv_text:
        raw_items = _parse_csv_questions(csv_text)
    if not raw_items:
        raise ValidationError({"import": "No questions found to import."})

    created: list[Question] = []
    order = _next_question_order(exam)
    with transaction.atomic():
        for item in raw_items:
            serializer_data = {
                "question_text": item.get("question_text", ""),
                "question_type": item.get("question_type", Question.QuestionType.MULTIPLE_CHOICE),
                "options": item.get("options") or [],
                "correct_answer": item.get("correct_answer", ""),
                "points": item.get("points", 1),
                "order": order,
            }
            from .serializers import QuestionCreateUpdateSerializer

            ser = QuestionCreateUpdateSerializer(data=serializer_data)
            ser.is_valid(raise_exception=True)
            created.append(ser.save(exam=exam))
            order += 1
    exam.update_question_count()
    return created


def attach_creator(exam: Exam, user) -> None:
    exam.created_by = user
