"""RBAC/PBAC role-matrix tests for the exams API.

Covers the three tiers as wired in features.exams.{views,services,repositories}:
role default module visibility, the exams.create action permission, and the
ownership + exams.update prerequisite for editing/deleting an exam.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from core.security.service import apply_role_defaults
from features.exams.models import Department, Exam

User = get_user_model()


def make_user(role, username):
    user = User.objects.create_user(
        username=username,
        email=f"{username}@test.local",
        password="TestPass123!",
        role=role,
    )
    apply_role_defaults(user)
    return user


class ExamCreatePermissionMatrixTests(APITestCase):
    def setUp(self):
        self.department = Department.objects.create(name="Test Dept", abbreviation="TST")
        self.payload = {
            "title": "Matrix Exam",
            "description": "x",
            "duration_minutes": 30,
            "passing_score": 60,
            "department_id": self.department.id,
        }

    def _post(self, user):
        self.client.force_authenticate(user=user)
        return self.client.post("/api/exams/", self.payload, format="json")

    def test_admin_can_create(self):
        admin = make_user(User.Role.ADMIN, "rbac_admin")
        self.assertEqual(self._post(admin).status_code, status.HTTP_201_CREATED)

    def test_faculty_can_create(self):
        faculty = make_user(User.Role.FACULTY, "rbac_faculty")
        self.assertEqual(self._post(faculty).status_code, status.HTTP_201_CREATED)

    def test_proctor_cannot_create(self):
        sa = make_user(User.Role.PROCTOR, "rbac_sa")
        self.assertEqual(self._post(sa).status_code, status.HTTP_403_FORBIDDEN)

    def test_student_cannot_create(self):
        student = make_user(User.Role.STUDENT, "rbac_student")
        self.assertEqual(self._post(student).status_code, status.HTTP_403_FORBIDDEN)


class ExamOwnershipMatrixTests(APITestCase):
    def setUp(self):
        self.owner = make_user(User.Role.FACULTY, "rbac_owner")
        self.other_faculty = make_user(User.Role.FACULTY, "rbac_other_faculty")
        self.admin = make_user(User.Role.ADMIN, "rbac_owner_admin")
        self.exam = Exam.objects.create(
            title="Owned Exam",
            description="x",
            duration_minutes=30,
            passing_score=60,
            status=Exam.Status.DRAFT,
            created_by=self.owner,
        )

    def test_owner_can_update_own_exam(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(
            f"/api/exams/{self.exam.id}/", {"title": "Renamed"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_other_faculty_cannot_update_someone_elses_exam(self):
        self.client.force_authenticate(user=self.other_faculty)
        response = self.client.patch(
            f"/api/exams/{self.exam.id}/", {"title": "Hijacked"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_update_any_exam(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/exams/{self.exam.id}/", {"title": "Admin edit"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_owner_can_delete_own_draft_exam(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.delete(f"/api/exams/{self.exam.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_other_faculty_cannot_delete_someone_elses_exam(self):
        self.client.force_authenticate(user=self.other_faculty)
        response = self.client.delete(f"/api/exams/{self.exam.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Exam.objects.filter(id=self.exam.id).exists())
