from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from features.exams.models import Exam, Question, QuestionAttachment

User = get_user_model()

CSV_TEMPLATE = """question_text,question_type,options,correct_answer,points
What is 2 + 2?,multiple_choice,3|4|5,4,1
The earth is round.,true_false,,true,1
Define photosynthesis in one sentence.,short_answer,,process by which plants make food,2
"""


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
            status=Exam.Status.DRAFT,
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

    def test_create_question_via_nested_route(self):
        response = self.client.post(
            f"/api/exams/{self.exam.id}/questions/",
            {
                "question_text": "Capital of France?",
                "question_type": "multiple_choice",
                "options": ["London", "Paris", "Berlin"],
                "correct_answer": "Paris",
                "points": 2,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["question_text"], "Capital of France?")

    def test_import_questions_from_csv_template(self):
        response = self.client.post(
            f"/api/exams/{self.exam.id}/questions/import/",
            {"csv": CSV_TEMPLATE},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["imported"], 3)

    def test_list_questions_returns_admin_detail(self):
        response = self.client.get(f"/api/exams/{self.exam.id}/questions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
        self.assertIn("correct_answer", response.data[0])

    def test_upload_question_attachment(self):
        question = Question.objects.get(exam=self.exam)
        png = SimpleUploadedFile("chart.png", b"\x89PNG\r\n\x1a\n", content_type="image/png")
        response = self.client.post(
            f"/api/exams/{self.exam.id}/questions/{question.id}/attachments/",
            {"file": png},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["kind"], QuestionAttachment.Kind.IMAGE)
        self.assertIn("url", response.data)

        list_q = self.client.get(f"/api/exams/{self.exam.id}/questions/")
        self.assertEqual(len(list_q.data[0]["attachments"]), 1)
