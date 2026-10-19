"""What the live-monitoring sockets send, and when.

The examinee streams a frame about once a second. Anything that isn't the
examinee's own reply is only worth producing while a proctor is watching, and
what a proctor is sent should be no bigger than the view they opened needs.
"""

from __future__ import annotations

import copy
import json
from unittest import mock

import cv2
import numpy as np
from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TransactionTestCase

from core.config.asgi import application
from features.behavior import services as behavior_services
from features.exams.models import Exam
from features.monitoring import payloads
from features.monitoring.consumers import MonitoringConsumer
from features.session.models import ExamSession

User = get_user_model()

_FRAME = np.full((48, 64, 3), 120, dtype=np.uint8)
_ANALYSIS = {
    "session_id": "s",
    "timestamp": "2026-01-01T00:00:00+00:00",
    "frame_index": 1,
    "metrics": {"exam_behavior_index_pct": 40.0, "face_presence_pct": 12.0},
    "exam_behavior_index_pct": 40.0,
    "overall_compliance_pct": 40.0,
    "events": [{"event_type": "no_face", "score_pct": 90, "confidence_pct": 90}],
    "alerts": [{"type": "no_face", "severity": "high", "message": "No face in frame"}],
    "pipeline_mode": "production",
}


def _fake_decode_and_analyze(image_data, session_id):
    return _FRAME, copy.deepcopy(_ANALYSIS)


def _jpeg_bytes() -> bytes:
    ok, buf = cv2.imencode(".jpg", np.full((48, 64, 3), 120, dtype=np.uint8))
    assert ok
    return buf.tobytes()


def _token(user) -> str:
    from rest_framework_simplejwt.tokens import RefreshToken

    return str(RefreshToken.for_user(user).access_token)


class PayloadTrimTests(SimpleTestCase):
    def test_client_analysis_drops_server_only_fields_and_keeps_the_rest(self):
        trimmed = payloads.client_analysis(_ANALYSIS)
        for field in ("events", "session_id", "timestamp", "pipeline_mode"):
            self.assertNotIn(field, trimmed)
        self.assertEqual(trimmed["metrics"], _ANALYSIS["metrics"])
        self.assertEqual(trimmed["alerts"], _ANALYSIS["alerts"])
        # The original (which persistence reads) is untouched.
        self.assertIn("events", _ANALYSIS)

    def test_summary_falls_back_through_the_ebi_fields(self):
        self.assertEqual(
            payloads.analysis_summary(_ANALYSIS),
            {"exam_behavior_index_pct": 40.0, "face_presence_pct": 12.0},
        )
        self.assertEqual(
            payloads.analysis_summary({"metrics": {"exam_behavior_index_pct": 55.0}}),
            {"exam_behavior_index_pct": 55.0, "face_presence_pct": None},
        )
        self.assertEqual(
            payloads.analysis_summary({"overall_compliance_pct": 70.0})["exam_behavior_index_pct"],
            70.0,
        )

    def test_live_alerts_repeat_at_the_pace_they_are_recorded(self):
        self.assertEqual(payloads.ALERT_REBROADCAST_S, behavior_services._EVENT_COOLDOWN_SECONDS)


class FanoutTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="fan_admin",
            email="fan_admin@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.student = User.objects.create_user(
            username="fan_student",
            email="fan_student@test.local",
            password="TestPass123!",
            role=User.Role.STUDENT,
        )
        exam = Exam.objects.create(
            title="Fanout Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
        )
        self.session = ExamSession.objects.create(exam=exam, user=self.student)
        self.student_token = _token(self.student)
        self.admin_token = _token(self.admin)

    def _socket(self, path: str, token: str) -> WebsocketCommunicator:
        return WebsocketCommunicator(
            application,
            f"{path}{'&' if '?' in path else '?'}token={token}",
            headers=[(b"origin", b"http://127.0.0.1")],
        )

    def _examinee(self):
        return self._socket(f"/ws/monitoring/{self.session.id}/", self.student_token)

    def _observer(self, detail: bool = False):
        path = f"/ws/monitoring/observe/{self.session.id}/"
        return self._socket(path + ("?detail=1" if detail else ""), self.admin_token)

    def _admin_feed(self):
        return self._socket("/ws/monitoring/alerts/", self.admin_token)

    async def _open(self, communicator):
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        await communicator.receive_from()  # welcome

    async def _send_frame(self, examinee):
        await examinee.send_to(text_data=json.dumps({"type": "frame", "image": "x"}))
        while True:
            msg = json.loads(await examinee.receive_from(timeout=10))
            if msg["type"] == "analysis":
                return msg

    async def _drain(self, communicator, timeout: float = 0.5) -> list[dict]:
        out = []
        while not await communicator.receive_nothing(timeout=timeout):
            out.append(json.loads(await communicator.receive_from(timeout=1)))
        return out

    def _patched(self):
        return mock.patch(
            "features.monitoring.consumers._decode_and_analyze",
            side_effect=_fake_decode_and_analyze,
        )

    def test_no_snapshot_is_encoded_while_nobody_is_watching(self):
        async def run():
            examinee = self._examinee()
            try:
                await self._open(examinee)
                with self._patched(), mock.patch.object(
                    MonitoringConsumer, "_encode_snapshot", return_value="data:image/jpeg;base64,AA=="
                ) as encode:
                    await self._send_frame(examinee)
                    await examinee.disconnect()  # waits for the frame's post-work
                    encode.assert_not_called()
            finally:
                await examinee.disconnect()

        async_to_sync(run)()

    def test_snapshots_start_when_an_observer_connects(self):
        async def run():
            examinee, observer = self._examinee(), self._observer()
            try:
                await self._open(examinee)
                await self._open(observer)
                with self._patched(), mock.patch.object(
                    MonitoringConsumer, "_encode_snapshot", return_value="data:image/jpeg;base64,AA=="
                ) as encode:
                    await self._send_frame(examinee)
                    msgs = await self._drain(observer)
                    encode.assert_called_once()
                self.assertIn("snapshot", [m["type"] for m in msgs])
            finally:
                await examinee.disconnect()
                await observer.disconnect()

        async_to_sync(run)()

    def test_an_examinee_who_joins_after_the_observer_is_seen_at_once(self):
        async def run():
            observer, examinee = self._observer(), self._examinee()
            try:
                await self._open(observer)
                await self._open(examinee)
                with self._patched(), mock.patch.object(
                    MonitoringConsumer, "_encode_snapshot", return_value="data:image/jpeg;base64,AA=="
                ):
                    await self._send_frame(examinee)
                    msgs = await self._drain(observer)
                self.assertIn("snapshot", [m["type"] for m in msgs])
            finally:
                await examinee.disconnect()
                await observer.disconnect()

        async_to_sync(run)()

    def test_a_tile_gets_a_summary_but_only_the_detail_view_gets_analysis(self):
        async def run():
            examinee = self._examinee()
            tile, detail = self._observer(), self._observer(detail=True)
            try:
                await self._open(tile)
                await self._open(detail)
                await self._open(examinee)
                with self._patched(), mock.patch.object(
                    MonitoringConsumer, "_encode_snapshot", return_value="data:image/jpeg;base64,AA=="
                ):
                    await self._send_frame(examinee)
                    tile_msgs = await self._drain(tile)
                    detail_msgs = await self._drain(detail)

                self.assertNotIn("analysis", [m["type"] for m in tile_msgs])
                tile_snapshot = next(m for m in tile_msgs if m["type"] == "snapshot")
                self.assertEqual(
                    tile_snapshot["summary"],
                    {"exam_behavior_index_pct": 40.0, "face_presence_pct": 12.0},
                )
                # The picture is not shipped alongside a second copy of the analysis.
                self.assertNotIn("analysis", tile_snapshot)

                analysis = next(m for m in detail_msgs if m["type"] == "analysis")
                self.assertNotIn("events", analysis["payload"])
                self.assertEqual(analysis["payload"]["metrics"]["face_presence_pct"], 12.0)
            finally:
                await examinee.disconnect()
                await tile.disconnect()
                await detail.disconnect()

        async_to_sync(run)()

    def test_a_persistent_condition_is_reported_once_not_every_frame(self):
        async def run():
            examinee, observer, feed = self._examinee(), self._observer(), self._admin_feed()
            try:
                await self._open(observer)
                await self._open(feed)
                await self._open(examinee)
                with self._patched(), mock.patch.object(
                    MonitoringConsumer, "_encode_snapshot", return_value=None
                ):
                    for _ in range(3):
                        reply = await self._send_frame(examinee)
                        # The examinee's own reply still carries the alert every frame.
                        self.assertEqual(len(reply["payload"]["alerts"]), 1)
                    observer_msgs = await self._drain(observer)
                    feed_msgs = await self._drain(feed)
                self.assertEqual([m["type"] for m in observer_msgs].count("alert"), 1)
                self.assertEqual([m["type"] for m in feed_msgs].count("alert"), 1)
            finally:
                await examinee.disconnect()
                await observer.disconnect()
                await feed.disconnect()

        async_to_sync(run)()

    def test_alerts_reach_the_admin_feed_even_with_no_observer(self):
        async def run():
            examinee, feed = self._examinee(), self._admin_feed()
            try:
                await self._open(feed)
                await self._open(examinee)
                with self._patched():
                    await self._send_frame(examinee)
                    msgs = await self._drain(feed)
                self.assertEqual([m["type"] for m in msgs], ["alert"])
            finally:
                await examinee.disconnect()
                await feed.disconnect()

        async_to_sync(run)()

    def test_a_binary_jpeg_frame_is_analyzed_like_a_text_frame(self):
        async def run():
            examinee = self._examinee()
            try:
                await self._open(examinee)
                await examinee.send_to(bytes_data=_jpeg_bytes())
                reply = json.loads(await examinee.receive_from(timeout=30))
                self.assertEqual(reply["type"], "analysis")
                self.assertIn("metrics", reply["payload"])
            finally:
                await examinee.disconnect()

        async_to_sync(run)()
