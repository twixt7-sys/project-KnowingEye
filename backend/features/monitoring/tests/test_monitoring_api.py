import base64

import cv2
import numpy as np
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from features.exams.models import Exam
from features.session.models import ExamSession

User = get_user_model()


def _tiny_jpeg_b64() -> str:
    img = np.zeros((48, 64, 3), dtype=np.uint8)
    img[:] = (120, 120, 120)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")


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
