from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from rest_framework.test import APITestCase

from features.exams.models import Exam, Question
from features.session.models import ExamSession
from features.session.services import touch_setup_activity

User = get_user_model()


class SessionAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_sess",
            email="admin_sess@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.examinee = User.objects.create_user(
            username="student_sess",
            email="student_sess@test.local",
            password="TestPass123!",
            role=User.Role.EXAMINEE,
        )
        self.exam = Exam.objects.create(
            title="Session Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
        )
        self.question = Question.objects.create(
            exam=self.exam,
            question_text="Yes or no?",
            question_type=Question.QuestionType.TRUE_FALSE,
            options=["True", "False"],
            correct_answer="True",
            points=1,
            order=1,
        )
        self.client.force_authenticate(user=self.examinee)

    def test_start_creates_setup_session(self):
        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        self.assertEqual(start.status_code, status.HTTP_201_CREATED)
        self.assertEqual(start.data["session"]["status"], ExamSession.Status.SETUP)
        session = ExamSession.objects.get(pk=start.data["session"]["id"])
        self.assertIsNone(session.exam_started_at)

    def test_begin_requires_identity_enrollment(self):
        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        session_id = start.data["session"]["id"]
        begin = self.client.post(f"/api/sessions/{session_id}/begin/", format="json")
        self.assertEqual(begin.status_code, status.HTTP_400_BAD_REQUEST)

    def test_start_and_submit_session(self):
        from ai.identity_store import store_reference

        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        self.assertEqual(start.status_code, status.HTTP_201_CREATED)
        session_id = start.data["session"]["id"]
        session = ExamSession.objects.get(pk=session_id)
        self.assertEqual(session.status, ExamSession.Status.SETUP)

        store_reference(session, [0.1] * 128, "test")
        begin = self.client.post(f"/api/sessions/{session_id}/begin/", format="json")
        self.assertEqual(begin.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertEqual(session.status, ExamSession.Status.IN_PROGRESS)
        self.assertIsNotNone(session.exam_started_at)

        submit = self.client.post(
            f"/api/sessions/{session_id}/submit/",
            {
                "responses": [
                    {
                        "question_id": self.question.id,
                        "answer_text": "True",
                        "time_spent": 5,
                    }
                ],
                "time_remaining": 100,
            },
            format="json",
        )
        self.assertEqual(submit.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertEqual(session.status, ExamSession.Status.COMPLETED)
        self.assertTrue(session.passed)

    def test_expired_session_cannot_submit(self):
        from datetime import timedelta

        from django.utils import timezone
        from ai.identity_store import store_reference

        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        session_id = start.data["session"]["id"]
        session = ExamSession.objects.get(pk=session_id)
        store_reference(session, [0.1] * 128, "test")
        self.client.post(f"/api/sessions/{session_id}/begin/", format="json")
        session.refresh_from_db()
        session.exam_started_at = timezone.now() - timedelta(minutes=self.exam.duration_minutes + 5)
        session.save(update_fields=["exam_started_at"])

        submit = self.client.post(
            f"/api/sessions/{session_id}/submit/",
            {"responses": [], "time_remaining": 0},
            format="json",
        )
        self.assertEqual(submit.status_code, status.HTTP_400_BAD_REQUEST)
        session.refresh_from_db()
        self.assertEqual(session.status, ExamSession.Status.EXPIRED)

    def test_setup_activity_prevents_idle_expiry(self):
        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        session = ExamSession.objects.get(pk=start.data["session"]["id"])
        session.started_at = timezone.now() - timedelta(minutes=35)
        session.save(update_fields=["started_at"])

        touch_setup_activity(session)
        from features.session.services import ensure_active_session

        self.assertTrue(ensure_active_session(session))
        session.refresh_from_db()
        self.assertEqual(session.status, ExamSession.Status.SETUP)

    def test_resume_setup_refreshes_stale_session(self):
        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        session = ExamSession.objects.get(pk=start.data["session"]["id"])
        session.started_at = timezone.now() - timedelta(minutes=35)
        session.save(update_fields=["started_at"])

        resume = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        self.assertEqual(resume.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resume.data["session"]["id"], str(session.id))
        session.refresh_from_db()
        self.assertEqual(session.status, ExamSession.Status.SETUP)
        self.assertGreater(session.started_at, timezone.now() - timedelta(minutes=1))
