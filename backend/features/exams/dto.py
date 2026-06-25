"""Shared DTO - exam lifecycle operation result."""

from __future__ import annotations

from dataclasses import dataclass

from shared.dto.base_dto import BaseDTO

from .models import Exam


@dataclass(frozen=True)
class ExamLifecycleResult(BaseDTO):
    exam: Exam
    message: str

    def to_dict(self):
        return {
            "exam_id": self.exam.id,
            "status": self.exam.status,
            "message": self.message,
        }
