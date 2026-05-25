from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from features.exams.models import Exam
from features.session.models import ExamSession

User = get_user_model()


class ReportsAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_rep",
            email="admin_rep@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        exam = Exam.objects.create(
            title="Report Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
        )
        self.session = ExamSession.objects.create(exam=exam, user=self.admin)
        self.client.force_authenticate(user=self.admin)

    def test_report_summary(self):
        response = self.client.get("/api/reports/summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("total_sessions", response.data)

    def test_session_report_detail(self):
        response = self.client.get(f"/api/reports/sessions/{self.session.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("session", response.data)
