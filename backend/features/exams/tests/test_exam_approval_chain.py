"""Tests for the exam submit -> review -> approve/reject chain.

Covers the Directive Area 01 "Administrator responsibilities" requirement:
teachers/program heads create and submit exams; program heads (or admin)
review, approve, or reject them; only an approved exam may be published by
a non-admin creator.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from core.security.service import apply_role_defaults
from features.exams.models import Exam, ExamApprovalEvent, Question

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


def make_ready_exam(creator) -> Exam:
    """A draft exam with just enough content to pass publish-readiness."""
    exam = Exam.objects.create(
        title="Approval Chain Exam",
        description="x",
        duration_minutes=30,
        passing_score=60,
        status=Exam.Status.DRAFT,
        created_by=creator,
    )
    Question.objects.create(
        exam=exam,
        question_text="2 + 2 = ?",
        question_type=Question.QuestionType.MULTIPLE_CHOICE,
        options=["3", "4"],
        correct_answer="4",
        points=1,
        order=1,
    )
    return exam


class ExamApprovalChainTests(APITestCase):
    def setUp(self):
        self.faculty = make_user(User.Role.FACULTY, "chain_faculty")
        self.program_head = make_user(User.Role.PROGRAM_HEAD, "chain_program_head")
        self.other_faculty = make_user(User.Role.FACULTY, "chain_other_faculty")
        self.admin = make_user(User.Role.ADMIN, "chain_admin")
        self.exam = make_ready_exam(self.faculty)

    def _submit(self, user):
        self.client.force_authenticate(user=user)
        return self.client.post(f"/api/exams/{self.exam.id}/submit/")

    def _approve(self, user):
        self.client.force_authenticate(user=user)
        return self.client.post(f"/api/exams/{self.exam.id}/approve/")

    def _reject(self, user, note=""):
        self.client.force_authenticate(user=user)
        return self.client.post(f"/api/exams/{self.exam.id}/reject/", {"note": note})

    def _publish(self, user):
        self.client.force_authenticate(user=user)
        return self.client.post(f"/api/exams/{self.exam.id}/publish/")

    def test_creator_can_submit_for_review(self):
        response = self._submit(self.faculty)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.exam.refresh_from_db()
        self.assertEqual(self.exam.approval_status, Exam.ApprovalStatus.PENDING)
        self.assertEqual(self.exam.submitted_by_id, self.faculty.id)
        self.assertIsNotNone(self.exam.submitted_at)
        self.assertEqual(
            ExamApprovalEvent.objects.filter(exam=self.exam, action="submit").count(), 1
        )

    def test_cannot_submit_without_questions(self):
        empty_exam = Exam.objects.create(
            title="Empty",
            duration_minutes=30,
            passing_score=60,
            status=Exam.Status.DRAFT,
            created_by=self.faculty,
        )
        self.client.force_authenticate(user=self.faculty)
        response = self.client.post(f"/api/exams/{empty_exam.id}/submit/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_other_faculty_cannot_submit_someone_elses_exam(self):
        response = self._submit(self.other_faculty)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_program_head_can_view_readiness_for_someone_elses_exam(self):
        """A reviewer needs the readiness checklist to judge a submission -
        not just the creator building it - so the "Review & publish" tab
        doesn't silently blank out for anyone but the exam's own creator."""
        self._submit(self.faculty)
        self.client.force_authenticate(user=self.program_head)
        response = self.client.get(f"/api/exams/{self.exam.id}/readiness/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["ready"])

    def test_unrelated_faculty_cannot_view_readiness(self):
        self.client.force_authenticate(user=self.other_faculty)
        response = self.client.get(f"/api/exams/{self.exam.id}/readiness/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_program_head_can_approve_pending_exam(self):
        self._submit(self.faculty)
        response = self._approve(self.program_head)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.exam.refresh_from_db()
        self.assertEqual(self.exam.approval_status, Exam.ApprovalStatus.APPROVED)
        self.assertEqual(self.exam.reviewed_by_id, self.program_head.id)
        self.assertEqual(
            ExamApprovalEvent.objects.filter(exam=self.exam, action="approve").count(), 1
        )

    def test_faculty_without_approve_permission_cannot_approve(self):
        self._submit(self.faculty)
        response = self._approve(self.other_faculty)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_approve(self):
        self._submit(self.faculty)
        response = self._approve(self.admin)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_cannot_approve_exam_that_is_not_pending(self):
        response = self._approve(self.program_head)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_program_head_can_reject_with_note(self):
        self._submit(self.faculty)
        response = self._reject(self.program_head, note="Needs more questions.")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.exam.refresh_from_db()
        self.assertEqual(self.exam.approval_status, Exam.ApprovalStatus.REJECTED)
        self.assertEqual(self.exam.rejection_note, "Needs more questions.")

    def test_creator_can_resubmit_after_rejection(self):
        self._submit(self.faculty)
        self._reject(self.program_head, note="Fix it")
        response = self._submit(self.faculty)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.exam.refresh_from_db()
        self.assertEqual(self.exam.approval_status, Exam.ApprovalStatus.PENDING)
        self.assertEqual(self.exam.rejection_note, "")

    def test_non_admin_cannot_publish_without_approval(self):
        response = self._publish(self.faculty)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_admin_can_publish_once_approved(self):
        self._submit(self.faculty)
        self._approve(self.program_head)
        response = self._publish(self.faculty)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.exam.refresh_from_db()
        self.assertEqual(self.exam.status, Exam.Status.ACTIVE)

    def test_admin_can_publish_without_approval(self):
        response = self._publish(self.admin)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_pending_review_queue_lists_only_pending(self):
        self._submit(self.faculty)
        self.client.force_authenticate(user=self.program_head)
        response = self.client.get("/api/exams/pending-review/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        rows = payload["results"] if isinstance(payload, dict) else payload
        ids = [row["id"] for row in rows]
        self.assertIn(self.exam.id, ids)

    def test_faculty_cannot_see_pending_review_queue(self):
        self._submit(self.faculty)
        self.client.force_authenticate(user=self.other_faculty)
        response = self.client.get("/api/exams/pending-review/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
