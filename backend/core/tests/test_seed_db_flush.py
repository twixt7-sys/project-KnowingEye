"""Tests for `manage.py seed_db --flush`: a full wipe that leaves a working admin login.

Builds a representative slice of data across every app the wipe touches
(exam, session, monitoring, behavior, auth-aux tables) via the ORM, then
asserts everything is gone except a freshly recreated bootstrap admin.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings

from features.authentication.models import EmailVerification, PermissionChange
from features.behavior.models import Alert, BehaviorLog
from features.exams.models import (
    Department,
    Exam,
    ExamAssignment,
    ExamCategory,
    ExamSection,
    Question,
    QuestionPool,
)
from features.monitoring.models import SessionIdentityReference
from features.session.models import ExamSession, Response, SessionLog

User = get_user_model()


@override_settings(
    SEED_ADMIN={
        "username": "flush_admin",
        "email": "flush_admin@test.local",
        "password": "flush-admin-pass",
        "first_name": "Flush",
        "last_name": "Admin",
    }
)
class SeedDbFlushTests(TestCase):
    def setUp(self):
        creator = User.objects.create_user(
            username="creator",
            email="creator@test.local",
            password="TestPass123!",
            role=User.Role.FACULTY,
        )
        student = User.objects.create_user(
            username="student_flush",
            email="student_flush@test.local",
            password="TestPass123!",
            role=User.Role.STUDENT,
        )
        department = Department.objects.create(name="Flush Dept", abbreviation="FLU")
        category = ExamCategory.objects.create(name="Flush Category", slug="flush-category")
        exam = Exam.objects.create(
            title="Flush Exam",
            description="",
            duration_minutes=30,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            department=department,
            category=category,
            created_by=creator,
        )
        section = ExamSection.objects.create(exam=exam, title="Part A", order=1)
        QuestionPool.objects.create(exam=exam, name="Pool A", draw_count=1, order=1)
        ExamAssignment.objects.create(exam=exam, user=student)
        question = Question.objects.create(
            exam=exam,
            section=section,
            question_text="Q1",
            question_type=Question.QuestionType.TRUE_FALSE,
            options=["True", "False"],
            correct_answer="True",
            points=1,
            order=1,
        )
        session = ExamSession.objects.create(
            exam=exam,
            user=student,
            status=ExamSession.Status.IN_PROGRESS,
        )
        Response.objects.create(session=session, question=question, answer_text="True")
        SessionLog.objects.create(session=session, event_type=SessionLog.EventType.STARTED)
        SessionIdentityReference.objects.create(session=session, embedding=[0.1] * 8, dims=8)
        BehaviorLog.objects.create(session=session, event_type=BehaviorLog.EventType.NO_FACE, score=0.5)
        Alert.objects.create(session=session, alert_type="test", message="test alert")
        PermissionChange.objects.create(target=creator, permission="exams.create", action="grant")
        EmailVerification.objects.create(
            user=student, code_hash="x", expires_at=session.started_at
        )

    def test_flush_removes_everything_and_recreates_admin(self):
        # Sanity: the fixture actually populated every table under test.
        self.assertGreater(User.objects.count(), 0)
        self.assertGreater(Exam.objects.count(), 0)
        self.assertGreater(ExamSession.objects.count(), 0)

        call_command("seed_db", flush=True, noinput=True)

        for model in (
            ExamSession,
            Response,
            SessionLog,
            SessionIdentityReference,
            BehaviorLog,
            Alert,
            Exam,
            ExamSection,
            QuestionPool,
            ExamAssignment,
            Question,
            ExamCategory,
            Department,
            PermissionChange,
            EmailVerification,
        ):
            self.assertEqual(model.objects.count(), 0, f"{model.__name__} not fully wiped")

        # Every account is gone except the freshly recreated bootstrap admin.
        self.assertEqual(User.objects.count(), 1)
        admin = User.objects.get()
        self.assertEqual(admin.username, "flush_admin")
        self.assertEqual(admin.role, User.Role.ADMIN)
        self.assertTrue(admin.check_password("flush-admin-pass"))

    def test_flush_is_safe_to_run_on_an_empty_database(self):
        call_command("seed_db", flush=True, noinput=True)
        call_command("seed_db", flush=True, noinput=True)
        self.assertEqual(User.objects.count(), 1)
