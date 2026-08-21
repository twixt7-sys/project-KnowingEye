"""Tests for the proctor-locator seat_label field (Directive Area 04).

A flagged examinee must be findable physically, not just as a list row -
these cover the roster-CSV import path and the reports serialization that
surfaces it on the live monitoring dashboard.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from core.security.service import apply_role_defaults
from features.exams import services
from features.exams.models import Department, Exam, ExamAssignment
from features.reports.views import _seat_labels_for

User = get_user_model()


def make_user(role, username, email=None):
    user = User.objects.create_user(
        username=username, email=email or f"{username}@test.local",
        password="TestPass123!", role=role,
    )
    apply_role_defaults(user)
    return user


class SeatLabelImportTests(APITestCase):
    def setUp(self):
        self.faculty = make_user(User.Role.FACULTY, "seat_faculty")
        self.student = make_user(User.Role.STUDENT, "seat_student", email="seat.student@test.local")
        department = Department.objects.create(name="Seat Dept", abbreviation="SEA")
        self.exam = Exam.objects.create(
            title="Seat exam", department=department, created_by=self.faculty,
            status=Exam.Status.DRAFT,
        )

    def test_csv_import_sets_seat_label(self):
        csv_text = "email,extra_time_minutes,seat_label\nseat.student@test.local,0,Room 3 - Seat 12\n"
        result = services.import_assignments(self.exam, self.faculty, csv_text=csv_text)
        self.assertEqual(result["created"], 1)
        assignment = ExamAssignment.objects.get(exam=self.exam, user=self.student)
        self.assertEqual(assignment.seat_label, "Room 3 - Seat 12")

    def test_seat_labels_for_lookup_excludes_blank(self):
        ExamAssignment.objects.create(exam=self.exam, user=self.student, seat_label="")
        sessions = [type("S", (), {"exam_id": self.exam.id, "user_id": self.student.id})()]
        self.assertEqual(_seat_labels_for(sessions), {})

        ExamAssignment.objects.filter(exam=self.exam, user=self.student).update(seat_label="A-1")
        self.assertEqual(
            _seat_labels_for(sessions), {(self.exam.id, self.student.id): "A-1"}
        )
