"""Exam-integrity report (B3) and per-school-year metrics (B2)."""

import csv
import io
from datetime import datetime, timezone as dt_timezone

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from features.behavior.models import Alert
from features.exams.models import Department, Exam, ExamAssignment
from features.reports.school_year import (
    school_year_label,
    school_year_of,
    school_year_period,
)
from features.session.models import ExamSession

User = get_user_model()


def at(year, month, day):
    return datetime(year, month, day, 12, 0, tzinfo=dt_timezone.utc)


class SchoolYearHelperTests(SimpleTestCase):
    def test_year_rolls_over_on_the_start_month(self):
        self.assertEqual(school_year_of(at(2026, 5, 31), 6), 2025)
        self.assertEqual(school_year_of(at(2026, 6, 1), 6), 2026)
        self.assertEqual(school_year_of(at(2025, 12, 31), 6), 2025)

    def test_january_start_is_calendar_year(self):
        self.assertEqual(school_year_of(at(2026, 1, 1), 1), 2026)
        self.assertEqual(school_year_label(2026, 1), "2026")

    def test_label_and_period(self):
        self.assertEqual(school_year_label(2025, 6), "2025-2026")
        first, last = school_year_period(2025, 6)
        self.assertEqual((first.isoformat(), last.isoformat()), ("2025-06-01", "2026-05-31"))


class _ReportFixture(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_int",
            email="admin_int@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.dept = Department.objects.create(name="Computing", abbreviation="CS")
        self.exam_a = self._exam("Exam A", self.dept)
        self.exam_b = self._exam("Exam B", None)
        self.client.force_authenticate(user=self.admin)

    def _exam(self, title, dept):
        return Exam.objects.create(
            title=title,
            description="",
            duration_minutes=10,
            passing_score=50,
            status=Exam.Status.ACTIVE,
            created_by=self.admin,
            department=dept,
        )

    def _student(self, name):
        return User.objects.create_user(
            username=name,
            email=f"{name}@test.local",
            password="TestPass123!",
            role=User.Role.STUDENT,
        )

    def _session(self, exam, user, *, state=ExamSession.Status.COMPLETED, submitted=None,
                 score=None, passed=None, ebi=None):
        return ExamSession.objects.create(
            exam=exam,
            user=user,
            status=state,
            exam_started_at=timezone.now(),
            submitted_at=submitted,
            percentage_score=score,
            passed=passed,
            ebi_average=ebi,
        )


class IntegrityReportTests(_ReportFixture):
    def setUp(self):
        super().setUp()
        self.ann = self._student("ann")
        self.bob = self._student("bob")
        self.cat = self._student("cat")

        # Exam A: ann flagged twice (two sessions, three alerts) -> one candidate;
        # bob terminated without alerts; cat clean.
        s1 = self._session(self.exam_a, self.ann)
        s2 = self._session(self.exam_a, self.ann)
        Alert.objects.create(session=s1, alert_type="looking_away", severity="high", message="a")
        Alert.objects.create(session=s1, alert_type="no_face", severity="low", message="b", resolved=True)
        Alert.objects.create(session=s2, alert_type="looking_away", severity="medium", message="c")
        self.bob_session = self._session(
            self.exam_a, self.bob, state=ExamSession.Status.TERMINATED
        )
        self._session(self.exam_a, self.cat)
        # Exam B: cat flagged.
        s3 = self._session(self.exam_b, self.cat)
        Alert.objects.create(session=s3, alert_type="multiple_faces", severity="high", message="d")
        # A setup-only session never counts.
        self._session(self.exam_b, self.bob, state=ExamSession.Status.SETUP)

    def test_totals_count_candidates_once(self):
        r = self.client.get("/api/reports/integrity/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        t = r.data["totals"]
        self.assertEqual(t["sessions"], 5)
        self.assertEqual(t["candidates"], 3)
        self.assertEqual(t["flagged_sessions"], 4)
        self.assertEqual(t["flagged_candidates"], 3)
        self.assertEqual(t["terminated_sessions"], 1)
        self.assertEqual(t["alert_count"], 4)
        self.assertEqual(t["unresolved_alerts"], 3)
        self.assertEqual(t["alerts_by_type"]["looking_away"], 2)
        self.assertEqual(t["alerts_by_severity"]["high"], 2)

    def test_by_exam_breakdown(self):
        r = self.client.get("/api/reports/integrity/")
        rows = {e["exam_title"]: e for e in r.data["by_exam"]}
        a = rows["Exam A"]
        self.assertEqual(a["candidates"], 3)
        self.assertEqual(a["flagged_candidates"], 2)
        self.assertEqual(a["flagged_sessions"], 3)
        self.assertEqual(a["terminated_sessions"], 1)
        self.assertEqual(a["alert_count"], 3)
        self.assertEqual(a["alerts_by_type"], {"looking_away": 2, "no_face": 1})
        self.assertEqual(a["department_abbreviation"], "CS")
        b = rows["Exam B"]
        self.assertEqual(b["flagged_candidates"], 1)
        self.assertEqual(b["alerts_by_type"], {"multiple_faces": 1})
        # Most flagged exam first.
        self.assertEqual(r.data["by_exam"][0]["exam_title"], "Exam A")

    def test_summary_tiles_agree_with_integrity_totals(self):
        summary = self.client.get("/api/reports/summary/").data
        totals = self.client.get("/api/reports/integrity/").data["totals"]
        self.assertEqual(summary["flagged_candidates"], totals["flagged_candidates"])
        self.assertEqual(summary["flagged_sessions"], totals["flagged_sessions"])

    def test_exam_filter(self):
        r = self.client.get(f"/api/reports/integrity/?exam={self.exam_b.id}")
        self.assertEqual(r.data["totals"]["flagged_candidates"], 1)
        self.assertEqual(len(r.data["by_exam"]), 1)

    def test_bad_filter_is_rejected(self):
        r = self.client.get("/api/reports/integrity/?exam=abc")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_drilldown_lists_flagged_sessions_with_alerts(self):
        ExamAssignment.objects.create(exam=self.exam_a, user=self.bob, seat_label="R2-S4")
        r = self.client.get(f"/api/reports/integrity/sessions/?exam={self.exam_a.id}")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["count"], 3)
        self.assertFalse(r.data["truncated"])
        by_user = {}
        for row in r.data["results"]:
            by_user.setdefault(row["username"], []).append(row)
        self.assertEqual(sorted(by_user), ["ann", "bob"])
        self.assertEqual(sum(row["alert_count"] for row in by_user["ann"]), 3)
        bob = by_user["bob"][0]
        self.assertTrue(bob["terminated"])
        self.assertEqual(bob["alerts"], [])
        self.assertEqual(bob["seat_label"], "R2-S4")

    def test_session_list_flagged_filter(self):
        r = self.client.get("/api/reports/sessions/?flagged=true")
        self.assertEqual(r.data["count"], 4)

    def test_csv_export_has_row_per_alert_plus_terminated(self):
        r = self.client.get("/api/reports/integrity/export/csv/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r["Content-Type"], "text/csv")
        rows = list(csv.DictReader(io.StringIO(r.content.decode())))
        self.assertEqual(len(rows), 5)  # 4 alerts + bob's terminated session
        bob_rows = [x for x in rows if x["username"] == "bob"]
        self.assertEqual(len(bob_rows), 1)
        self.assertEqual(bob_rows[0]["alert_type"], "")
        self.assertEqual(bob_rows[0]["session_status"], "terminated")

    def test_pdf_export(self):
        r = self.client.get("/api/reports/integrity/export/pdf/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r["Content-Type"], "application/pdf")
        self.assertTrue(r.content.startswith(b"%PDF"))

    def test_endpoints_are_gated_to_report_viewers(self):
        self.client.force_authenticate(user=self._student("dan"))
        for path in (
            "/api/reports/integrity/",
            "/api/reports/integrity/sessions/",
            "/api/reports/integrity/export/csv/",
            "/api/reports/integrity/export/pdf/",
            "/api/reports/school-years/",
            "/api/reports/school-years/2025/",
        ):
            self.assertEqual(
                self.client.get(path).status_code, status.HTTP_403_FORBIDDEN, path
            )


@override_settings(SCHOOL_YEAR_START_MONTH=6)
class SchoolYearReportTests(_ReportFixture):
    def setUp(self):
        super().setUp()
        self.ann = self._student("ann")
        self.bob = self._student("bob")
        # SY 2024-2025: one pass, one fail; ann flagged.
        s = self._session(self.exam_a, self.ann, submitted=at(2025, 5, 31),
                          score=80, passed=True, ebi=90)
        Alert.objects.create(session=s, alert_type="no_face", message="x")
        self._session(self.exam_a, self.bob, submitted=at(2025, 2, 1),
                      score=30, passed=False, ebi=70)
        # SY 2025-2026: two passes, a terminated session (flagged, not completed).
        self._session(self.exam_a, self.ann, submitted=at(2025, 6, 1),
                      score=90, passed=True, ebi=100)
        self._session(self.exam_b, self.bob, submitted=at(2026, 4, 1),
                      score=70, passed=True, ebi=80)
        self._session(self.exam_b, self.ann, state=ExamSession.Status.TERMINATED,
                      submitted=at(2026, 4, 2))
        # Not in any year: still running, never submitted.
        self._session(self.exam_a, self.bob, state=ExamSession.Status.IN_PROGRESS)
        # A year with only a terminated session has no pass data -> omitted.
        self._session(self.exam_a, self.bob, state=ExamSession.Status.TERMINATED,
                      submitted=at(2023, 9, 1))

    def test_years_with_pass_data_oldest_first(self):
        r = self.client.get("/api/reports/school-years/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["start_month"], 6)
        self.assertEqual([y["school_year"] for y in r.data["years"]], ["2024-2025", "2025-2026"])

    def test_metrics_per_year(self):
        years = {y["start_year"]: y for y in self.client.get("/api/reports/school-years/").data["years"]}
        y24, y25 = years[2024], years[2025]
        self.assertEqual(y24["completed_sessions"], 2)
        self.assertEqual(y24["pass_rate"], 50.0)
        self.assertEqual(y24["average_score"], 55.0)
        self.assertEqual(y24["average_ebi"], 80.0)
        self.assertEqual(y24["flagged_sessions"], 1)
        self.assertEqual(y24["flagged_candidates"], 1)
        self.assertEqual(y24["flagged_rate"], 50.0)
        self.assertEqual(y24["period_start"], "2024-06-01")
        self.assertEqual(y24["period_end"], "2025-05-31")

        self.assertEqual(y25["completed_sessions"], 2)
        self.assertEqual(y25["sessions"], 3)  # includes the terminated one
        self.assertEqual(y25["pass_rate"], 100.0)
        self.assertEqual(y25["average_score"], 80.0)
        self.assertEqual(y25["average_ebi"], 90.0)
        self.assertEqual(y25["flagged_sessions"], 1)
        self.assertEqual(y25["flagged_rate"], 33.3)
        self.assertEqual(y25["examinees"], 2)
        self.assertEqual(y25["exams"], 2)

    @override_settings(SCHOOL_YEAR_START_MONTH=1)
    def test_january_start_groups_by_calendar_year(self):
        years = [y["school_year"] for y in self.client.get("/api/reports/school-years/").data["years"]]
        self.assertEqual(years, ["2025", "2026"])

    def test_department_filter(self):
        r = self.client.get(f"/api/reports/school-years/?department={self.dept.id}")
        # Only exam A (CS) sessions: 2024 has two, 2025 one completed.
        years = {y["start_year"]: y for y in r.data["years"]}
        self.assertEqual(years[2024]["completed_sessions"], 2)
        self.assertEqual(years[2025]["completed_sessions"], 1)

    def test_year_detail_breaks_down_by_exam_and_department(self):
        r = self.client.get("/api/reports/school-years/2025/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["school_year"], "2025-2026")
        exams = {e["exam_title"]: e for e in r.data["by_exam"]}
        self.assertEqual(exams["Exam A"]["pass_rate"], 100.0)
        self.assertEqual(exams["Exam B"]["completed_sessions"], 1)
        self.assertEqual(exams["Exam B"]["flagged_sessions"], 1)
        depts = {d["department_name"]: d for d in r.data["by_department"]}
        self.assertEqual(set(depts), {"Computing", "Unassigned"})

    def test_integrity_report_can_be_narrowed_to_a_school_year(self):
        r = self.client.get("/api/reports/integrity/?school_year=2024")
        self.assertEqual(r.data["totals"]["sessions"], 2)
        self.assertEqual(r.data["totals"]["flagged_candidates"], 1)
