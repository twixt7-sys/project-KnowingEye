"""Proctor pause / resume of an in-progress exam session."""

from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.security import service as security
from features.behavior.models import Alert
from features.behavior.services import persist_analysis
from features.exams.models import Exam, Question
from features.exams.services import exam_has_active_session
from features.session.models import ExamSession, SessionLog
from features.session.services import (
    ensure_active_session,
    expire_session_if_timed_out,
)

User = get_user_model()

EXAM_MINUTES = 10


class SessionPauseTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="pause_admin",
            email="pause_admin@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.proctor = User.objects.create_user(
            username="pause_proctor",
            email="pause_proctor@test.local",
            password="TestPass123!",
            role=User.Role.PROCTOR,
        )
        self.student = User.objects.create_user(
            username="pause_student",
            email="pause_student@test.local",
            password="TestPass123!",
            role=User.Role.STUDENT,
        )
        self.exam = Exam.objects.create(
            title="Pause Exam",
            description="",
            duration_minutes=EXAM_MINUTES,
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
        # Four minutes into a ten-minute exam.
        self.session = self._session(elapsed=timedelta(minutes=4))

    def _session(self, *, elapsed, status_=ExamSession.Status.IN_PROGRESS, user=None):
        started = timezone.now() - elapsed
        session = ExamSession.objects.create(
            exam=self.exam,
            user=user or self.student,
            status=status_,
            exam_started_at=started,
            time_remaining=EXAM_MINUTES * 60,
            question_order=[self.question.id],
        )
        session.deadline_at = started + timedelta(seconds=session.duration_seconds)
        session.save(update_fields=["deadline_at"])
        return session

    def _pause(self, session=None, **body):
        session = session or self.session
        return self.client.post(f"/api/sessions/{session.id}/pause/", body, format="json")

    def _resume(self, session=None):
        session = session or self.session
        return self.client.post(f"/api/sessions/{session.id}/resume/", format="json")

    # --- pause / resume ---------------------------------------------------

    def test_admin_pauses_and_resumes(self):
        self.client.force_authenticate(self.admin)

        paused = self._pause(reason="Fire drill")
        self.assertEqual(paused.status_code, status.HTTP_200_OK, paused.data)
        self.assertEqual(paused.data["status"], ExamSession.Status.PAUSED)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, ExamSession.Status.PAUSED)
        self.assertIsNotNone(self.session.paused_at)
        self.assertEqual(self.session.pause_reason, "Fire drill")

        log = SessionLog.objects.get(session=self.session, event_type=SessionLog.EventType.PAUSED)
        self.assertEqual(log.details["paused_by"], self.admin.username)
        self.assertEqual(log.details["reason"], "Fire drill")

        resumed = self._resume()
        self.assertEqual(resumed.status_code, status.HTTP_200_OK, resumed.data)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, ExamSession.Status.IN_PROGRESS)
        self.assertIsNone(self.session.paused_at)
        self.assertEqual(self.session.pause_reason, "")
        self.assertTrue(
            SessionLog.objects.filter(
                session=self.session, event_type=SessionLog.EventType.RESUMED
            ).exists()
        )

    def test_reason_is_optional_and_length_limited(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self._pause().status_code, status.HTTP_200_OK)
        self._resume()
        too_long = self._pause(reason="x" * 256)
        self.assertEqual(too_long.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pause_requires_the_pause_permission(self):
        for user in (self.student, self.proctor):
            self.client.force_authenticate(user)
            response = self._pause()
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, user.username)
            self.assertEqual(self._resume().status_code, status.HTTP_403_FORBIDDEN, user.username)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, ExamSession.Status.IN_PROGRESS)

    def test_granted_user_can_pause(self):
        security.grant_action(self.proctor, "sessions.pause")
        security.grant_module_access(self.proctor, "sessions")
        self.client.force_authenticate(self.proctor)
        self.assertEqual(self._pause().status_code, status.HTTP_200_OK)
        self.assertEqual(self._resume().status_code, status.HTTP_200_OK)

    def test_only_in_progress_sessions_can_be_paused(self):
        self.client.force_authenticate(self.admin)
        for state in (
            ExamSession.Status.SETUP,
            ExamSession.Status.COMPLETED,
            ExamSession.Status.TERMINATED,
        ):
            other = User.objects.create_user(
                username=f"pause_other_{state}",
                email=f"pause_other_{state}@test.local",
                password="TestPass123!",
                role=User.Role.STUDENT,
            )
            session = self._session(elapsed=timedelta(minutes=1), status_=state, user=other)
            response = self._pause(session)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, state)
            session.refresh_from_db()
            self.assertEqual(session.status, state)

    def test_double_pause_and_resume_of_running_session_are_rejected(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self._resume().status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self._pause().status_code, status.HTTP_200_OK)
        self.assertEqual(self._pause().status_code, status.HTTP_400_BAD_REQUEST)

    def test_pausing_an_attempt_that_already_ran_out_of_time_closes_it_instead(self):
        self.client.force_authenticate(self.admin)
        late = self._session(
            elapsed=timedelta(minutes=EXAM_MINUTES + 2),
            user=User.objects.create_user(
                username="pause_late",
                email="pause_late@test.local",
                password="TestPass123!",
                role=User.Role.STUDENT,
            ),
        )
        response = self._pause(late)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        late.refresh_from_db()
        self.assertNotEqual(late.status, ExamSession.Status.PAUSED)
        self.assertNotEqual(late.status, ExamSession.Status.IN_PROGRESS)

    # --- the exam clock ---------------------------------------------------

    def test_clock_is_frozen_while_paused(self):
        # Paused three minutes ago, one minute into the exam: nine minutes
        # stay on the clock however long the pause lasts.
        now = timezone.now()
        session = self.session
        session.status = ExamSession.Status.PAUSED
        session.exam_started_at = now - timedelta(minutes=4)
        session.paused_at = now - timedelta(minutes=3)
        session.save()

        self.assertAlmostEqual(session.time_remaining_seconds, 9 * 60, delta=2)
        self.assertAlmostEqual(session.time_elapsed, 60, delta=2)
        self.assertFalse(session.is_expired())

    def test_paused_session_never_times_out(self):
        now = timezone.now()
        session = self.session
        session.status = ExamSession.Status.PAUSED
        session.exam_started_at = now - timedelta(minutes=EXAM_MINUTES * 3)
        session.paused_at = now - timedelta(minutes=EXAM_MINUTES * 2)
        session.save()

        self.assertFalse(expire_session_if_timed_out(session))
        self.assertTrue(ensure_active_session(session))
        session.refresh_from_db()
        self.assertEqual(session.status, ExamSession.Status.PAUSED)

    def test_resume_gives_back_the_paused_time(self):
        now = timezone.now()
        self.session.status = ExamSession.Status.PAUSED
        self.session.exam_started_at = now - timedelta(minutes=4)
        self.session.paused_at = now - timedelta(minutes=3)  # 1 min elapsed at pause
        self.session.save()

        self.client.force_authenticate(self.admin)
        self.assertEqual(self._resume().status_code, status.HTTP_200_OK)
        self.session.refresh_from_db()

        self.assertAlmostEqual(self.session.paused_total_seconds, 180, delta=2)
        # Nine minutes were left when it was paused; nine minutes are left now.
        self.assertAlmostEqual(self.session.time_remaining_seconds, 9 * 60, delta=2)
        expected_deadline = self.session.exam_started_at + timedelta(
            seconds=EXAM_MINUTES * 60 + self.session.paused_total_seconds
        )
        self.assertEqual(self.session.deadline_at, expected_deadline)

    def test_pauses_accumulate(self):
        now = timezone.now()
        self.session.paused_total_seconds = 120  # an earlier two-minute pause
        self.session.exam_started_at = now - timedelta(minutes=6)
        self.session.save()
        # 6 min since start - 2 min paused = 4 min elapsed -> 6 min remain.
        self.assertAlmostEqual(self.session.time_remaining_seconds, 6 * 60, delta=2)
        self.assertAlmostEqual(self.session.time_elapsed, 4 * 60, delta=2)

    # --- what the examinee can do while paused ----------------------------

    def _pause_as_admin(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self._pause(reason="Stand by").status_code, status.HTTP_200_OK)
        self.client.force_authenticate(self.student)

    def test_examinee_cannot_submit_or_autosave_while_paused(self):
        self._pause_as_admin()

        submit = self.client.post(
            f"/api/sessions/{self.session.id}/submit/",
            {"responses": [], "time_remaining": 100},
            format="json",
        )
        self.assertEqual(submit.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("paused", submit.data["error"].lower())

        autosave = self.client.patch(
            f"/api/sessions/{self.session.id}/responses/",
            {"responses": [{"question_id": self.question.id, "answer_text": "True"}]},
            format="json",
        )
        self.assertEqual(autosave.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("paused", autosave.data["error"].lower())

        self.session.refresh_from_db()
        self.assertEqual(self.session.status, ExamSession.Status.PAUSED)
        self.assertFalse(self.session.responses.exists())

    def test_examinee_can_submit_again_after_resume(self):
        self._pause_as_admin()
        self.client.force_authenticate(self.admin)
        self._resume()
        self.client.force_authenticate(self.student)

        submit = self.client.post(
            f"/api/sessions/{self.session.id}/submit/",
            {
                "responses": [{"question_id": self.question.id, "answer_text": "True"}],
                "time_remaining": 100,
            },
            format="json",
        )
        self.assertEqual(submit.status_code, status.HTTP_200_OK, submit.data)

    def test_examinee_cannot_unpause_by_patching_status(self):
        """DEF-005: ``status`` must not be writable through the session PATCH."""
        self._pause_as_admin()
        for method in (self.client.patch, self.client.put):
            response = method(
                f"/api/sessions/{self.session.id}/", {"status": "in_progress"}, format="json"
            )
            self.assertNotEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
            self.session.refresh_from_db()
            self.assertEqual(self.session.status, ExamSession.Status.PAUSED, method)

    def test_examinee_cannot_pause_or_resume_themselves(self):
        self._pause_as_admin()
        self.assertEqual(self._resume().status_code, status.HTTP_403_FORBIDDEN)

    def test_heartbeat_reports_the_pause(self):
        self._pause_as_admin()
        heartbeat = self.client.post(f"/api/sessions/{self.session.id}/heartbeat/")
        self.assertEqual(heartbeat.status_code, status.HTTP_200_OK)
        self.assertEqual(heartbeat.data["status"], ExamSession.Status.PAUSED)
        self.assertEqual(heartbeat.data["pause_reason"], "Stand by")
        self.assertIsNone(heartbeat.data["deadline_at"])
        self.assertAlmostEqual(heartbeat.data["time_remaining_seconds"], 6 * 60, delta=2)

    def test_session_detail_exposes_pause_state(self):
        self._pause_as_admin()
        detail = self.client.get(f"/api/sessions/{self.session.id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["status"], ExamSession.Status.PAUSED)
        self.assertEqual(detail.data["pause_reason"], "Stand by")
        self.assertIsNotNone(detail.data["paused_at"])

    def test_paused_exam_is_still_the_examinees_active_attempt(self):
        self._pause_as_admin()

        again = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            ExamSession.objects.filter(user=self.student, exam=self.exam).count(), 1
        )

        other_exam = Exam.objects.create(
            title="Other Exam",
            description="",
            duration_minutes=5,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
            monitoring_enabled=False,
        )
        elsewhere = self.client.post("/api/sessions/start/", {"exam": other_exam.id}, format="json")
        self.assertEqual(elsewhere.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("paused", str(elsewhere.data).lower())

    def test_paused_exam_keeps_the_exam_locked_for_editing(self):
        self.assertTrue(exam_has_active_session(self.exam))
        self._pause_as_admin()
        self.assertTrue(exam_has_active_session(self.exam))

    # --- terminate --------------------------------------------------------

    def test_a_paused_session_can_be_terminated(self):
        self._pause_as_admin()
        self.client.force_authenticate(self.admin)

        response = self.client.post(f"/api/sessions/{self.session.id}/terminate/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, ExamSession.Status.TERMINATED)
        # The open pause was closed out rather than left dangling.
        self.assertIsNone(self.session.paused_at)
        self.assertGreaterEqual(self.session.paused_total_seconds, 0)

    # --- reports / lists --------------------------------------------------

    def test_session_list_filters_by_several_statuses(self):
        done = self._session(
            elapsed=timedelta(minutes=1),
            status_=ExamSession.Status.COMPLETED,
            user=User.objects.create_user(
                username="pause_done",
                email="pause_done@test.local",
                password="TestPass123!",
                role=User.Role.STUDENT,
            ),
        )
        self._pause_as_admin()
        self.client.force_authenticate(self.admin)

        live = self.client.get("/api/reports/sessions/", {"status": "in_progress,paused"})
        self.assertEqual(live.status_code, status.HTTP_200_OK)
        ids = {row["id"] for row in live.data["results"]}
        self.assertEqual(ids, {str(self.session.id)})
        self.assertNotIn(str(done.id), ids)

        single = self.client.get("/api/reports/sessions/", {"status": "completed"})
        self.assertEqual({r["id"] for r in single.data["results"]}, {str(done.id)})

    def test_paused_session_counts_as_active_in_the_summary(self):
        self._pause_as_admin()
        self.client.force_authenticate(self.admin)
        summary = self.client.get("/api/reports/summary/")
        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertEqual(summary.data["active_sessions"], 1)

    def test_no_report_pdf_for_a_paused_attempt(self):
        self._pause_as_admin()
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"/api/reports/sessions/{self.session.id}/pdf/")
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    # --- monitoring -------------------------------------------------------

    def test_nothing_is_recorded_against_the_examinee_while_paused(self):
        self._pause_as_admin()
        self.session.refresh_from_db()
        analysis = {
            "metrics": {"exam_behavior_index_pct": 10.0},
            "events": [{"event_type": "no_face", "score_pct": 90, "confidence_pct": 90}],
            "alerts": [{"type": "no_face", "severity": "high", "message": "No face"}],
        }

        result = persist_analysis(self.session, analysis)

        self.assertEqual(result, {"behavior_logs": 0, "alerts": 0})
        self.assertFalse(Alert.objects.filter(session=self.session).exists())
        self.session.refresh_from_db()
        self.assertEqual(self.session.ebi_sample_count, 0)

    def test_pause_notifies_the_session_group(self):
        layer = get_channel_layer()
        channel = async_to_sync(layer.new_channel)()
        async_to_sync(layer.group_add)(f"monitoring.session.{self.session.id}", channel)

        self.client.force_authenticate(self.admin)
        self._pause(reason="Stand by")
        message = async_to_sync(layer.receive)(channel)
        self.assertEqual(message["type"], "session.state")
        self.assertEqual(message["status"], ExamSession.Status.PAUSED)
        self.assertEqual(message["pause_reason"], "Stand by")

        self._resume()
        message = async_to_sync(layer.receive)(channel)
        self.assertEqual(message["status"], ExamSession.Status.IN_PROGRESS)
