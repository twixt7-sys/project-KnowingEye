"""A proctor's pause/resume/terminate reaching the sockets that are already open.

The examinee's browser must stop at once when the exam is paused or terminated,
the proctor's views must follow, and the examinee's cached session row must
never be used to time out an attempt whose deadline moved when it was resumed.
"""

from __future__ import annotations

import copy
import json
from datetime import timedelta
from unittest import mock

import numpy as np
from asgiref.sync import async_to_sync, sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.config.asgi import application
from features.behavior.models import Alert, BehaviorLog
from features.exams.models import Exam
from features.session.models import ExamSession
from features.session.services import pause_session, resume_session

User = get_user_model()

_FRAME = np.full((48, 64, 3), 120, dtype=np.uint8)
_ANALYSIS = {
    "metrics": {"exam_behavior_index_pct": 40.0, "face_presence_pct": 0.0},
    "exam_behavior_index_pct": 40.0,
    "events": [{"event_type": "no_face", "score_pct": 90, "confidence_pct": 90}],
    "alerts": [{"type": "no_face", "severity": "high", "message": "No face in frame"}],
}


def _fake_decode_and_analyze(image_data, session_id):
    return _FRAME, copy.deepcopy(_ANALYSIS)


def _token(user) -> str:
    from rest_framework_simplejwt.tokens import RefreshToken

    return str(RefreshToken.for_user(user).access_token)


class SessionStateWebsocketTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="state_admin",
            email="state_admin@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.student = User.objects.create_user(
            username="state_student",
            email="state_student@test.local",
            password="TestPass123!",
            role=User.Role.STUDENT,
        )
        exam = Exam.objects.create(
            title="State Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
        )
        self.t0 = timezone.now()
        self.session = ExamSession.objects.create(
            exam=exam,
            user=self.student,
            status=ExamSession.Status.IN_PROGRESS,
            exam_started_at=self.t0,
            time_remaining=600,
        )
        self.student_token = _token(self.student)
        self.admin_token = _token(self.admin)

    def _socket(self, path: str, token: str) -> WebsocketCommunicator:
        return WebsocketCommunicator(
            application,
            f"{path}?token={token}",
            headers=[(b"origin", b"http://127.0.0.1")],
        )

    def _examinee(self):
        return self._socket(f"/ws/monitoring/{self.session.id}/", self.student_token)

    def _observer(self):
        return self._socket(f"/ws/monitoring/observe/{self.session.id}/", self.admin_token)

    def _admin_feed(self):
        return self._socket("/ws/monitoring/alerts/", self.admin_token)

    async def _connect(self, communicator):
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        await communicator.receive_from()  # welcome

    async def _next(self, communicator, timeout: float = 5):
        return json.loads(await communicator.receive_from(timeout=timeout))

    async def _next_of_type(self, communicator, msg_type: str, timeout: float = 5):
        while True:
            msg = await self._next(communicator, timeout)
            if msg["type"] == msg_type:
                return msg

    def test_every_open_socket_is_told_about_pause_and_resume(self):
        async def run():
            sockets = {
                "examinee": self._examinee(),
                "observer": self._observer(),
                "admin feed": self._admin_feed(),
            }
            try:
                for socket in sockets.values():
                    await self._connect(socket)

                await sync_to_async(pause_session)(
                    self.session, paused_by=self.admin, reason="Stand by"
                )
                for name, socket in sockets.items():
                    msg = await self._next(socket)
                    self.assertEqual(msg["type"], "session_state", name)
                    self.assertEqual(msg["status"], ExamSession.Status.PAUSED, name)
                    self.assertEqual(msg["pause_reason"], "Stand by", name)
                    self.assertEqual(msg["session_id"], str(self.session.id), name)

                await sync_to_async(resume_session)(self.session, resumed_by=self.admin)
                for name, socket in sockets.items():
                    msg = await self._next(socket)
                    self.assertEqual(msg["type"], "session_state", name)
                    self.assertEqual(msg["status"], ExamSession.Status.IN_PROGRESS, name)
            finally:
                for socket in sockets.values():
                    await socket.disconnect()

        async_to_sync(run)()

    def test_no_alerts_or_records_while_paused_but_they_return_on_resume(self):
        async def run():
            examinee = self._examinee()
            try:
                await self._connect(examinee)
                with mock.patch(
                    "features.monitoring.consumers._decode_and_analyze",
                    side_effect=_fake_decode_and_analyze,
                ):
                    await sync_to_async(pause_session)(self.session, paused_by=self.admin)
                    await self._next_of_type(examinee, "session_state")

                    await examinee.send_to(text_data=json.dumps({"type": "frame", "image": "x"}))
                    reply = await self._next_of_type(examinee, "analysis")
                    self.assertEqual(reply["payload"]["alerts"], [])
                    # The live picture still reaches the proctor, with no alert sent.
                    await examinee.receive_nothing(timeout=0.5)

                    await sync_to_async(resume_session)(self.session, resumed_by=self.admin)
                    await self._next_of_type(examinee, "session_state")

                    await examinee.send_to(text_data=json.dumps({"type": "frame", "image": "x"}))
                    reply = await self._next_of_type(examinee, "analysis")
                    self.assertEqual(len(reply["payload"]["alerts"]), 1)
                    await self._next_of_type(examinee, "alert")
            finally:
                await examinee.disconnect()

        async_to_sync(run)()

        # Only the frame sent after the resume was recorded against the examinee.
        self.assertEqual(Alert.objects.filter(session=self.session).count(), 1)
        self.assertEqual(BehaviorLog.objects.filter(session=self.session).count(), 1)
        self.session.refresh_from_db()
        self.assertEqual(self.session.ebi_sample_count, 1)

    def test_resumed_examinee_is_not_timed_out_by_a_stale_cached_session(self):
        """If the push is missed, the socket's periodic check must still see the
        pause: the copy cached at connect time knows nothing of it, and by the
        pre-pause deadline would auto-submit an examinee who has time left."""

        def at(minutes: float):
            return mock.patch(
                "django.utils.timezone.now",
                return_value=self.t0 + timedelta(minutes=minutes),
            )

        async def run():
            examinee = self._examinee()
            try:
                await self._connect(examinee)
                with mock.patch("features.session.services.broadcast_session_state"):
                    with at(9):
                        await sync_to_async(pause_session)(self.session, paused_by=self.admin)
                    with at(14):  # five minutes paused: 1 minute left, deadline at t0 + 15
                        await sync_to_async(resume_session)(self.session, resumed_by=self.admin)

                with (
                    at(14.5),
                    mock.patch(
                        "features.monitoring.consumers._decode_and_analyze",
                        side_effect=_fake_decode_and_analyze,
                    ),
                ):
                    await examinee.send_to(text_data=json.dumps({"type": "frame", "image": "x"}))
                    reply = await self._next(examinee)
                    self.assertEqual(reply["type"], "analysis", reply)
            finally:
                await examinee.disconnect()

        async_to_sync(run)()

        self.session.refresh_from_db()
        self.assertEqual(self.session.status, ExamSession.Status.IN_PROGRESS)
        self.assertEqual(self.session.paused_total_seconds, 5 * 60)

    # --- terminate ---------------------------------------------------------

    def _terminate(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.post(f"/api/sessions/{self.session.id}/terminate/")
        self.assertEqual(response.status_code, 200, response.data)

    def test_terminate_reaches_every_socket_and_ends_the_examinees(self):
        async def run():
            examinee, observer, admin_feed = self._examinee(), self._observer(), self._admin_feed()
            sockets = {"examinee": examinee, "observer": observer, "admin feed": admin_feed}
            try:
                for socket in sockets.values():
                    await self._connect(socket)

                await sync_to_async(self._terminate)()
                for name, socket in sockets.items():
                    msg = await self._next(socket)
                    self.assertEqual(msg["type"], "session_state", name)
                    self.assertEqual(msg["status"], ExamSession.Status.TERMINATED, name)
                    self.assertEqual(msg["session_id"], str(self.session.id), name)

                # Nothing more is coming for the examinee: their socket is closed
                # with a code that says why, so the browser doesn't fall back to
                # streaming frames over REST.
                closing = await examinee.receive_output(timeout=5)
                self.assertEqual(closing["type"], "websocket.close")
                self.assertEqual(closing["code"], 4410)
                # Proctor views stay open to keep showing the session.
                await observer.receive_nothing(timeout=0.3)
                await admin_feed.receive_nothing(timeout=0.3)
            finally:
                for socket in sockets.values():
                    await socket.disconnect()

        async_to_sync(run)()

    def test_a_missed_terminate_push_is_caught_by_the_next_frame(self):
        async def run():
            examinee = self._examinee()
            try:
                await self._connect(examinee)
                with mock.patch("features.session.services.broadcast_session_state"):
                    await sync_to_async(self._terminate)()

                with mock.patch(
                    "features.monitoring.consumers._decode_and_analyze",
                    side_effect=_fake_decode_and_analyze,
                ):
                    await examinee.send_to(text_data=json.dumps({"type": "frame", "image": "x"}))
                    msg = await self._next(examinee)
                    # The real status, not "expired": the screen shown depends on it.
                    self.assertEqual(msg["type"], "session_state", msg)
                    self.assertEqual(msg["status"], ExamSession.Status.TERMINATED)
                    closing = await examinee.receive_output(timeout=5)
                    self.assertEqual(closing["type"], "websocket.close")
                    self.assertEqual(closing["code"], 4410)
            finally:
                await examinee.disconnect()

        async_to_sync(run)()

        # The refused frame was never analysed or recorded against the examinee.
        self.assertFalse(BehaviorLog.objects.filter(session=self.session).exists())

    def test_a_timed_out_examinee_still_gets_the_expired_close(self):
        async def run():
            examinee = self._examinee()
            try:
                await self._connect(examinee)
                with (
                    mock.patch(
                        "django.utils.timezone.now",
                        return_value=self.t0 + timedelta(minutes=11),
                    ),
                    mock.patch(
                        "features.monitoring.consumers._decode_and_analyze",
                        side_effect=_fake_decode_and_analyze,
                    ),
                ):
                    await examinee.send_to(text_data=json.dumps({"type": "frame", "image": "x"}))
                    state = await self._next(examinee)
                    self.assertEqual(state["type"], "session_state", state)
                    self.assertNotEqual(state["status"], ExamSession.Status.IN_PROGRESS)
                    error = await self._next(examinee)
                    self.assertEqual(error, {"type": "error", "message": "session expired"})
                    closing = await examinee.receive_output(timeout=5)
                    self.assertEqual(closing["code"], 4408)
            finally:
                await examinee.disconnect()

        async_to_sync(run)()
