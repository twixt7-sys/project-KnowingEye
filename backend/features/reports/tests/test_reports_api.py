from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from features.behavior.models import Alert
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
        Alert.objects.create(
            session=self.session,
            alert_type="multiple_faces",
            severity="high",
            message="x",
            resolved=False,
        )
        self.client.force_authenticate(user=self.admin)

    def test_report_summary(self):
        response = self.client.get("/api/reports/summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("total_sessions", response.data)
        self.assertIn("alerts_by_severity", response.data)

    def test_session_report_detail(self):
        response = self.client.get(f"/api/reports/sessions/{self.session.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("session", response.data)

    def test_list_session_reports_filters(self):
        response = self.client.get("/api/reports/sessions/?status=in_progress")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        row = response.data["results"][0]
        self.assertEqual(row["alert_count"], 1)
        self.assertEqual(row["unresolved_alert_count"], 1)

    def test_list_session_reports_pagination(self):
        response = self.client.get("/api/reports/sessions/?page=1&page_size=1")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertIsNone(response.data["previous"])

    def test_export_csv(self):
        response = self.client.get("/api/reports/export/csv/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response["Content-Type"].startswith("text/csv"))
        body = response.content.decode("utf-8")
        self.assertIn("session_id,exam_id", body.split("\n")[0])

    def test_export_pdf(self):
        response = self.client.get("/api/reports/export/pdf/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response["Content-Type"].startswith("application/pdf"))
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_timeseries(self):
        response = self.client.get("/api/reports/timeseries/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("sessions", response.data)
        self.assertIn("alerts", response.data)
        self.assertIn("behaviors", response.data)
