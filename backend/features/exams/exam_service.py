"""Service layer for exam CRUD backed by repositories."""

from __future__ import annotations

from shared.services.base_service import BaseService

from .repositories import ExamRepository
from .models import Exam


class ExamService(BaseService[Exam, ExamRepository]):
    def __init__(self):
        super().__init__(ExamRepository())

    def visible_to(self, user):
        return self.repository.visible_to(user)
