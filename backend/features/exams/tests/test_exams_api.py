from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from features.exams.models import Exam, Question

User = get_user_model()


class ExamsAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_exam",
            email="admin_exam@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(user=self.admin)
        self.exam = Exam.objects.create(
            title="Sample Exam",
            description="Test",
            duration_minutes=30,
            passing_score=60,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
        )
        Question.objects.create(
            exam=self.exam,
            question_text="2 + 2 = ?",
            question_type=Question.QuestionType.MULTIPLE_CHOICE,
            options=["3", "4", "5"],
            correct_answer="4",
            points=1,
            order=1,
        )

    def test_list_exams(self):
        response = self.client.get("/api/exams/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data.get("count", len(response.data)), 1)

    def test_create_exam(self):
        response = self.client.post(
            "/api/exams/",
            {
                "title": "New Exam",
                "description": "Created in test",
                "duration_minutes": 45,
                "passing_score": 70,
                "status": "draft",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "New Exam")
