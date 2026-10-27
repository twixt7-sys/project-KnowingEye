"""Bug report 1: newly created and published exams must reach the examinee's list.

Drives the real admin flow over the API (create -> add a question -> publish)
and then asks ``GET /api/exams/mine/`` as an examinee, so a regression in any
step between the builder and the examinee list shows up here. The hidden cases
pin down that only exams meeting every availability condition are listed.
"""

from __future__ import annotations

from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.security.service import apply_role_defaults
from features.exams.models import Department, Exam, ExamAssignment
from features.session.models import ExamSession

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


class AdminPublishedExamReachesExamineeTests(APITestCase):
    def setUp(self):
        self.admin = make_user(User.Role.ADMIN, "vis_admin")
        self.student = make_user(User.Role.STUDENT, "vis_student")
        self.other_student = make_user(User.Role.STUDENT, "vis_other")
        self.department = Department.objects.create(name="Visibility Dept", abbreviation="VIS")

    # -- helpers -------------------------------------------------------------

    def _create(self, *, opens_in=timedelta(minutes=-1), closes_in=timedelta(days=1), **extra):
        now = timezone.now()
        payload = {
            "title": "Fresh exam",
            "description": "",
            "duration_minutes": 30,
            "passing_score": 50,
            "department_id": self.department.id,
            "available_from": (now + opens_in).isoformat(),
            "available_until": (now + closes_in).isoformat(),
            **extra,
        }
        self.client.force_authenticate(user=self.admin)
        res = self.client.post("/api/exams/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        exam_id = res.data["id"]
        res = self.client.post(
            f"/api/exams/{exam_id}/questions/",
            {
                "question_text": "2 + 2?",
                "question_type": "multiple_choice",
                "options": ["3", "4"],
                "correct_answer": "4",
                "points": 1,
                "order": 1,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return exam_id

    def _publish(self, exam_id):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(f"/api/exams/{exam_id}/publish/")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)

    def _create_and_publish(self, **kwargs):
        exam_id = self._create(**kwargs)
        self._publish(exam_id)
        return exam_id

    def _mine(self, user=None):
        self.client.force_authenticate(user=user or self.student)
        res = self.client.get("/api/exams/mine/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        return {row["id"]: row for row in res.data}

    def _complete(self, exam_id, user):
        ExamSession.objects.create(
            exam_id=exam_id, user=user, status=ExamSession.Status.COMPLETED,
            exam_started_at=timezone.now(), submitted_at=timezone.now(),
            percentage_score=90, passed=True,
        )

    # -- visible -------------------------------------------------------------

    def test_open_published_exam_is_listed_and_takeable(self):
        exam_id = self._create_and_publish()
        mine = self._mine()
        self.assertIn(exam_id, mine)
        self.assertTrue(mine[exam_id]["is_open"])
        self.assertEqual(mine[exam_id]["attempts_remaining"], 1)
        self.assertEqual(mine[exam_id]["schedule_state"], "active")

    def test_newest_exam_is_listed_alongside_older_ones(self):
        older = self._create_and_publish()
        newer = self._create_and_publish()
        mine = self._mine()
        self.assertIn(older, mine)
        self.assertIn(newer, mine)

    def test_exam_scheduled_ahead_appears_once_its_window_opens(self):
        # The builder only accepts an opening date in the future, so this is
        # the normal path: published while upcoming, listed once it opens -
        # with no further action by the administrator.
        exam_id = self._create_and_publish(opens_in=timedelta(minutes=5))
        self.assertNotIn(exam_id, self._mine())

        later = timezone.now() + timedelta(minutes=6)
        with mock.patch("django.utils.timezone.now", return_value=later):
            mine = self._mine()
        self.assertIn(exam_id, mine)
        self.assertTrue(mine[exam_id]["is_open"])

    def test_assigned_examinee_sees_roster_exam(self):
        exam_id = self._create_and_publish(requires_assignment=True)
        ExamAssignment.objects.create(exam_id=exam_id, user=self.student)
        self.assertIn(exam_id, self._mine())

    def test_exam_created_by_faculty_and_approved_is_listed(self):
        faculty = make_user(User.Role.FACULTY, "vis_faculty")
        exam = Exam.objects.create(
            title="Faculty exam", duration_minutes=30, passing_score=50,
            status=Exam.Status.ACTIVE, approval_status=Exam.ApprovalStatus.APPROVED,
            created_by=faculty,
            available_from=timezone.now() - timedelta(minutes=1),
            available_until=timezone.now() + timedelta(days=1),
        )
        self.assertIn(exam.id, self._mine())

    def test_examinee_can_open_the_listed_exam(self):
        exam_id = self._create_and_publish()
        self.client.force_authenticate(user=self.student)
        res = self.client.get(f"/api/exams/{exam_id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertNotIn("correct_answer", res.data["questions"][0])

    # -- hidden --------------------------------------------------------------

    def test_draft_is_hidden(self):
        exam_id = self._create()
        self.assertNotIn(exam_id, self._mine())

    def test_upcoming_exam_is_hidden(self):
        exam_id = self._create_and_publish(opens_in=timedelta(hours=2))
        self.assertNotIn(exam_id, self._mine())

    def test_expired_exam_is_hidden(self):
        exam_id = self._create_and_publish(closes_in=timedelta(hours=1))
        later = timezone.now() + timedelta(hours=2)
        with mock.patch("django.utils.timezone.now", return_value=later):
            self.assertNotIn(exam_id, self._mine())

    def test_unpublished_exam_stays_hidden_after_its_window_opens(self):
        # Unpublishing is only allowed before the start time (an ongoing exam
        # is locked), so unpublish while upcoming and check past the opening.
        exam_id = self._create_and_publish(opens_in=timedelta(minutes=5))
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(f"/api/exams/{exam_id}/unpublish/")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        later = timezone.now() + timedelta(minutes=6)
        with mock.patch("django.utils.timezone.now", return_value=later):
            self.assertNotIn(exam_id, self._mine())

    def test_archived_exam_is_hidden(self):
        exam_id = self._create_and_publish()
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(f"/api/exams/{exam_id}/archive/")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertNotIn(exam_id, self._mine())

    def test_roster_exam_is_hidden_from_unassigned_examinee(self):
        exam_id = self._create_and_publish(requires_assignment=True)
        ExamAssignment.objects.create(exam_id=exam_id, user=self.student)
        self.assertNotIn(exam_id, self._mine(self.other_student))

    def test_roster_exam_is_hidden_when_assignment_is_blocked(self):
        exam_id = self._create_and_publish(requires_assignment=True)
        ExamAssignment.objects.create(
            exam_id=exam_id, user=self.student, status=ExamAssignment.Status.BLOCKED
        )
        self.assertNotIn(exam_id, self._mine())

    def test_hidden_exam_cannot_be_fetched_directly(self):
        exam_id = self._create_and_publish(opens_in=timedelta(hours=2))
        self.client.force_authenticate(user=self.student)
        res = self.client.get(f"/api/exams/{exam_id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # -- listed but not startable (the client drops these) -------------------

    def test_used_up_attempts_report_zero_remaining(self):
        exam_id = self._create_and_publish()
        self._complete(exam_id, self.student)
        self.assertEqual(self._mine()[exam_id]["attempts_remaining"], 0)
        self.assertEqual(self._mine(self.other_student)[exam_id]["attempts_remaining"], 1)

    def test_excluded_completed_examinee_reports_zero_remaining(self):
        exam_id = self._create_and_publish(max_attempts=3, exclude_completed_examinees=True)
        self._complete(exam_id, self.student)
        self.assertEqual(self._mine()[exam_id]["attempts_remaining"], 0)
        self.assertEqual(self._mine(self.other_student)[exam_id]["attempts_remaining"], 3)
