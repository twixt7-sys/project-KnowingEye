import base64

import cv2
import numpy as np
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from features.exams.models import Exam
from features.session.models import ExamSession

User = get_user_model()


def _jpeg_b64(fill=(120, 120, 120), pattern: str | None = None) -> str:
    img = np.zeros((48, 64, 3), dtype=np.uint8)
    img[:] = fill
    if pattern == "split":
        # Strong spatial structure (dark left, bright right) — distinct from a
        # flat frame, so the appearance signature differs markedly.
        img[:, :32] = 0
        img[:, 32:] = 255
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")


def _tiny_jpeg_b64() -> str:
    return _jpeg_b64()


class MonitoringAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_mon",
            email="admin_mon@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.examinee = User.objects.create_user(
            username="student_mon",
            email="student_mon@test.local",
            password="TestPass123!",
            role=User.Role.EXAMINEE,
        )
        exam = Exam.objects.create(
            title="Monitor Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
        )
        self.session = ExamSession.objects.create(exam=exam, user=self.examinee)
        self.client.force_authenticate(user=self.examinee)

    def test_monitoring_health(self):
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/monitoring/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("pipeline_mode", response.data)

    def test_receive_frame(self):
        response = self.client.post(
            "/api/monitoring/frame/",
            {"image": _tiny_jpeg_b64(), "session_id": str(self.session.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")
        self.assertIn("analysis", response.data)

    def test_receive_frame_rejects_other_examinee(self):
        other = User.objects.create_user(
            username="other_student",
            email="other@test.local",
            password="TestPass123!",
            role=User.Role.EXAMINEE,
        )
        self.client.force_authenticate(user=other)
        response = self.client.post(
            "/api/monitoring/frame/",
            {"image": _tiny_jpeg_b64(), "session_id": str(self.session.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_enroll_reference_endpoint(self):
        response = self.client.post(
            "/api/monitoring/enroll/",
            {"image": _tiny_jpeg_b64(), "session_id": str(self.session.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("pipeline_mode", response.data)
        self.assertIn("ok", response.data)
        self.assertIn("enrolled", response.data)


class IdentityFlowTests(APITestCase):
    """Per-session identity enroll → verify flow.

    Forces the deterministic stub analyzer so the enroll/verify cycle can be
    exercised with synthetic frames (the real detectors only fire on genuine
    faces). The stub mirrors the production contract end to end.
    """

    def setUp(self):
        from ai.adapter import reset_pipeline
        from ai.identity_store import clear_cache
        from django.conf import settings

        self._orig_enable = settings.KNOWING_EYE.get("ENABLE_PIPELINE", True)
        settings.KNOWING_EYE["ENABLE_PIPELINE"] = False
        reset_pipeline()
        clear_cache()

        self.admin = User.objects.create_user(
            username="id_admin",
            email="id_admin@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.examinee = User.objects.create_user(
            username="id_student",
            email="id_student@test.local",
            password="TestPass123!",
            role=User.Role.EXAMINEE,
        )
        self.exam = Exam.objects.create(
            title="Identity Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
        )
        self.session = ExamSession.objects.create(exam=self.exam, user=self.examinee)
        self.client.force_authenticate(user=self.examinee)

    def tearDown(self):
        from ai.adapter import reset_pipeline
        from django.conf import settings

        settings.KNOWING_EYE["ENABLE_PIPELINE"] = self._orig_enable
        reset_pipeline()

    def _enroll(self, session, **kwargs):
        return self.client.post(
            "/api/monitoring/enroll/",
            {"image": _jpeg_b64(**kwargs), "session_id": str(session.id)},
            format="json",
        )

    def _frame(self, session, **kwargs):
        return self.client.post(
            "/api/monitoring/frame/",
            {"image": _jpeg_b64(**kwargs), "session_id": str(session.id)},
            format="json",
        )

    def test_enrollment_succeeds(self):
        res = self._enroll(self.session)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["ok"])
        self.assertTrue(res.data["enrolled"])
        self.assertGreater(res.data["dims"], 0)

    def test_identity_unknown_before_enrollment(self):
        """No silent auto-enrol: identity stays unknown until a reference exists."""
        res = self._frame(self.session)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsNone(res.data["analysis"]["metrics"]["identity_match_pct"])

    def test_identity_matches_enrolled_reference(self):
        self.assertTrue(self._enroll(self.session).data["ok"])
        metrics = self._frame(self.session).data["analysis"]["metrics"]
        self.assertIsNotNone(metrics["identity_match_pct"])
        self.assertGreaterEqual(metrics["identity_match_pct"], 80.0)
        self.assertNotIn("identity", metrics["flagged_metrics"])

    def test_identity_mismatch_flags_and_alerts(self):
        self.assertTrue(self._enroll(self.session, fill=(120, 120, 120)).data["ok"])
        analysis = self._frame(self.session, pattern="split").data["analysis"]
        metrics = analysis["metrics"]
        self.assertIsNotNone(metrics["identity_match_pct"])
        self.assertIn("identity", metrics["flagged_metrics"])
        self.assertIn("identity_mismatch", [a["type"] for a in analysis["alerts"]])

    def test_mismatch_persists_behavior_log(self):
        from features.behavior.models import BehaviorLog

        self._enroll(self.session, fill=(120, 120, 120))
        self._frame(self.session, pattern="split")
        self.assertTrue(
            BehaviorLog.objects.filter(
                session=self.session,
                event_type=BehaviorLog.EventType.IDENTITY_MISMATCH,
            ).exists()
        )

    def test_reference_is_per_session(self):
        """A reference enrolled for one session must not leak into another."""
        other_exam = Exam.objects.create(
            title="Identity Exam 2",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
        )
        other_session = ExamSession.objects.create(exam=other_exam, user=self.examinee)
        self.assertTrue(self._enroll(self.session).data["ok"])
        # Second session was never enrolled → identity stays unknown.
        metrics = self._frame(other_session).data["analysis"]["metrics"]
        self.assertIsNone(metrics["identity_match_pct"])
