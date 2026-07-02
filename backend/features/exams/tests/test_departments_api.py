from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from features.exams.models import Department, Exam
from shared.tests.helpers import validation_details

User = get_user_model()


class DepartmentsAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_dept",
            email="admin_dept@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.department = Department.objects.create(
            name="Institute of Information Technology",
            abbreviation="IIT",
            sort_order=1,
        )
        self.client.force_authenticate(user=self.admin)

    def test_list_departments(self):
        response = self.client.get("/api/departments/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data.get("count", len(response.data)), 1)

    def test_create_department(self):
        response = self.client.post(
            "/api/departments/",
            {
                "name": "College of Engineering",
                "abbreviation": "coe",
                "sort_order": 2,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["abbreviation"], "COE")

    def test_create_exam_auto_generates_code(self):
        response = self.client.post(
            "/api/exams/",
            {
                "title": "Entrance Exam 2026",
                "description": "Auto code test",
                "duration_minutes": 60,
                "passing_score": 50,
                "department_id": self.department.id,
                "status": "draft",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertRegex(response.data["exam_code"], r"^IIT-\d{4}-A$")

        second = self.client.post(
            "/api/exams/",
            {
                "title": "Entrance Exam 2026 B",
                "description": "Second exam",
                "duration_minutes": 60,
                "passing_score": 50,
                "department_id": self.department.id,
                "status": "draft",
            },
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertRegex(second.data["exam_code"], r"^IIT-\d{4}-B$")

    def test_create_exam_requires_department(self):
        response = self.client.post(
            "/api/exams/",
            {
                "title": "Missing department",
                "duration_minutes": 60,
                "passing_score": 50,
                "status": "draft",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("department_id", validation_details(response))

    def test_cannot_change_department_after_creation(self):
        exam = Exam.objects.create(
            title="Locked department",
            duration_minutes=30,
            passing_score=60,
            status=Exam.Status.DRAFT,
            created_by=self.admin,
            department=self.department,
        )
        other = Department.objects.create(
            name="College of Business Administration",
            abbreviation="CBA",
        )
        response = self.client.patch(
            f"/api/exams/{exam.id}/",
            {"department_id": other.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
