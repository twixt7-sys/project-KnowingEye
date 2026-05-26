"""Data access helpers for the exams feature.

Repositories hide ORM-level queries from the service/controller layers so
business logic stays decoupled from Django queryset details. They are
deliberately tiny and stateless; instantiate or call directly.
"""

from __future__ import annotations

from typing import Iterable, Optional

from django.db.models import QuerySet

from shared.repositories.base_repository import BaseRepository

from .models import Exam, Question


class ExamRepository(BaseRepository[Exam]):
    """Query helpers for the :class:`Exam` model."""

    def __init__(self):
        super().__init__(Exam)

    def active(self) -> QuerySet[Exam]:
        return Exam.objects.filter(status=Exam.Status.ACTIVE)

    def visible_to(self, user) -> QuerySet[Exam]:
        """Return the exams a particular user is allowed to see."""
        if getattr(user, "is_admin", lambda: False)():
            return self.all()
        return self.active()

    def by_id(self, exam_id: int) -> Optional[Exam]:
        return Exam.objects.filter(pk=exam_id).first()


class QuestionRepository(BaseRepository[Question]):
    """Query helpers for the :class:`Question` model."""

    def __init__(self):
        super().__init__(Question)

    def for_exam(self, exam_id: int) -> QuerySet[Question]:
        return Question.objects.filter(exam_id=exam_id).order_by("order")

    def bulk_for_exams(self, exam_ids: Iterable[int]) -> QuerySet[Question]:
        return Question.objects.filter(exam_id__in=list(exam_ids))
