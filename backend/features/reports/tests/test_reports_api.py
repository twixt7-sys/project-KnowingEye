from datetime import timedelta

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


class StudentSessionListTests(APITestCase):
    """The examinee dashboard's "Completed" table: sort, filter, search, page."""

    def setUp(self):
        self.student = User.objects.create_user(
            username="stu_list",
            email="stu_list@test.local",
            password="TestPass123!",
            role=User.Role.STUDENT,
        )
        self.other = User.objects.create_user(
            username="stu_other",
            email="stu_other@test.local",
            password="TestPass123!",
            role=User.Role.STUDENT,
        )
        creator = User.objects.create_user(
            username="creator_list",
            email="creator_list@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.exams = {
            title: Exam.objects.create(
                title=title,
                description="",
                duration_minutes=10,
                passing_score=50,
                status=Exam.Status.ACTIVE,
                created_by=creator,
            )
            for title in ("Algebra", "Biology", "Chemistry", "Drawing")
        }
        now = timezone.now()
        # (exam, days ago, score, passed) - Drawing is graded-pending (no score yet).
        rows = [
            ("Algebra", 4, 90, True),
            ("Biology", 3, 40, False),
            ("Chemistry", 2, 90, True),
            ("Drawing", 1, None, None),
        ]
        self.sessions = {}
        for title, days_ago, score, passed in rows:
            session = ExamSession.objects.create(
                exam=self.exams[title],
                user=self.student,
                status=ExamSession.Status.COMPLETED,
                percentage_score=score,
                passed=passed,
                submitted_at=now - timedelta(days=days_ago),
            )
            ExamSession.objects.filter(pk=session.pk).update(
                started_at=now - timedelta(days=days_ago, hours=1)
            )
            self.sessions[title] = session
        # Another examinee's attempt must never leak into this student's list.
        ExamSession.objects.create(
            exam=self.exams["Algebra"],
            user=self.other,
            status=ExamSession.Status.COMPLETED,
            percentage_score=100,
            passed=True,
        )
        self.client.force_authenticate(user=self.student)

    def _titles(self, query=""):
        response = self.client.get(f"/api/reports/sessions/?status=completed{query}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return [row["exam_title"] for row in response.data["results"]]

    def test_defaults_to_newest_first_and_is_scoped_to_the_student(self):
        self.assertEqual(self._titles(), ["Drawing", "Chemistry", "Biology", "Algebra"])

    def test_orders_by_started_at_in_both_directions(self):
        self.assertEqual(
            self._titles("&ordering=started_at"),
            ["Algebra", "Biology", "Chemistry", "Drawing"],
        )
        self.assertEqual(
            self._titles("&ordering=-started_at"),
            ["Drawing", "Chemistry", "Biology", "Algebra"],
        )

    def test_orders_by_exam_title(self):
        self.assertEqual(
            self._titles("&ordering=exam_title"),
            ["Algebra", "Biology", "Chemistry", "Drawing"],
        )
        self.assertEqual(
            self._titles("&ordering=-exam_title"),
            ["Drawing", "Chemistry", "Biology", "Algebra"],
        )

    def test_orders_by_score_with_unscored_rows_last_and_ties_newest_first(self):
        # Algebra and Chemistry tie on 90; Chemistry is newer so it leads.
        self.assertEqual(
            self._titles("&ordering=-percentage_score"),
            ["Chemistry", "Algebra", "Biology", "Drawing"],
        )
        # Ascending still pushes the unscored row to the end, not the front.
        self.assertEqual(
            self._titles("&ordering=percentage_score"),
            ["Biology", "Chemistry", "Algebra", "Drawing"],
        )

    def test_unknown_ordering_falls_back_to_newest_first(self):
        self.assertEqual(
            self._titles("&ordering=user__password"),
            ["Drawing", "Chemistry", "Biology", "Algebra"],
        )

    def test_passed_filter(self):
        self.assertEqual(self._titles("&passed=true"), ["Chemistry", "Algebra"])
        # "Not passed" means a recorded fail, not a still-pending result.
        self.assertEqual(self._titles("&passed=false"), ["Biology"])
        self.assertEqual(
            self._titles("&passed=maybe"), ["Drawing", "Chemistry", "Biology", "Algebra"]
        )

    def test_filters_combine_with_search_and_pagination(self):
        self.assertEqual(self._titles("&passed=true&search=alg"), ["Algebra"])

        response = self.client.get(
            "/api/reports/sessions/?status=completed&ordering=exam_title&page=2&page_size=3"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 4)
        self.assertEqual([r["exam_title"] for r in response.data["results"]], ["Drawing"])
