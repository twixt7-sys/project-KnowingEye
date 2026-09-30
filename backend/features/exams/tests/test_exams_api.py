import shutil
import tempfile
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from features.exams.models import Department, Exam, Question, QuestionAttachment

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
        self.department = Department.objects.create(
            name="Institute of Information Technology",
            abbreviation="IIT",
        )
        now = timezone.now()
        self.exam = Exam.objects.create(
            title="Sample Exam",
            description="Test",
            duration_minutes=30,
            passing_score=60,
            status=Exam.Status.DRAFT,
            created_by=self.admin,
            available_from=now,
            available_until=now + timedelta(days=7),
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
                "department_id": self.department.id,
                "status": "draft",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "New Exam")
        self.assertIsNotNone(response.data["exam_code"])

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

    def test_created_question_returns_id_so_a_picture_can_be_attached(self):
        """The builder uploads a new question's pictures using the id from the create response."""
        media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media_root, ignore_errors=True)
        with override_settings(MEDIA_ROOT=media_root):
            created = self.client.post(
                f"/api/exams/{self.exam.id}/questions/",
                {
                    "question_text": "Which shape is shown?",
                    "question_type": "multiple_choice",
                    "options": [{"text": "Circle", "image": None}, {"text": "Square", "image": None}],
                    "correct_answer": "Circle",
                    "points": 1,
                },
                format="json",
            )
            self.assertEqual(created.status_code, status.HTTP_201_CREATED)
            self.assertIsInstance(created.data["id"], int)

            png = SimpleUploadedFile("shape.png", b"\x89PNG\r\n\x1a\n", content_type="image/png")
            upload = self.client.post(
                f"/api/exams/{self.exam.id}/questions/{created.data['id']}/attachments/",
                {"file": png},
                format="multipart",
            )
            self.assertEqual(upload.status_code, status.HTTP_201_CREATED)
            self.assertEqual(upload.data["kind"], QuestionAttachment.Kind.IMAGE)

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

    def test_attachment_urls_are_absolute_in_list_and_reorder(self):
        """Frontend and API are separate origins in prod, so URLs must carry the host."""
        media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media_root, ignore_errors=True)
        with override_settings(MEDIA_ROOT=media_root):
            question = Question.objects.get(exam=self.exam)
            png = SimpleUploadedFile("chart.png", b"\x89PNG\r\n\x1a\n", content_type="image/png")
            upload = self.client.post(
                f"/api/exams/{self.exam.id}/questions/{question.id}/attachments/",
                {"file": png},
                format="multipart",
            )
            self.assertEqual(upload.status_code, status.HTTP_201_CREATED)
            self.assertTrue(upload.data["url"].startswith("http"))

            listed = self.client.get(f"/api/exams/{self.exam.id}/questions/")
            self.assertTrue(listed.data[0]["attachments"][0]["url"].startswith("http"))

            reordered = self.client.post(
                f"/api/exams/{self.exam.id}/questions/reorder/",
                {"question_ids": [question.id]},
                format="json",
            )
            self.assertEqual(reordered.status_code, status.HTTP_200_OK)
            self.assertTrue(reordered.data[0]["attachments"][0]["url"].startswith("http"))

    def test_upload_option_image_returns_absolute_url(self):
        media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media_root, ignore_errors=True)
        with override_settings(MEDIA_ROOT=media_root):
            question = Question.objects.get(exam=self.exam)
            png = SimpleUploadedFile("opt.png", b"\x89PNG\r\n\x1a\n", content_type="image/png")
            response = self.client.post(
                f"/api/exams/{self.exam.id}/questions/{question.id}/option-image/",
                {"file": png},
                format="multipart",
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertTrue(response.data["url"].startswith("http"))
            self.assertIn("/media/questions/", response.data["url"])

    def test_upload_rejects_unsupported_file_type(self):
        question = Question.objects.get(exam=self.exam)
        exe = SimpleUploadedFile("run.exe", b"MZ", content_type="application/x-msdownload")
        response = self.client.post(
            f"/api/exams/{self.exam.id}/questions/{question.id}/attachments/",
            {"file": exe},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_publish_exam(self):
        response = self.client.post(f"/api/exams/{self.exam.id}/publish/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.exam.refresh_from_db()
        self.assertEqual(self.exam.status, Exam.Status.ACTIVE)

    def test_archive_exam(self):
        self.exam.status = Exam.Status.ACTIVE
        self.exam.save(update_fields=["status"])
        response = self.client.post(f"/api/exams/{self.exam.id}/archive/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.exam.refresh_from_db()
        self.assertEqual(self.exam.status, Exam.Status.ARCHIVED)

    def test_cannot_edit_active_exam(self):
        self.exam.status = Exam.Status.ACTIVE
        self.exam.save(update_fields=["status"])
        response = self.client.patch(
            f"/api/exams/{self.exam.id}/",
            {"title": "Changed title"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_add_question_to_active_exam(self):
        self.exam.status = Exam.Status.ACTIVE
        self.exam.save(update_fields=["status"])
        response = self.client.post(
            f"/api/exams/{self.exam.id}/questions/",
            {
                "question_text": "Blocked?",
                "question_type": "multiple_choice",
                "options": ["A", "B"],
                "correct_answer": "A",
                "points": 1,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
