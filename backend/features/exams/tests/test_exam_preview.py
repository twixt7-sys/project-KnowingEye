"""Tests for ``GET /api/exams/{id}/preview/`` (the "Preview as student" view).

The preview hands an examiner the same payload a student attempt would get -
pool draws and shuffling applied, answer keys stripped - without creating a
session or writing anything.
"""

from __future__ import annotations

from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.security.service import apply_role_defaults, revoke_action
from features.exams.models import Exam, ExamSection, Question, QuestionPool
from features.exams.services import (
    EDIT_LOCK_PUBLISHED,
    exam_edit_lock,
    unpublish_block_reason,
)
from features.session.models import ExamSession, Response, SessionLog

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


def make_exam(creator, *, exam_status=Exam.Status.DRAFT, **extra) -> Exam:
    now = timezone.now()
    return Exam.objects.create(
        title="Preview Exam",
        description="x",
        duration_minutes=30,
        passing_score=60,
        status=exam_status,
        created_by=creator,
        available_from=now - timedelta(hours=1),
        available_until=now + timedelta(days=7),
        **extra,
    )


def make_question(exam, order, **extra) -> Question:
    fields = {
        "question_text": f"Question {order}",
        "question_type": Question.QuestionType.MULTIPLE_CHOICE,
        "options": ["A", "B", "C"],
        "correct_answer": "A",
        "points": 1,
        "order": order,
    }
    fields.update(extra)
    return Question.objects.create(exam=exam, **fields)


class ExamPreviewAccessTests(APITestCase):
    def setUp(self):
        self.admin = make_user(User.Role.ADMIN, "pv_admin")
        self.faculty = make_user(User.Role.FACULTY, "pv_faculty")
        self.other_faculty = make_user(User.Role.FACULTY, "pv_other_faculty")
        self.program_head = make_user(User.Role.PROGRAM_HEAD, "pv_program_head")
        self.student = make_user(User.Role.STUDENT, "pv_student")
        self.draft = make_exam(self.faculty)
        make_question(self.draft, 1)
        self.active = make_exam(self.faculty, exam_status=Exam.Status.ACTIVE)
        make_question(self.active, 1)

    def _get(self, user, exam):
        self.client.force_authenticate(user=user)
        return self.client.get(f"/api/exams/{exam.id}/preview/")

    def test_admin_can_preview_a_draft(self):
        res = self._get(self.admin, self.draft)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIs(res.data["is_preview"], True)
        self.assertIn("sections", res.data)

    def test_creator_can_preview_own_draft(self):
        self.assertEqual(self._get(self.faculty, self.draft).status_code, status.HTTP_200_OK)

    def test_other_faculty_cannot_preview(self):
        self.assertEqual(
            self._get(self.other_faculty, self.draft).status_code, status.HTTP_403_FORBIDDEN
        )

    def test_program_head_can_preview_someone_elses_draft(self):
        self.assertEqual(self._get(self.program_head, self.draft).status_code, status.HTTP_200_OK)

    def test_works_on_active_and_archived_exams(self):
        self.assertEqual(self._get(self.faculty, self.active).status_code, status.HTTP_200_OK)
        archived = make_exam(self.faculty, exam_status=Exam.Status.ARCHIVED)
        self.assertEqual(self._get(self.faculty, archived).status_code, status.HTTP_200_OK)

    def test_student_cannot_see_a_draft(self):
        self.assertEqual(self._get(self.student, self.draft).status_code, status.HTTP_404_NOT_FOUND)

    def test_student_cannot_preview_an_active_exam(self):
        self.assertEqual(
            self._get(self.student, self.active).status_code, status.HTTP_403_FORBIDDEN
        )

    def test_other_faculty_cannot_preview_an_active_exam(self):
        self.assertEqual(
            self._get(self.other_faculty, self.active).status_code, status.HTTP_403_FORBIDDEN
        )

    def test_denial_explains_who_may_preview(self):
        res = self._get(self.other_faculty, self.draft)
        self.assertIn("preview", res.data["error"]["details"]["detail"])

    def test_creator_loses_preview_when_exams_update_is_revoked(self):
        revoke_action(self.faculty, "exams.update")
        self.assertEqual(self._get(self.faculty, self.draft).status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_is_rejected(self):
        res = self.client.get(f"/api/exams/{self.draft.id}/preview/")
        self.assertIn(res.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))


class ExamPreviewPayloadTests(APITestCase):
    def setUp(self):
        self.faculty = make_user(User.Role.FACULTY, "pp_faculty")
        self.exam = make_exam(self.faculty)

    def _get(self):
        self.client.force_authenticate(user=self.faculty)
        return self.client.get(f"/api/exams/{self.exam.id}/preview/")

    def test_answer_keys_are_stripped(self):
        make_question(
            self.exam,
            1,
            correct_answer="SECRET-KEY-XYZ",
            acceptable_answers=["SECRET-ALT"],
        )
        make_question(
            self.exam,
            2,
            question_type=Question.QuestionType.SHORT_ANSWER,
            options=[],
            correct_answer="SECRET-SHORT",
        )
        res = self._get()
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data["questions"]), 2)
        # Checked against the raw body so a key leaking through any field fails.
        self.assertNotIn(b"SECRET", res.content)

    def test_response_is_not_cacheable(self):
        self.assertEqual(self._get()["Cache-Control"], "no-store")

    def test_includes_sections(self):
        section = ExamSection.objects.create(exam=self.exam, title="Part 1", order=1)
        make_question(self.exam, 1, section=section)
        res = self._get()
        self.assertEqual([s["title"] for s in res.data["sections"]], ["Part 1"])

    def test_empty_exam_returns_no_questions(self):
        res = self._get()
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["questions"], [])

    def test_pool_draw_returns_only_drawn_questions(self):
        pool = QuestionPool.objects.create(exam=self.exam, name="Pool", draw_count=1)
        for order in (1, 2, 3):
            make_question(self.exam, order, pool=pool)
        make_question(self.exam, 4)
        res = self._get()
        questions = res.data["questions"]
        self.assertEqual(len(questions), 2)
        pooled = Question.objects.filter(pool=pool).values_list("id", flat=True)
        self.assertEqual(sum(1 for q in questions if q["id"] in pooled), 1)

    def test_shuffle_questions(self):
        self.exam.shuffle_questions = True
        self.exam.save()
        for order in (1, 2, 3):
            make_question(self.exam, order)
        with mock.patch(
            "features.session.services.random.shuffle", side_effect=lambda x: x.reverse()
        ):
            res = self._get()
        self.assertEqual([q["order"] for q in res.data["questions"]], [3, 2, 1])

    def test_shuffle_options(self):
        self.exam.shuffle_options = True
        self.exam.save()
        make_question(
            self.exam, 1, options=[{"text": t, "image": None} for t in ("A", "B", "C")]
        )
        with mock.patch(
            "features.session.services.random.shuffle", side_effect=lambda x: x.reverse()
        ):
            res = self._get()
        texts = [o["text"] for o in res.data["questions"][0]["options"]]
        self.assertEqual(texts, ["C", "B", "A"])

    def test_true_false_without_options_gets_default_choices(self):
        make_question(
            self.exam,
            1,
            question_type=Question.QuestionType.TRUE_FALSE,
            options=[],
            correct_answer="True",
        )
        res = self._get()
        self.assertEqual(
            res.data["questions"][0]["options"],
            [{"text": "True", "image": None}, {"text": "False", "image": None}],
        )

    def test_preview_writes_nothing(self):
        make_question(self.exam, 1)
        self._get()
        self.assertEqual(ExamSession.objects.count(), 0)
        self.assertEqual(Response.objects.count(), 0)
        self.assertEqual(SessionLog.objects.count(), 0)
        self.exam.refresh_from_db()
        self.assertEqual(self.exam.status, Exam.Status.DRAFT)

    def test_previewing_a_published_exam_does_not_mark_it_in_progress(self):
        self.exam.status = Exam.Status.ACTIVE
        self.exam.available_from = timezone.now() + timedelta(days=1)
        self.exam.available_until = timezone.now() + timedelta(days=2)
        self.exam.save()
        make_question(self.exam, 1)
        self._get()
        # A real attempt makes the exam ongoing, which blocks unpublishing it;
        # a preview must leave it unpublishable so it can still be edited.
        self.assertEqual(exam_edit_lock(self.exam), EDIT_LOCK_PUBLISHED)
        self.assertIsNone(unpublish_block_reason(self.exam))
        self.assertEqual(ExamSession.objects.count(), 0)
