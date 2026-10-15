"""Proctor termination: the examinee has to be told, on every channel they can hear.

Termination used to flip the row and say nothing - the examinee's screen kept
the exam open and editable until a later request happened to fail with a
generic error. These tests pin the contract the examinee's browser relies on:
a push to the session's channel group, and a machine-readable ``code`` on every
request the server refuses because of the session's state.
"""

import asyncio
import base64
from datetime import timedelta
from unittest import mock

import cv2
import numpy as np
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from features.exams.models import Exam, Question
from features.session.models import ExamSession, SessionLog

User = get_user_model()


def _frame_b64() -> str:
    ok, buf = cv2.imencode(".jpg", np.full((48, 64, 3), 120, dtype=np.uint8))
    assert ok
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")


class SessionTerminateTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="term_admin",
            email="term_admin@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.student = User.objects.create_user(
            username="term_student",
            email="term_student@test.local",
            password="TestPass123!",
            role=User.Role.STUDENT,
        )
        self.exam = Exam.objects.create(
            title="Terminate Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
        )
        self.question = Question.objects.create(
            exam=self.exam,
            question_text="Yes or no?",
            question_type=Question.QuestionType.TRUE_FALSE,
            options=["True", "False"],
            correct_answer="True",
            points=1,
            order=1,
        )
        started = timezone.now() - timedelta(minutes=4)
        self.session = ExamSession.objects.create(
            exam=self.exam,
            user=self.student,
            status=ExamSession.Status.IN_PROGRESS,
            exam_started_at=started,
            time_remaining=600,
            question_order=[self.question.id],
        )
        self.session.deadline_at = started + timedelta(seconds=self.session.duration_seconds)
        self.session.save(update_fields=["deadline_at"])

    def _terminate(self, user=None):
        self.client.force_authenticate(user or self.admin)
        return self.client.post(f"/api/sessions/{self.session.id}/terminate/")

    def _as_student(self):
        self.client.force_authenticate(self.student)

    def _submit_body(self):
        return {
            "responses": [{"question_id": self.question.id, "answer_text": "True"}],
            "time_remaining": 100,
        }

    def _autosave_body(self):
        return {"responses": [{"question_id": self.question.id, "answer_text": "True"}]}

    # --- the terminate action itself --------------------------------------

    def test_terminate_ends_the_attempt_and_records_who_did_it(self):
        response = self._terminate()
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        self.session.refresh_from_db()
        self.assertEqual(self.session.status, ExamSession.Status.TERMINATED)
        self.assertIsNotNone(self.session.submitted_at)
        log = SessionLog.objects.get(
            session=self.session, event_type=SessionLog.EventType.TERMINATED
        )
        self.assertEqual(log.details["terminated_by"], self.admin.username)

    def test_terminate_requires_the_permission(self):
        response = self._terminate(self.student)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, ExamSession.Status.IN_PROGRESS)

    def test_a_finished_session_cannot_be_terminated(self):
        self.session.status = ExamSession.Status.COMPLETED
        self.session.save(update_fields=["status"])

        response = self._terminate()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("completed", response.data["error"].lower())
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, ExamSession.Status.COMPLETED)

    def test_terminating_twice_is_rejected_not_repeated(self):
        self.assertEqual(self._terminate().status_code, status.HTTP_200_OK)
        self.assertEqual(self._terminate().status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            SessionLog.objects.filter(
                session=self.session, event_type=SessionLog.EventType.TERMINATED
            ).count(),
            1,
        )

    # --- push --------------------------------------------------------------

    def test_terminate_notifies_the_session_group(self):
        layer = get_channel_layer()
        channel = async_to_sync(layer.new_channel)()
        async_to_sync(layer.group_add)(f"monitoring.session.{self.session.id}", channel)

        self._terminate()

        # Bounded: an unsent message must fail the test, not hang the suite.
        message = async_to_sync(asyncio.wait_for)(layer.receive(channel), timeout=2)
        self.assertEqual(message["type"], "session.state")
        self.assertEqual(message["status"], ExamSession.Status.TERMINATED)
        self.assertEqual(message["session_id"], str(self.session.id))

    def test_a_session_still_in_setup_can_be_terminated_and_is_announced(self):
        # No exam clock has started yet, so there is no start time or deadline.
        self.session.status = ExamSession.Status.SETUP
        self.session.exam_started_at = None
        self.session.deadline_at = None
        self.session.save(update_fields=["status", "exam_started_at", "deadline_at"])
        layer = get_channel_layer()
        channel = async_to_sync(layer.new_channel)()
        async_to_sync(layer.group_add)(f"monitoring.session.{self.session.id}", channel)

        response = self._terminate()

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        message = async_to_sync(asyncio.wait_for)(layer.receive(channel), timeout=2)
        self.assertEqual(message["status"], ExamSession.Status.TERMINATED)

    def test_a_failed_broadcast_does_not_fail_the_termination(self):
        with mock.patch(
            "features.monitoring.broadcast.get_channel_layer", side_effect=RuntimeError("down")
        ):
            response = self._terminate()
        # The channel layer being down must not stop a proctor ending an exam;
        # the examinee still finds out from their next heartbeat or request.
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, ExamSession.Status.TERMINATED)

    # --- pull and rejection ------------------------------------------------

    def test_heartbeat_reports_the_termination(self):
        self._terminate()
        self._as_student()

        heartbeat = self.client.post(f"/api/sessions/{self.session.id}/heartbeat/")
        self.assertEqual(heartbeat.status_code, status.HTTP_200_OK)
        self.assertEqual(heartbeat.data["status"], ExamSession.Status.TERMINATED)
        self.assertIsNone(heartbeat.data["deadline_at"])

    def test_submit_after_termination_says_so_and_carries_a_code(self):
        self._terminate()
        self._as_student()

        response = self.client.post(
            f"/api/sessions/{self.session.id}/submit/", self._submit_body(), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "session_terminated")
        self.assertIn("terminated", response.data["error"].lower())
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, ExamSession.Status.TERMINATED)

    def test_autosave_after_termination_says_so_and_carries_a_code(self):
        self._terminate()
        self._as_student()

        response = self.client.patch(
            f"/api/sessions/{self.session.id}/responses/", self._autosave_body(), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "session_terminated")
        self.assertFalse(self.session.responses.exists())

    def test_paused_rejections_carry_a_code_too(self):
        self.client.force_authenticate(self.admin)
        self.client.post(f"/api/sessions/{self.session.id}/pause/", {}, format="json")
        self._as_student()

        submit = self.client.post(
            f"/api/sessions/{self.session.id}/submit/", self._submit_body(), format="json"
        )
        autosave = self.client.patch(
            f"/api/sessions/{self.session.id}/responses/", self._autosave_body(), format="json"
        )
        for response in (submit, autosave):
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(response.data["code"], "session_paused")

    def test_frames_after_termination_are_refused_with_a_code(self):
        self._terminate()
        self._as_student()

        response = self.client.post(
            "/api/monitoring/frame/",
            {"image": _frame_b64(), "session_id": str(self.session.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "session_terminated")
        self.assertIn("terminated", response.data["error"].lower())
