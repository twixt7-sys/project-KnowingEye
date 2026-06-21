"""Tests for the monitoring WebSocket consumer.

These exercise the full ASGI stack: JWT auth → routing → consumer → AI adapter
(stub) → behavior persistence.
"""

from __future__ import annotations

import base64
import json

import cv2
import numpy as np
from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase

from core.config.asgi import application
from features.exams.models import Exam
from features.session.models import ExamSession


User = get_user_model()


def _tiny_jpeg() -> str:
    img = np.full((48, 64, 3), 120, dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")


def _issue_token(user) -> str:
    from rest_framework_simplejwt.tokens import RefreshToken

    return str(RefreshToken.for_user(user).access_token)


class MonitoringWebsocketTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="ws_examinee",
            email="ws_examinee@test.local",
            password="TestPass123!",
            role=User.Role.EXAMINEE,
        )
        self.admin = User.objects.create_user(
            username="ws_admin",
            email="ws_admin@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        exam = Exam.objects.create(
            title="WS Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
        )
        self.session = ExamSession.objects.create(exam=exam, user=self.user)
        self.user_token = _issue_token(self.user)

    def _connect(self, token: str | None) -> WebsocketCommunicator:
        path = f"/ws/monitoring/{self.session.id}/"
        if token:
            path += f"?token={token}"
        # AllowedHostsOriginValidator requires an Origin header
        headers = [(b"origin", b"http://127.0.0.1")]
        return WebsocketCommunicator(application, path, headers=headers)

    def test_unauthenticated_rejected(self):
        async def run():
            communicator = self._connect(token=None)
            connected, _ = await communicator.connect()
            self.assertFalse(connected)
            await communicator.disconnect()

        async_to_sync(run)()

    def test_authenticated_frame_round_trip(self):
        token = self.user_token

        async def run():
            communicator = self._connect(token)
            try:
                connected, _ = await communicator.connect()
                self.assertTrue(connected)

                welcome = json.loads(await communicator.receive_from())
                self.assertEqual(welcome["type"], "connected")

                await communicator.send_to(
                    text_data=json.dumps({"type": "frame", "image": _tiny_jpeg()})
                )
                response = json.loads(await communicator.receive_from(timeout=30))
                self.assertEqual(response["type"], "analysis")
                self.assertIn("metrics", response["payload"])
            finally:
                await communicator.disconnect()

        async_to_sync(run)()

    def test_ping_pong(self):
        token = self.user_token

        async def run():
            communicator = self._connect(token)
            try:
                connected, _ = await communicator.connect()
                self.assertTrue(connected)
                await communicator.receive_from()  # welcome
                await communicator.send_to(text_data=json.dumps({"type": "ping"}))
                response = json.loads(await communicator.receive_from())
                self.assertEqual(response["type"], "pong")
            finally:
                await communicator.disconnect()

        async_to_sync(run)()


class AdminAlertsWebsocketTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="ws_admin2",
            email="ws_admin2@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.examinee = User.objects.create_user(
            username="ws_examinee2",
            email="ws_examinee2@test.local",
            password="TestPass123!",
            role=User.Role.EXAMINEE,
        )
        self.admin_token = _issue_token(self.admin)
        self.examinee_token = _issue_token(self.examinee)

    def _connect(self, token: str | None) -> WebsocketCommunicator:
        path = "/ws/monitoring/alerts/"
        if token:
            path += f"?token={token}"
        headers = [(b"origin", b"http://127.0.0.1")]
        return WebsocketCommunicator(application, path, headers=headers)

    def test_non_admin_rejected(self):
        async def run():
            communicator = self._connect(self.examinee_token)
            connected, _ = await communicator.connect()
            self.assertFalse(connected)
            await communicator.disconnect()

        async_to_sync(run)()

    def test_admin_receives_welcome(self):
        async def run():
            communicator = self._connect(self.admin_token)
            try:
                connected, _ = await communicator.connect()
                self.assertTrue(connected)
                welcome = json.loads(await communicator.receive_from())
                self.assertEqual(welcome["type"], "connected")
                self.assertEqual(welcome["scope"], "admin.alerts")
            finally:
                await communicator.disconnect()

        async_to_sync(run)()
