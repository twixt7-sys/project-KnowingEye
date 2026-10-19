"""Persistent snapshot evidence: capture on warning and termination, staff-only review.

Covers the contract the proctoring evidence rests on:
* the frame that raised an alert is saved, linked to the alert, student, exam
  and session;
* terminating a session keeps at least five of its latest frames, linked to
  the ``terminated`` SessionLog, and keeps them only once;
* the evidence can be listed and fetched by monitoring/reports staff and by
  nobody else - in particular not by the examinee it is about.
"""

from __future__ import annotations

import copy
import json
from unittest import mock

import numpy as np
from asgiref.sync import async_to_sync, sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.config.asgi import application
from features.behavior.models import Alert
from features.behavior.services import persist_analysis
from features.exams.models import Exam
from features.monitoring import evidence
from features.monitoring.models import SessionSnapshot
from features.session.models import ExamSession, SessionLog
from features.session.services import terminate_session

User = get_user_model()

_FRAME = np.full((48, 64, 3), 120, dtype=np.uint8)
_ALERT_ANALYSIS = {
    "metrics": {"exam_behavior_index_pct": 40.0, "face_presence_pct": 0.0},
    "exam_behavior_index_pct": 40.0,
    "events": [{"event_type": "no_face", "score_pct": 90, "confidence_pct": 90}],
    "alerts": [{"type": "no_face", "severity": "high", "message": "No face in frame"}],
}
_QUIET_ANALYSIS = {"events": [], "alerts": []}


def _make_user(role, name):
    return User.objects.create_user(
        username=name, email=f"{name}@test.local", password="TestPass123!", role=role
    )


class _EvidenceFixture:
    def setUp(self):
        super().setUp()
        evidence._rings.clear()
        self.admin = _make_user(User.Role.ADMIN, "snap_admin")
        self.student = _make_user(User.Role.STUDENT, "snap_student")
        self.exam = Exam.objects.create(
            title="Snapshot Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
        )
        self.session = ExamSession.objects.create(
            exam=self.exam,
            user=self.student,
            status=ExamSession.Status.IN_PROGRESS,
            exam_started_at=timezone.now(),
            time_remaining=600,
        )

    def tearDown(self):
        evidence._rings.clear()
        super().tearDown()

    def _stream(self, count, analysis=None):
        for _ in range(count):
            evidence.remember_frame(self.session.id, _FRAME, analysis or _QUIET_ANALYSIS)


class WarningSnapshotTests(_EvidenceFixture, APITestCase):
    def test_alert_keeps_the_frame_that_triggered_it(self):
        persist_analysis(self.session, copy.deepcopy(_ALERT_ANALYSIS), evidence_frame=_FRAME)

        alert = Alert.objects.get(session=self.session)
        snap = SessionSnapshot.objects.get()
        self.assertEqual(snap.kind, SessionSnapshot.Kind.WARNING)
        self.assertEqual(snap.alert_id, alert.id)
        self.assertEqual(snap.session_id, self.session.id)
        self.assertEqual(snap.user_id, self.student.id)
        self.assertEqual(snap.exam_id, self.exam.id)
        self.assertEqual(snap.label, "no_face")
        self.assertIn("no_face", snap.flags)
        self.assertTrue(bytes(snap.image).startswith(b"\xff\xd8"))
        self.assertGreater(snap.width, 0)

    def test_no_frame_means_no_snapshot_but_the_alert_is_still_raised(self):
        persist_analysis(self.session, copy.deepcopy(_ALERT_ANALYSIS))

        self.assertEqual(Alert.objects.filter(session=self.session).count(), 1)
        self.assertEqual(SessionSnapshot.objects.count(), 0)

    def test_a_cooldown_skipped_alert_does_not_add_a_snapshot(self):
        persist_analysis(self.session, copy.deepcopy(_ALERT_ANALYSIS), evidence_frame=_FRAME)
        persist_analysis(self.session, copy.deepcopy(_ALERT_ANALYSIS), evidence_frame=_FRAME)

        self.assertEqual(Alert.objects.filter(session=self.session).count(), 1)
        self.assertEqual(SessionSnapshot.objects.count(), 1)

    def test_warning_snapshots_are_capped_per_session(self):
        alert = Alert.objects.create(
            session=self.session, alert_type="no_face", severity="high", message="x"
        )
        with mock.patch.object(evidence, "MAX_WARNING_SNAPSHOTS_PER_SESSION", 2):
            written = [evidence.save_alert_snapshot(self.session, alert, _FRAME) for _ in range(4)]

        self.assertEqual(written, [True, True, False, False])
        self.assertEqual(SessionSnapshot.objects.count(), 2)

    def test_a_failure_saving_the_snapshot_never_fails_the_alert(self):
        with mock.patch.object(evidence, "_encode", side_effect=RuntimeError("boom")):
            counts = persist_analysis(
                self.session, copy.deepcopy(_ALERT_ANALYSIS), evidence_frame=_FRAME
            )

        self.assertEqual(counts["alerts"], 1)
        self.assertEqual(SessionSnapshot.objects.count(), 0)


class TerminationSnapshotTests(_EvidenceFixture, APITestCase):
    def test_terminate_keeps_at_least_five_frames_linked_to_the_termination_record(self):
        self._stream(8)

        terminate_session(self.session, terminated_by=self.admin)

        snaps = SessionSnapshot.objects.filter(
            session=self.session, kind=SessionSnapshot.Kind.TERMINATION
        )
        self.assertGreaterEqual(snaps.count(), 5)
        log = SessionLog.objects.get(
            session=self.session, event_type=SessionLog.EventType.TERMINATED
        )
        for snap in snaps:
            self.assertEqual(snap.session_log_id, log.id)
            self.assertEqual(snap.user_id, self.student.id)
            self.assertEqual(snap.exam_id, self.exam.id)
            self.assertIsNone(snap.alert_id)
        # Oldest first, so a reviewer sees what led up to the termination.
        times = [s.captured_at for s in snaps]
        self.assertEqual(times, sorted(times))

    def test_flagged_frames_survive_a_long_quiet_stretch(self):
        self._stream(3, _ALERT_ANALYSIS)
        self._stream(evidence.RECENT_FRAMES + 4)

        terminate_session(self.session, terminated_by=self.admin)

        snaps = SessionSnapshot.objects.filter(kind=SessionSnapshot.Kind.TERMINATION)
        flagged = [s for s in snaps if "no_face" in s.flags]
        self.assertEqual(len(flagged), 3)
        self.assertLessEqual(snaps.count(), evidence.MAX_TERMINATION_SNAPSHOTS)

    def test_the_ring_is_bounded(self):
        self._stream(100, _ALERT_ANALYSIS)

        ring = evidence._rings[str(self.session.id)]
        self.assertLessEqual(len(ring.recent), evidence.RECENT_FRAMES)
        self.assertLessEqual(len(ring.flagged), evidence.FLAGGED_FRAMES)

    def test_termination_evidence_is_saved_once(self):
        self._stream(6)
        terminate_session(self.session, terminated_by=self.admin)
        first = SessionSnapshot.objects.count()

        # The examinee's consumer also tries on the terminate push.
        self._stream(6)
        self.assertEqual(evidence.save_termination_snapshots(self.session), 0)

        self.assertEqual(SessionSnapshot.objects.count(), first)

    def test_terminating_a_session_nothing_was_streamed_for_still_succeeds(self):
        terminate_session(self.session, terminated_by=self.admin)

        self.session.refresh_from_db()
        self.assertEqual(self.session.status, ExamSession.Status.TERMINATED)
        self.assertEqual(SessionSnapshot.objects.count(), 0)

    def test_an_evidence_failure_does_not_fail_the_terminate(self):
        self._stream(6)
        with mock.patch(
            "features.monitoring.models.SessionSnapshot.objects.bulk_create",
            side_effect=RuntimeError("db down"),
        ):
            terminate_session(self.session, terminated_by=self.admin)

        self.session.refresh_from_db()
        self.assertEqual(self.session.status, ExamSession.Status.TERMINATED)

    def test_other_sessions_frames_are_untouched(self):
        other = ExamSession.objects.create(
            exam=self.exam,
            user=_make_user(User.Role.STUDENT, "snap_other"),
            status=ExamSession.Status.IN_PROGRESS,
        )
        evidence.remember_frame(other.id, _FRAME, _QUIET_ANALYSIS)
        self._stream(6)

        terminate_session(self.session, terminated_by=self.admin)

        self.assertIn(str(other.id), evidence._rings)
        self.assertFalse(SessionSnapshot.objects.filter(session=other).exists())


class SnapshotApiTests(_EvidenceFixture, APITestCase):
    def setUp(self):
        super().setUp()
        persist_analysis(self.session, copy.deepcopy(_ALERT_ANALYSIS), evidence_frame=_FRAME)
        self._stream(6)
        terminate_session(self.session, terminated_by=self.admin)
        self.warning = SessionSnapshot.objects.get(kind=SessionSnapshot.Kind.WARNING)
        self.url = "/api/monitoring/snapshots/"

    def test_admin_lists_a_sessions_evidence_with_its_links(self):
        self.client.force_authenticate(self.admin)

        response = self.client.get(self.url, {"session": str(self.session.id)})

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        rows = response.data["results"]
        self.assertGreaterEqual(len(rows), 6)
        kinds = {r["kind"] for r in rows}
        self.assertEqual(kinds, {"warning", "termination"})
        warning = next(r for r in rows if r["kind"] == "warning")
        self.assertEqual(warning["alert"], Alert.objects.get(session=self.session).id)
        self.assertEqual(warning["alert_type"], "no_face")
        self.assertEqual(warning["student"], "snap_student")
        self.assertEqual(warning["exam_title"], "Snapshot Exam")
        self.assertTrue(warning["image_url"].endswith("/image/"))
        self.assertNotIn("image", warning)
        termination = next(r for r in rows if r["kind"] == "termination")
        self.assertIsNotNone(termination["session_log"])

    def test_filters_by_kind_and_alert(self):
        self.client.force_authenticate(self.admin)

        by_kind = self.client.get(self.url, {"kind": "termination"})
        by_alert = self.client.get(self.url, {"alert": str(self.warning.alert_id)})

        self.assertTrue(all(r["kind"] == "termination" for r in by_kind.data["results"]))
        self.assertEqual([r["id"] for r in by_alert.data["results"]], [str(self.warning.id)])

    def test_admin_downloads_the_jpeg(self):
        self.client.force_authenticate(self.admin)

        response = self.client.get(f"{self.url}{self.warning.id}/image/", HTTP_ACCEPT="image/jpeg")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "image/jpeg")
        self.assertIn("no-store", response["Cache-Control"])
        self.assertTrue(response.content.startswith(b"\xff\xd8"))

    def test_review_roles_can_read_and_other_roles_cannot(self):
        for role, allowed in (
            (User.Role.PROCTOR, True),
            (User.Role.FACULTY, True),
            (User.Role.STUDENT, False),
        ):
            with self.subTest(role=role):
                user = _make_user(role, f"review_{role.lower()}")
                self.client.force_authenticate(user)
                response = self.client.get(self.url)
                self.assertEqual(
                    response.status_code,
                    status.HTTP_200_OK if allowed else status.HTTP_403_FORBIDDEN,
                )

    def test_the_examinee_can_neither_read_nor_change_their_own_evidence(self):
        self.client.force_authenticate(self.student)
        detail = f"{self.url}{self.warning.id}/"

        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self.client.get(self.url, {"session": str(self.session.id)}).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(self.client.get(detail).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self.client.get(f"{detail}image/", HTTP_ACCEPT="image/jpeg").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        for verb in (self.client.delete, self.client.patch, self.client.put):
            self.assertIn(
                verb(detail).status_code,
                (status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED),
            )
        self.assertTrue(SessionSnapshot.objects.filter(pk=self.warning.pk).exists())

    def test_even_staff_cannot_write_through_the_api(self):
        self.client.force_authenticate(self.admin)
        detail = f"{self.url}{self.warning.id}/"

        self.assertEqual(self.client.delete(detail).status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(self.client.post(self.url, {}).status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(SessionSnapshot.objects.filter(pk=self.warning.pk).exists())

    def test_anonymous_requests_are_rejected(self):
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_the_jpeg_is_not_reachable_through_public_media(self):
        self.client.force_authenticate(None)

        for path in ("/media/", f"/media/{self.warning.id}.jpg"):
            self.assertEqual(self.client.get(path).status_code, status.HTTP_404_NOT_FOUND)

    def test_the_examinee_cannot_delete_their_session_and_with_it_the_evidence(self):
        self.client.force_authenticate(self.student)

        response = self.client.delete(f"/api/sessions/{self.session.id}/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(ExamSession.objects.filter(pk=self.session.pk).exists())
        self.assertTrue(SessionSnapshot.objects.filter(pk=self.warning.pk).exists())


class LiveSocketEvidenceTests(TransactionTestCase):
    """The real consumer path: frames over a socket, then a proctor's terminate."""

    def setUp(self):
        evidence._rings.clear()
        self.admin = _make_user(User.Role.ADMIN, "ws_snap_admin")
        self.student = _make_user(User.Role.STUDENT, "ws_snap_student")
        exam = Exam.objects.create(
            title="WS Snapshot Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
        )
        self.session = ExamSession.objects.create(
            exam=exam,
            user=self.student,
            status=ExamSession.Status.IN_PROGRESS,
            exam_started_at=timezone.now(),
            time_remaining=600,
        )

    def tearDown(self):
        evidence._rings.clear()

    def test_streamed_frames_become_warning_and_termination_evidence(self):
        from rest_framework_simplejwt.tokens import RefreshToken

        token = str(RefreshToken.for_user(self.student).access_token)

        def fake_analyze(image_data, session_id):
            return _FRAME, copy.deepcopy(_ALERT_ANALYSIS)

        async def run():
            examinee = WebsocketCommunicator(
                application,
                f"/ws/monitoring/{self.session.id}/?token={token}",
                headers=[(b"origin", b"http://127.0.0.1")],
            )
            connected, _ = await examinee.connect()
            self.assertTrue(connected)
            await examinee.receive_from()
            try:
                with (
                    mock.patch(
                        "features.monitoring.consumers._decode_and_analyze",
                        side_effect=fake_analyze,
                    ),
                    mock.patch("features.monitoring.consumers._SNAPSHOT_INTERVAL_S", 0.0),
                ):
                    for _ in range(8):
                        await examinee.send_to(
                            text_data=json.dumps({"type": "frame", "image": "x"})
                        )
                        while json.loads(await examinee.receive_from(timeout=5))["type"] != "analysis":
                            pass
                    # The last frame's bookkeeping runs behind its reply.
                    await examinee.send_to(text_data=json.dumps({"type": "ping"}))
                    await examinee.receive_from(timeout=5)
                    await sync_to_async(terminate_session)(self.session, terminated_by=self.admin)
            finally:
                await examinee.disconnect()

        async_to_sync(run)()

        warnings = SessionSnapshot.objects.filter(
            session=self.session, kind=SessionSnapshot.Kind.WARNING
        )
        self.assertEqual(warnings.count(), 1)
        self.assertEqual(warnings.get().alert.alert_type, "no_face")
        terminations = SessionSnapshot.objects.filter(
            session=self.session, kind=SessionSnapshot.Kind.TERMINATION
        )
        self.assertGreaterEqual(terminations.count(), 5)
