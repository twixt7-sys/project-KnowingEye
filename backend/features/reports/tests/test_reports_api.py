from django.contrib.auth import get_user_model
from django.utils import timezone
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
        self.session = ExamSession.objects.create(
            exam=exam,
            user=self.admin,
            status=ExamSession.Status.IN_PROGRESS,
            exam_started_at=timezone.now(),
        )
        Alert.objects.create(
            session=self.session,
            alert_type="looking_away",
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
        self.assertIn("by_department", response.data)

    def test_session_report_detail(self):
        response = self.client.get(f"/api/reports/sessions/{self.session.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("session", response.data)
        self.assertIn("department_analytics", response.data)

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


class SessionReportPdfTests(APITestCase):
    """GET /api/reports/sessions/<uuid>/pdf/ - examinee printable report."""

    def setUp(self):
        from features.exams.models import Question
        from features.session.models import Response as ExamResponse

        self.teacher = User.objects.create_user(
            username="teacher_pdf",
            email="teacher_pdf@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.student = User.objects.create_user(
            username="student_pdf",
            email="student_pdf@test.local",
            password="TestPass123!",
            role=User.Role.STUDENT,
            first_name="Ada",
            last_name="Lovelace",
        )
        self.other_student = User.objects.create_user(
            username="student_pdf_2",
            email="student_pdf_2@test.local",
            password="TestPass123!",
            role=User.Role.STUDENT,
        )
        self.exam = Exam.objects.create(
            title="Printable Exam",
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.teacher,
        )
        question = Question.objects.create(
            exam=self.exam,
            question_text="2 + 2 = ?",
            question_type=Question.QuestionType.SHORT_ANSWER,
            correct_answer="SECRET_ANSWER_4",
            points=1,
        )
        now = timezone.now()
        self.session = ExamSession.objects.create(
            exam=self.exam,
            user=self.student,
            status=ExamSession.Status.COMPLETED,
            exam_started_at=now - timezone.timedelta(minutes=5),
            submitted_at=now,
            total_score=1,
            percentage_score=100,
            passed=True,
            question_order=[question.id],
        )
        ExamResponse.objects.create(
            session=self.session,
            question=question,
            answer_text="4",
            is_correct=True,
            points_awarded=1,
        )
        Alert.objects.create(
            session=self.session,
            alert_type="looking_away",
            severity="low",
            message="Looked away",
        )

    def _get(self, user, session_id=None):
        self.client.force_authenticate(user=user)
        return self.client.get(f"/api/reports/sessions/{session_id or self.session.id}/pdf/")

    def test_student_downloads_own_report(self):
        response = self._get(self.student)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("attachment;", response["Content-Disposition"])
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_student_cannot_download_other_students_report(self):
        response = self._get(self.other_student)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_in_progress_session_is_rejected(self):
        self.session.status = ExamSession.Status.IN_PROGRESS
        self.session.save(update_fields=["status"])
        response = self._get(self.student)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_correct_answers_follow_release_policy(self):
        from unittest import mock

        with mock.patch("features.reports.pdf.build_session_report_pdf", return_value=b"%PDF-") as build:
            self._get(self.student)
            self.assertFalse(build.call_args.kwargs["show_correct_answers"])

            self.exam.show_correct_answers = Exam.ShowCorrectAnswers.IMMEDIATELY
            self.exam.save(update_fields=["show_correct_answers"])
            self._get(self.student)
            self.assertTrue(build.call_args.kwargs["show_correct_answers"])

    def test_staff_can_download_any_report(self):
        response = self._get(self.teacher)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_pending_review_hides_scores_from_student(self):
        from unittest import mock

        self.session.status = ExamSession.Status.PENDING_REVIEW
        self.session.save(update_fields=["status"])
        with mock.patch("features.reports.pdf.build_session_report_pdf", return_value=b"%PDF-") as build:
            self._get(self.student)
            self.assertTrue(build.call_args.kwargs["hide_scores"])
            self._get(self.teacher)
            self.assertFalse(build.call_args.kwargs["hide_scores"])
