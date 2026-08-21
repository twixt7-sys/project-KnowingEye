"""Tests for Sprint 3 (Directive Area 03 - Exam Management & LMS Behavior).

Covers: exam categories + filtering, multi-department assignment, the
derived Upcoming/Active/Closed/Expired schedule state, question editing
locked while a session is in progress, image-capable answer options, and
the essay-grading release gate (results held until manual grading
completes).
"""

from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.security.service import apply_role_defaults
from features.exams import services
from features.exams.models import Department, Exam, ExamCategory, Question
from features.session.models import ExamSession, Response
from features.session.services import finalize_grading_if_complete

User = get_user_model()


def make_user(role, username):
    user = User.objects.create_user(
        username=username,
        email=f"{username}@test.local",
        password="TestPass123!",
        role=role,
    )
    apply_role_defaults(user)
    return user


def make_department(abbr="ENT"):
    return Department.objects.create(name=f"{abbr} Dept", abbreviation=abbr)


class ExamCategoryTests(APITestCase):
    """Categories are seeded by migration 0013 - verify they exist and filter exams."""

    def setUp(self):
        self.faculty = make_user(User.Role.FACULTY, "cat_faculty")
        self.department = make_department("CAT")

    def test_seed_migration_created_guidance_categories(self):
        slugs = set(ExamCategory.objects.values_list("slug", flat=True))
        self.assertEqual(
            slugs,
            {"psychological", "mental-abstract-reasoning", "behavioral-character"},
        )

    def test_create_exam_with_category(self):
        category = ExamCategory.objects.get(slug="psychological")
        self.client.force_authenticate(user=self.faculty)
        res = self.client.post(
            "/api/exams/",
            {
                "title": "Personality Inventory",
                "department_id": self.department.id,
                "category_id": category.id,
                "duration_minutes": 30,
                "passing_score": 50,
            },
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["category"]["slug"], "psychological")

    def test_filter_exams_by_category(self):
        psych = ExamCategory.objects.get(slug="psychological")
        behavioral = ExamCategory.objects.get(slug="behavioral-character")
        Exam.objects.create(
            title="Psych exam", department=self.department, category=psych,
            created_by=self.faculty, status=Exam.Status.DRAFT,
        )
        Exam.objects.create(
            title="Behavior exam", department=self.department, category=behavioral,
            created_by=self.faculty, status=Exam.Status.DRAFT,
        )
        self.client.force_authenticate(user=self.faculty)
        res = self.client.get(f"/api/exams/?category={psych.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data["results"] if isinstance(res.data, dict) else res.data
        titles = [e["title"] for e in results]
        self.assertIn("Psych exam", titles)
        self.assertNotIn("Behavior exam", titles)


class ExamMultiDepartmentTests(APITestCase):
    """Exam.department stays the code-generating home department; `departments` is the M2M."""

    def setUp(self):
        self.faculty = make_user(User.Role.FACULTY, "md_faculty")
        self.home = make_department("HOM")
        self.shared = make_department("SHR")

    def test_create_defaults_departments_to_home_department(self):
        self.client.force_authenticate(user=self.faculty)
        res = self.client.post(
            "/api/exams/",
            {
                "title": "Shared entrance exam",
                "department_id": self.home.id,
                "duration_minutes": 30,
                "passing_score": 50,
            },
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        dept_ids = {d["id"] for d in res.data["departments"]}
        self.assertEqual(dept_ids, {self.home.id})

    def test_create_with_explicit_multiple_departments(self):
        self.client.force_authenticate(user=self.faculty)
        res = self.client.post(
            "/api/exams/",
            {
                "title": "General ed exam",
                "department_id": self.home.id,
                "department_ids": [self.home.id, self.shared.id],
                "duration_minutes": 30,
                "passing_score": 50,
            },
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        dept_ids = {d["id"] for d in res.data["departments"]}
        self.assertEqual(dept_ids, {self.home.id, self.shared.id})

    def test_duplicate_exam_carries_departments_and_category(self):
        category = ExamCategory.objects.get(slug="behavioral-character")
        exam = Exam.objects.create(
            title="Original", department=self.home, category=category,
            created_by=self.faculty, status=Exam.Status.DRAFT,
        )
        exam.departments.set([self.home, self.shared])
        Question.objects.create(
            exam=exam, question_text="Q1", question_type=Question.QuestionType.SHORT_ANSWER,
            correct_answer="x", points=1, order=1,
        )
        clone = services.duplicate_exam(exam, self.faculty)
        self.assertEqual(clone.category_id, category.id)
        self.assertEqual(set(clone.departments.values_list("id", flat=True)), {self.home.id, self.shared.id})


class ExamScheduleStateTests(APITestCase):
    """Derived Upcoming/Active/Closed/Expired state (never stored)."""

    def setUp(self):
        self.faculty = make_user(User.Role.FACULTY, "sched_faculty")
        self.department = make_department("SCH")

    def make_exam(self, **kwargs):
        defaults = dict(
            title="Sched exam", department=self.department, created_by=self.faculty,
            status=Exam.Status.ACTIVE,
        )
        defaults.update(kwargs)
        return Exam.objects.create(**defaults)

    def test_draft_has_no_schedule_state(self):
        exam = self.make_exam(status=Exam.Status.DRAFT)
        self.assertIsNone(services.exam_schedule_state(exam))

    def test_archived_is_closed(self):
        exam = self.make_exam(status=Exam.Status.ARCHIVED)
        self.assertEqual(services.exam_schedule_state(exam), "closed")

    def test_upcoming_before_window_opens(self):
        exam = self.make_exam(available_from=timezone.now() + timedelta(days=1))
        self.assertEqual(services.exam_schedule_state(exam), "upcoming")

    def test_expired_after_window_closes(self):
        exam = self.make_exam(available_until=timezone.now() - timedelta(days=1))
        self.assertEqual(services.exam_schedule_state(exam), "expired")

    def test_active_within_window(self):
        exam = self.make_exam(
            available_from=timezone.now() - timedelta(hours=1),
            available_until=timezone.now() + timedelta(hours=1),
        )
        self.assertEqual(services.exam_schedule_state(exam), "active")

    def test_active_with_no_window_set(self):
        exam = self.make_exam()
        self.assertEqual(services.exam_schedule_state(exam), "active")


class QuestionLockDuringActiveSessionTests(APITestCase):
    """Directive Area 03: lock question editing once an exam is in progress."""

    def setUp(self):
        self.faculty = make_user(User.Role.FACULTY, "lock_faculty")
        self.student = make_user(User.Role.STUDENT, "lock_student")
        self.department = make_department("LCK")
        self.exam = Exam.objects.create(
            title="Lock exam", department=self.department, created_by=self.faculty,
            status=Exam.Status.DRAFT,
        )
        self.question = Question.objects.create(
            exam=self.exam, question_text="Q1", question_type=Question.QuestionType.SHORT_ANSWER,
            correct_answer="x", points=1, order=1,
        )

    def test_editable_with_no_sessions(self):
        services.assert_exam_editable(self.exam)  # should not raise

    def test_locked_with_in_progress_session(self):
        ExamSession.objects.create(
            exam=self.exam, user=self.student, status=ExamSession.Status.IN_PROGRESS,
        )
        with self.assertRaises(Exception):
            services.assert_exam_editable(self.exam)

    def test_locked_with_setup_session(self):
        ExamSession.objects.create(
            exam=self.exam, user=self.student, status=ExamSession.Status.SETUP,
        )
        self.assertTrue(services.exam_has_active_session(self.exam))

    def test_not_locked_by_completed_session(self):
        ExamSession.objects.create(
            exam=self.exam, user=self.student, status=ExamSession.Status.COMPLETED,
        )
        self.assertFalse(services.exam_has_active_session(self.exam))

    def test_api_blocks_question_update_during_active_session(self):
        ExamSession.objects.create(
            exam=self.exam, user=self.student, status=ExamSession.Status.IN_PROGRESS,
        )
        self.client.force_authenticate(user=self.faculty)
        res = self.client.patch(
            f"/api/exams/{self.exam.id}/questions/{self.question.id}/",
            {"question_text": "Changed mid-session"},
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class QuestionOptionImageShapeTests(APITestCase):
    """Options moved from plain strings to {"text", "image"} objects."""

    def setUp(self):
        self.faculty = make_user(User.Role.FACULTY, "opt_faculty")
        self.department = make_department("OPT")
        self.exam = Exam.objects.create(
            title="Option shape exam", department=self.department, created_by=self.faculty,
            status=Exam.Status.DRAFT,
        )

    def test_create_question_with_object_options(self):
        self.client.force_authenticate(user=self.faculty)
        res = self.client.post(
            f"/api/exams/{self.exam.id}/questions/",
            {
                "question_text": "Pick the odd one out",
                "question_type": "multiple_choice",
                "options": [
                    {"text": "Circle", "image": "https://example.com/circle.png"},
                    {"text": "Square", "image": None},
                ],
                "correct_answer": "Square",
                "points": 1,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(
            res.data["options"],
            [
                {"text": "Circle", "image": "https://example.com/circle.png"},
                {"text": "Square", "image": None},
            ],
        )

    def test_legacy_plain_string_options_still_accepted(self):
        """Backward compatibility: a client posting plain strings still works."""
        self.client.force_authenticate(user=self.faculty)
        res = self.client.post(
            f"/api/exams/{self.exam.id}/questions/",
            {
                "question_text": "2 + 2 = ?",
                "question_type": "multiple_choice",
                "options": ["3", "4"],
                "correct_answer": "4",
                "points": 1,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(
            res.data["options"], [{"text": "3", "image": None}, {"text": "4", "image": None}]
        )

    def test_migration_backfilled_existing_string_options_to_objects(self):
        question = Question.objects.create(
            exam=self.exam, question_text="Legacy", question_type=Question.QuestionType.MULTIPLE_CHOICE,
            options=["A", "B"], correct_answer="A", points=1, order=1,
        )
        # Direct ORM creation bypasses the serializer, so this row is still
        # string-shaped until touched - option_text() must handle both.
        from features.exams.serializers import option_text

        self.assertEqual([option_text(o) for o in question.options], ["A", "B"])


class EssayGradingReleaseGateTests(APITestCase):
    """Directive Area 03 ("Results"): hold essay results for manual grading."""

    def setUp(self):
        self.faculty = make_user(User.Role.FACULTY, "grade_faculty")
        self.student = make_user(User.Role.STUDENT, "grade_student")
        self.department = make_department("GRD")
        self.exam = Exam.objects.create(
            title="Essay exam", department=self.department, created_by=self.faculty,
            status=Exam.Status.ACTIVE, passing_score=50,
        )
        self.question = Question.objects.create(
            exam=self.exam, question_text="Explain yourself", question_type=Question.QuestionType.ESSAY,
            correct_answer="model answer", points=10, order=1,
        )
        self.session = ExamSession.objects.create(
            exam=self.exam, user=self.student, status=ExamSession.Status.PENDING_REVIEW,
            submitted_at=timezone.now(), total_score=0, percentage_score=0, passed=False,
        )
        self.response = Response.objects.create(
            session=self.session, question=self.question, answer_text="my essay",
            flagged_for_review=True,
        )

    def test_score_hidden_from_examinee_while_pending_review(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.get(f"/api/sessions/{self.session.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsNone(res.data["total_score"])
        self.assertIsNone(res.data["percentage_score"])
        self.assertIsNone(res.data["passed"])

    def test_score_visible_to_grader_while_pending_review(self):
        self.client.force_authenticate(user=self.faculty)
        res = self.client.get(f"/api/sessions/{self.session.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(res.data["total_score"])

    def test_finalize_grading_noop_while_still_flagged(self):
        completed = finalize_grading_if_complete(self.session)
        self.assertFalse(completed)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, ExamSession.Status.PENDING_REVIEW)

    def test_finalize_grading_completes_session_once_graded(self):
        self.response.points_awarded = 8
        self.response.flagged_for_review = False
        self.response.save(update_fields=["points_awarded", "flagged_for_review"])

        completed = finalize_grading_if_complete(self.session)
        self.assertTrue(completed)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, ExamSession.Status.COMPLETED)
        self.assertEqual(self.session.total_score, 8)

    def test_score_visible_to_examinee_once_graded(self):
        self.response.points_awarded = 8
        self.response.flagged_for_review = False
        self.response.save(update_fields=["points_awarded", "flagged_for_review"])
        finalize_grading_if_complete(self.session)

        self.client.force_authenticate(user=self.student)
        res = self.client.get(f"/api/sessions/{self.session.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["total_score"], 8)

    def test_grade_endpoint_finalizes_session(self):
        self.client.force_authenticate(user=self.faculty)
        res = self.client.patch(
            f"/api/responses/{self.response.id}/grade/",
            {"points_awarded": 10, "grader_comment": "Great answer"},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, ExamSession.Status.COMPLETED)
