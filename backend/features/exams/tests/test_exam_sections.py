"""Tests for ExamSection: maker-side assignment + examinee-side navigation payload."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from features.exams.models import Department, Exam, ExamSection, Question

User = get_user_model()


class ExamSectionAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_sections",
            email="admin_sections@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.department = Department.objects.create(name="Sections Dept", abbreviation="SEC")
        self.exam = Exam.objects.create(
            title="Sectioned Exam",
            description="",
            duration_minutes=30,
            passing_score=60,
            status=Exam.Status.DRAFT,
            department=self.department,
            created_by=self.admin,
        )
        self.client.force_authenticate(user=self.admin)

    def test_create_section(self):
        response = self.client.post(
            f"/api/exams/{self.exam.id}/sections/",
            {"title": "Part A", "instructions": "Answer all."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Part A")
        self.assertTrue(ExamSection.objects.filter(exam=self.exam, title="Part A").exists())

    def test_update_section(self):
        section = ExamSection.objects.create(exam=self.exam, title="Old title", order=1)
        response = self.client.patch(
            f"/api/exams/{self.exam.id}/sections/{section.id}/",
            {"title": "New title"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        section.refresh_from_db()
        self.assertEqual(section.title, "New title")

    def test_delete_section_unsections_its_questions(self):
        section = ExamSection.objects.create(exam=self.exam, title="Part A", order=1)
        question = Question.objects.create(
            exam=self.exam,
            section=section,
            question_text="Q1",
            question_type=Question.QuestionType.TRUE_FALSE,
            options=["True", "False"],
            correct_answer="True",
            points=1,
            order=1,
        )
        response = self.client.delete(f"/api/exams/{self.exam.id}/sections/{section.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ExamSection.objects.filter(pk=section.pk).exists())
        question.refresh_from_db()
        self.assertIsNone(question.section)

    def test_question_create_assigns_section(self):
        section = ExamSection.objects.create(exam=self.exam, title="Part A", order=1)
        response = self.client.post(
            f"/api/exams/{self.exam.id}/questions/",
            {
                "question_text": "Assigned question",
                "question_type": "true_false",
                "options": [],
                "correct_answer": "true",
                "points": 1,
                "section": section.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["section"], section.id)

    def test_other_maker_cannot_modify_section(self):
        other = User.objects.create_user(
            username="other_faculty",
            email="other_faculty@test.local",
            password="TestPass123!",
            role=User.Role.FACULTY,
        )
        section = ExamSection.objects.create(exam=self.exam, title="Part A", order=1)
        self.client.force_authenticate(user=other)
        response = self.client.patch(
            f"/api/exams/{self.exam.id}/sections/{section.id}/",
            {"title": "Hijacked"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ExamTakeSectionsPayloadTests(APITestCase):
    """Confirms the examinee-safe take payload exposes sections for navigation."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_take_sections",
            email="admin_take_sections@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.student = User.objects.create_user(
            username="student_take_sections",
            email="student_take_sections@test.local",
            password="TestPass123!",
            role=User.Role.STUDENT,
        )
        self.exam = Exam.objects.create(
            title="Take Sections Exam",
            description="",
            duration_minutes=30,
            passing_score=60,
            status=Exam.Status.ACTIVE,
            monitoring_enabled=False,
            created_by=self.admin,
        )
        self.section_a = ExamSection.objects.create(exam=self.exam, title="Part A", order=1)
        self.section_b = ExamSection.objects.create(exam=self.exam, title="Part B", order=2)
        Question.objects.create(
            exam=self.exam,
            section=self.section_a,
            question_text="In part A",
            question_type=Question.QuestionType.TRUE_FALSE,
            options=["True", "False"],
            correct_answer="True",
            points=1,
            order=1,
        )
        Question.objects.create(
            exam=self.exam,
            section=self.section_b,
            question_text="In part B",
            question_type=Question.QuestionType.TRUE_FALSE,
            options=["True", "False"],
            correct_answer="False",
            points=1,
            order=2,
        )
        Question.objects.create(
            exam=self.exam,
            question_text="Unsectioned",
            question_type=Question.QuestionType.TRUE_FALSE,
            options=["True", "False"],
            correct_answer="True",
            points=1,
            order=3,
        )

    def test_session_start_exposes_sections_and_question_section(self):
        self.client.force_authenticate(user=self.student)
        start = self.client.post("/api/sessions/start/", {"exam": self.exam.id}, format="json")
        self.assertEqual(start.status_code, status.HTTP_201_CREATED)
        session_id = start.data["session"]["id"]

        detail = self.client.get(f"/api/sessions/{session_id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        exam_data = detail.data["exam"]

        section_titles = {s["title"] for s in exam_data["sections"]}
        self.assertEqual(section_titles, {"Part A", "Part B"})

        by_text = {q["question_text"]: q for q in exam_data["questions"]}
        self.assertEqual(by_text["In part A"]["section"], self.section_a.id)
        self.assertEqual(by_text["In part B"]["section"], self.section_b.id)
        self.assertIsNone(by_text["Unsectioned"]["section"])
        # Examinee-safe: no answer key leaks alongside section info.
        self.assertNotIn("correct_answer", by_text["In part A"])
