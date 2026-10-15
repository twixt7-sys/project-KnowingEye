"""Smoke test for `manage.py seed_demo`: exercises the real service layer.

Runs against the test database (small student count, for speed) and asserts
the full lifecycle actually happened - published/draft/pending/rejected/
archived exams, sections, a question pool, a roster assignment, and at least
some completed + pending-review sessions with real scores.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from features.exams.models import Exam, ExamAssignment, ExamCategory, ExamSection, QuestionPool
from features.session.models import ExamSession

User = get_user_model()


class SeedDemoTests(TestCase):
    def test_seed_demo_builds_a_working_dataset(self):
        call_command("seed_demo", students=12, noinput=True)

        # Roles.
        self.assertGreaterEqual(User.objects.filter(role=User.Role.STUDENT).count(), 12)
        for role in (
            User.Role.GUIDANCE_STAFF, User.Role.PROGRAM_HEAD, User.Role.FACULTY, User.Role.PROCTOR,
        ):
            self.assertGreater(User.objects.filter(role=role).count(), 0, f"missing {role}")
        for user in User.objects.exclude(role=User.Role.ADMIN):
            self.assertTrue(user.email_verified, f"{user.username} should be pre-verified")

        # Reference data.
        self.assertEqual(ExamCategory.objects.count(), 3)

        # Exam lifecycle coverage.
        statuses = set(Exam.objects.values_list("status", flat=True))
        self.assertIn(Exam.Status.DRAFT, statuses)
        self.assertIn(Exam.Status.ACTIVE, statuses)
        self.assertIn(Exam.Status.ARCHIVED, statuses)
        approval_statuses = set(Exam.objects.values_list("approval_status", flat=True))
        self.assertIn(Exam.ApprovalStatus.PENDING, approval_statuses)
        self.assertIn(Exam.ApprovalStatus.REJECTED, approval_statuses)
        self.assertIn(Exam.ApprovalStatus.APPROVED, approval_statuses)

        self.assertGreater(ExamSection.objects.count(), 0)
        self.assertGreater(QuestionPool.objects.count(), 0)
        self.assertGreater(ExamAssignment.objects.count(), 0)

        # Every question belongs to the exam it's assigned to (section FK sanity).
        for section in ExamSection.objects.select_related("exam"):
            for q in section.questions.all():
                self.assertEqual(q.exam_id, section.exam_id)

        # Sessions: at least one real completed attempt with a computed score,
        # and the essay-bearing exam produced some pending-review work.
        completed = ExamSession.objects.filter(status=ExamSession.Status.COMPLETED)
        self.assertGreater(completed.count(), 0)
        sample = completed.first()
        self.assertIsNotNone(sample.total_score)
        self.assertIsNotNone(sample.percentage_score)

        self.assertGreater(
            ExamSession.objects.filter(status=ExamSession.Status.PENDING_REVIEW).count(), 0
        )

    def test_seed_demo_respects_students_argument(self):
        call_command("seed_demo", students=7, noinput=True)
        self.assertEqual(User.objects.filter(role=User.Role.STUDENT).count(), 7)
