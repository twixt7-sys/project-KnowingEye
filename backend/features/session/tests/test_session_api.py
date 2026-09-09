from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from rest_framework.test import APITestCase

from features.exams.models import Exam, Question
from features.session.models import ExamSession
from features.session.services import (
    build_option_order,
    expire_session_if_timed_out,
    touch_setup_activity,
)
from features.session.submission import upsert_response

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
            role=User.Role.STUDENT,
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
        self.assertIn(session.status, (ExamSession.Status.EXPIRED, ExamSession.Status.COMPLETED))

    def test_partial_submit_scores_against_all_questions(self):
        from ai.identity_store import store_reference

        q2 = Question.objects.create(
            exam=self.exam,
            question_text="Second?",
            question_type=Question.QuestionType.TRUE_FALSE,
            options=["True", "False"],
            correct_answer="False",
            points=1,
            order=2,
        )
        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        session_id = start.data["session"]["id"]
        store_reference(ExamSession.objects.get(pk=session_id), [0.1] * 128, "test")
        self.client.post(f"/api/sessions/{session_id}/begin/", format="json")

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
        session = ExamSession.objects.get(pk=session_id)
        self.assertEqual(session.responses.count(), 2)
        self.assertEqual(float(session.percentage_score), 50.0)

    def test_autosave_and_resume(self):
        from ai.identity_store import store_reference

        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        session_id = start.data["session"]["id"]
        store_reference(ExamSession.objects.get(pk=session_id), [0.1] * 128, "test")
        self.client.post(f"/api/sessions/{session_id}/begin/", format="json")

        save = self.client.patch(
            f"/api/sessions/{session_id}/responses/",
            {
                "responses": [
                    {
                        "question_id": self.question.id,
                        "answer_text": "True",
                        "time_spent": 3,
                        "flagged_for_review": True,
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(save.status_code, status.HTTP_200_OK)

        detail = self.client.get(f"/api/sessions/{session_id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(len(detail.data["responses"]), 1)
        self.assertEqual(detail.data["responses"][0]["answer_text"], "True")
        self.assertTrue(detail.data["responses"][0]["flagged_for_review"])

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

    def test_start_without_monitoring_skips_setup(self):
        self.exam.monitoring_enabled = False
        self.exam.save(update_fields=["monitoring_enabled"])

        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        self.assertEqual(start.status_code, status.HTTP_201_CREATED)
        self.assertEqual(start.data["session"]["status"], ExamSession.Status.IN_PROGRESS)

        session = ExamSession.objects.get(pk=start.data["session"]["id"])
        self.assertIsNotNone(session.exam_started_at)

        begin = self.client.post(f"/api/sessions/{session.id}/begin/", format="json")
        self.assertEqual(begin.status_code, status.HTTP_400_BAD_REQUEST)

    def test_max_attempts_enforced(self):
        from ai.identity_store import store_reference

        self.exam.max_attempts = 1
        self.exam.save(update_fields=["max_attempts"])

        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        session = ExamSession.objects.get(pk=start.data["session"]["id"])
        store_reference(session, [0.1] * 128, "test")
        self.client.post(f"/api/sessions/{session.id}/begin/", format="json")
        self.client.post(
            f"/api/sessions/{session.id}/submit/",
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

        retry = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        self.assertEqual(retry.status_code, status.HTTP_400_BAD_REQUEST)

    def test_exam_not_yet_open(self):
        self.exam.available_from = timezone.now() + timedelta(days=1)
        self.exam.save(update_fields=["available_from"])
        response = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_start_second_exam_while_first_is_active(self):
        other_exam = Exam.objects.create(
            title="Other Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
        )

        first = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second = self.client.post("/api/sessions/start/", {"exam": other_exam.id}, format="json")
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already have an exam", str(second.data).lower())

        # Same exam can still be resumed.
        resume = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        self.assertEqual(resume.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resume.data["session"]["id"], first.data["session"]["id"])

    def test_can_start_another_exam_after_submit(self):
        from ai.identity_store import store_reference

        other_exam = Exam.objects.create(
            title="Next Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
            monitoring_enabled=False,
        )

        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        session_id = start.data["session"]["id"]
        session = ExamSession.objects.get(pk=session_id)
        store_reference(session, [0.1] * 128, "test")
        self.client.post(f"/api/sessions/{session_id}/begin/", format="json")
        self.client.post(
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

        next_start = self.client.post(
            "/api/sessions/start/", {"exam": other_exam.id}, format="json"
        )
        self.assertEqual(next_start.status_code, status.HTTP_201_CREATED)
        self.assertEqual(next_start.data["session"]["status"], ExamSession.Status.IN_PROGRESS)

    def test_auto_submit_on_server_timeout(self):
        from ai.identity_store import store_reference

        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        session = ExamSession.objects.get(pk=start.data["session"]["id"])
        store_reference(session, [0.1] * 128, "test")
        self.client.post(f"/api/sessions/{session.id}/begin/", format="json")
        session.refresh_from_db()

        upsert_response(
            session,
            question=self.question,
            answer_text="True",
            time_spent=5,
            autosave=True,
        )
        session.refresh_from_db()
        session.exam_started_at = timezone.now() - timedelta(minutes=self.exam.duration_minutes + 5)
        session.deadline_at = timezone.now() - timedelta(minutes=1)
        session.save(update_fields=["exam_started_at", "deadline_at"])

        self.assertTrue(expire_session_if_timed_out(session))
        session.refresh_from_db()
        self.assertEqual(session.status, ExamSession.Status.COMPLETED)
        self.assertTrue(session.passed)

    def test_stale_setup_on_other_exam_does_not_block(self):
        other_exam = Exam.objects.create(
            title="Stale Setup Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
        )
        stale = ExamSession.objects.create(
            exam=other_exam,
            user=self.examinee,
            status=ExamSession.Status.SETUP,
        )
        ExamSession.objects.filter(pk=stale.pk).update(
            started_at=timezone.now() - timedelta(minutes=35)
        )

        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        self.assertEqual(start.status_code, status.HTTP_201_CREATED)
        stale.refresh_from_db()
        self.assertEqual(stale.status, ExamSession.Status.EXPIRED)

    def test_true_false_default_options_are_dict_shaped(self):
        """A true/false question with no explicit options must present {text,
        image} choices, matching every other option shape - plain strings
        render as blank, unclickable buttons in the taking UI."""
        q = Question.objects.create(
            exam=self.exam,
            question_text="No explicit options",
            question_type=Question.QuestionType.TRUE_FALSE,
            options=[],
            correct_answer="True",
            points=1,
            order=3,
        )
        order = build_option_order(self.exam, [q.id])
        options = order[str(q.id)]
        self.assertEqual(len(options), 2)
        for opt in options:
            self.assertIsInstance(opt, dict)
            self.assertIn(opt["text"], ("True", "False"))

    def test_cancel_setup_frees_the_slot_immediately(self):
        other_exam = Exam.objects.create(
            title="Other Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
        )
        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        session_id = start.data["session"]["id"]

        blocked = self.client.post("/api/sessions/start/", {"exam": other_exam.id}, format="json")
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)

        cancel = self.client.post(f"/api/sessions/{session_id}/cancel-setup/")
        self.assertEqual(cancel.status_code, status.HTTP_200_OK)
        session = ExamSession.objects.get(pk=session_id)
        self.assertEqual(session.status, ExamSession.Status.EXPIRED)

        now_allowed = self.client.post(
            "/api/sessions/start/", {"exam": other_exam.id}, format="json"
        )
        self.assertEqual(now_allowed.status_code, status.HTTP_201_CREATED)

    def test_cancel_setup_rejects_in_progress_session(self):
        self.exam.monitoring_enabled = False
        self.exam.save(update_fields=["monitoring_enabled"])
        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        session_id = start.data["session"]["id"]

        cancel = self.client.post(f"/api/sessions/{session_id}/cancel-setup/")
        self.assertEqual(cancel.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(DEBUG=True)
    def test_begin_bypasses_identity_check_when_pipeline_disabled_in_debug(self):
        from django.conf import settings

        orig = settings.KNOWING_EYE.get("ENABLE_PIPELINE", True)
        settings.KNOWING_EYE["ENABLE_PIPELINE"] = False
        try:
            start = self.client.post(
                "/api/sessions/start/", {"exam": self.exam.id}, format="json"
            )
            session_id = start.data["session"]["id"]
            begin = self.client.post(f"/api/sessions/{session_id}/begin/", format="json")
            self.assertEqual(begin.status_code, status.HTTP_200_OK)
        finally:
            settings.KNOWING_EYE["ENABLE_PIPELINE"] = orig

    def test_begin_still_requires_identity_when_pipeline_enabled(self):
        # DEBUG defaults True in the dev settings tests run under, so this
        # confirms the bypass needs the pipeline disabled too, not DEBUG alone.
        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        session_id = start.data["session"]["id"]
        begin = self.client.post(f"/api/sessions/{session_id}/begin/", format="json")
        self.assertEqual(begin.status_code, status.HTTP_400_BAD_REQUEST)

    def test_submit_rejects_question_outside_attempt(self):
        """A question that belongs to the exam but wasn't drawn into this
        attempt's question_order (e.g. from an unused pool) must be rejected,
        matching the autosave path's membership check."""
        self.exam.monitoring_enabled = False
        self.exam.save(update_fields=["monitoring_enabled"])
        outside_question = Question.objects.create(
            exam=self.exam,
            question_text="Not in this attempt",
            question_type=Question.QuestionType.TRUE_FALSE,
            options=["True", "False"],
            correct_answer="True",
            points=1,
            order=4,
        )
        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        session_id = start.data["session"]["id"]
        session = ExamSession.objects.get(pk=session_id)
        session.question_order = [self.question.id]
        session.save(update_fields=["question_order"])

        submit = self.client.post(
            f"/api/sessions/{session_id}/submit/",
            {
                "responses": [
                    {
                        "question_id": outside_question.id,
                        "answer_text": "True",
                        "time_spent": 5,
                    }
                ],
                "time_remaining": 100,
            },
            format="json",
        )
        self.assertEqual(submit.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unanswered_counts_as_wrong_false_excludes_from_total(self):
        self.exam.unanswered_counts_as_wrong = False
        self.exam.monitoring_enabled = False
        self.exam.save(update_fields=["unanswered_counts_as_wrong", "monitoring_enabled"])
        q2 = Question.objects.create(
            exam=self.exam,
            question_text="Second?",
            question_type=Question.QuestionType.TRUE_FALSE,
            options=["True", "False"],
            correct_answer="False",
            points=1,
            order=5,
        )
        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        session_id = start.data["session"]["id"]

        # Only answer self.question, leave q2 untouched.
        submit = self.client.post(
            f"/api/sessions/{session_id}/submit/",
            {
                "responses": [
                    {"question_id": self.question.id, "answer_text": "True", "time_spent": 5}
                ],
                "time_remaining": 100,
            },
            format="json",
        )
        self.assertEqual(submit.status_code, status.HTTP_200_OK)
        session = ExamSession.objects.get(pk=session_id)
        # Full credit - the unanswered question is excluded entirely rather
        # than counted as wrong (which would have made this 50%).
        self.assertEqual(float(session.percentage_score), 100.0)
