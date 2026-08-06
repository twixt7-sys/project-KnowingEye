"""Data access helpers for the exams feature.

Repositories hide ORM-level queries from the service/controller layers so
business logic stays decoupled from Django queryset details. They are
deliberately tiny and stateless; instantiate or call directly.
"""

from __future__ import annotations

from typing import Iterable, Optional

from django.db.models import Q, QuerySet
from django.utils import timezone

from shared.repositories.base_repository import BaseRepository

from .models import Exam, ExamAssignment, Question


class ExamRepository(BaseRepository[Exam]):
    """Query helpers for the :class:`Exam` model."""

    def __init__(self):
        super().__init__(Exam)

    def active(self) -> QuerySet[Exam]:
        return Exam.objects.filter(status=Exam.Status.ACTIVE)

    def visible_to(self, user) -> QuerySet[Exam]:
        """Return the exams a particular user is allowed to see.

        Admins and anyone with the ``exams`` module (currently: faculty) get
        the full management view - every exam regardless of status, since
        they need to see their own drafts to edit them. Mutating a specific
        exam is still gated separately by ``services.assert_can_modify_exam``
        / ``assert_can_delete_exam`` (ownership required unless granted).
        Everyone else (students) gets the narrower "can I take this" view.
        """
        if getattr(user, "is_admin", lambda: False)():
            return self.all()

        from core.security import service as security

        if security.has_module(user, "exams"):
            return self.all()

        now = timezone.now()
        qs = (
            self.active()
            .filter(Q(available_from__isnull=True) | Q(available_from__lte=now))
            .filter(Q(available_until__isnull=True) | Q(available_until__gte=now))
        )
        assigned_ids = ExamAssignment.objects.filter(
            user=user,
            status=ExamAssignment.Status.ELIGIBLE,
        ).values_list('exam_id', flat=True)
        return qs.filter(
            Q(requires_assignment=False) | Q(id__in=assigned_ids)
        )

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
