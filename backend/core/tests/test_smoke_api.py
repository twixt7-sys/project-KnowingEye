"""Cross-feature API smoke tests — critical user journeys."""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from features.exams.models import Exam, Question

User = get_user_model()

CSV_TEMPLATE = """question_text,question_type,options,correct_answer,points
What is 2 + 2?,multiple_choice,3|4|5,4,1
The earth is round.,true_false,,true,1
Define photosynthesis in one sentence.,short_answer,,process by which plants make food,2
"""


class SystemSmokeTests(APITestCase):
    """End-to-end checks for auth, exams, sessions, and reports."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username="smoke_admin",
            email="smoke_admin@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        User.objects.create_user(
            username="smoke_student",
            email="smoke_student@test.local",
            password="TestPass123!",
            role=User.Role.EXAMINEE,
        )

    def test_full_exam_builder_and_reporting_flow(self):
        login = self.client.post(
            "/api/auth/token/",
            {"username": "smoke_admin", "password": "TestPass123!"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

        profile = self.client.get("/api/auth/profile/me/")
        self.assertEqual(profile.status_code, status.HTTP_200_OK)

        create_exam = self.client.post(
            "/api/exams/",
            {
                "title": "Smoke Exam",
                "description": "Smoke test exam",
                "duration_minutes": 30,
                "passing_score": 60,
                "status": "draft",
            },
            format="json",
        )
        self.assertEqual(create_exam.status_code, status.HTTP_201_CREATED)
        exam_id = create_exam.data["id"]

        create_q = self.client.post(
            f"/api/exams/{exam_id}/questions/",
            {
                "question_text": "Capital of France?",
                "question_type": "multiple_choice",
                "options": ["London", "Paris", "Berlin"],
                "correct_answer": "Paris",
                "points": 2,
            },
            format="json",
        )
        self.assertEqual(create_q.status_code, status.HTTP_201_CREATED)

        import_q = self.client.post(
            f"/api/exams/{exam_id}/questions/import/",
            {"csv": CSV_TEMPLATE},
            format="json",
        )
        self.assertEqual(import_q.status_code, status.HTTP_201_CREATED)
        self.assertEqual(import_q.data["imported"], 3)

        list_q = self.client.get(f"/api/exams/{exam_id}/questions/")
        self.assertEqual(list_q.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(list_q.data), 4)

        readiness = self.client.get(f"/api/exams/{exam_id}/readiness/")
        self.assertEqual(readiness.status_code, status.HTTP_200_OK)
        self.assertTrue(readiness.data["ready"])

        publish = self.client.post(f"/api/exams/{exam_id}/publish/", format="json")
        self.assertEqual(publish.status_code, status.HTTP_200_OK)

        student_login = self.client.post(
            "/api/auth/token/",
            {"username": "smoke_student", "password": "TestPass123!"},
            format="json",
        )
        self.assertEqual(student_login.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_login.data['access']}")

        start = self.client.post("/api/sessions/start/", {"exam": exam_id}, format="json")
        self.assertIn(start.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        session_id = start.data["session"]["id"]
        self.assertEqual(start.data["session"]["status"], "setup")

        from ai.identity_store import store_reference
        from features.session.models import ExamSession

        session = ExamSession.objects.get(pk=session_id)
        store_reference(session, [0.1] * 128, "test")
        begin = self.client.post(f"/api/sessions/{session_id}/begin/", format="json")
        self.assertEqual(begin.status_code, status.HTTP_200_OK)
        self.assertEqual(begin.data["session"]["status"], "in_progress")

        detail = self.client.get(f"/api/sessions/{session_id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        self.assertEqual(self.client.get("/api/reports/summary/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get("/api/reports/sessions/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get("/api/behavior/alerts/").status_code, status.HTTP_200_OK)

        csv_export = self.client.get("/api/reports/export/csv/")
        self.assertEqual(csv_export.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", csv_export["Content-Type"])

        pdf_export = self.client.get("/api/reports/export/pdf/")
        self.assertEqual(pdf_export.status_code, status.HTTP_200_OK)
        self.assertIn("application/pdf", pdf_export["Content-Type"])

        self.assertEqual(self.client.get("/api/exams/").status_code, status.HTTP_200_OK)
