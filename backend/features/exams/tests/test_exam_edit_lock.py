"""Exam edit lock: published and ongoing exams (Bug Reports 4 and 5).

Rules under test:

* Only a draft is editable. A published exam's questions, content and
  settings are locked until it is unpublished (Bug 5).
* Once an exam is ongoing - its scheduled start time has arrived (server
  time) or an examinee is mid-attempt - only its candidates may change, and
  it can no longer be unpublished (Bug 4).
* Candidate edits keep working in every state.

Every write path is exercised against every exam state, so a new endpoint
that forgets the guard, or a state the guard misreads, fails here.
"""

from __future__ import annotations

import os
import shutil
import tempfile
from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.forms.models import model_to_dict
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.security.service import apply_role_defaults
from features.exams import services
from features.exams.models import (
    Department,
    Exam,
    ExamAssignment,
    ExamSection,
    Question,
    QuestionAttachment,
    QuestionPool,
)
from features.session.models import ExamSession

User = get_user_model()

ONGOING_TEXT = "Exam in progress: only candidates can be edited"
PUBLISHED_TEXT = "Unpublish this exam to edit it"
ARCHIVED_TEXT = "archived"

# Exam states. ``lock`` is the expected ``edit_lock`` code (None = editable),
# ``can_unpublish`` whether the unpublish action is allowed.
STATES = {
    # A draft whose window is still ahead.
    "draft": dict(status="draft", window="future", session=None, lock=None, can_unpublish=False),
    # Unpublished, so no examinee can reach it: still editable even though
    # its scheduled start has passed (the author may be fixing the dates).
    "draft_past_start": dict(
        status="draft", window="open", session=None, lock=None, can_unpublish=False
    ),
    # Published, scheduled start not reached yet.
    "published_not_started": dict(
        status="active", window="future", session=None, lock="published", can_unpublish=True
    ),
    # Scheduled start reached, nobody has begun yet.
    "ongoing_scheduled": dict(
        status="active", window="open", session=None, lock="ongoing", can_unpublish=False
    ),
    # An examinee is mid-attempt inside the window.
    "ongoing_in_progress": dict(
        status="active", window="open", session="in_progress", lock="ongoing", can_unpublish=False
    ),
    # Window closed, but an examinee who started in time is still finishing.
    "ongoing_after_close": dict(
        status="active", window="ended", session="in_progress", lock="ongoing", can_unpublish=False
    ),
    # A paused attempt still counts: the examinee resumes where they left off.
    "ongoing_paused": dict(
        status="active", window="open", session="paused", lock="ongoing", can_unpublish=False
    ),
    # Window closed without anyone taking it: may be unpublished to reschedule.
    "ended": dict(
        status="active", window="ended", session=None, lock="published", can_unpublish=True
    ),
    # Window closed after real attempts: responses point at the questions.
    "ended_attempted": dict(
        status="active", window="ended", session="completed", lock="published", can_unpublish=False
    ),
    "archived": dict(
        status="archived", window="future", session=None, lock="archived", can_unpublish=False
    ),
}

LOCK_TEXT = {"ongoing": ONGOING_TEXT, "published": PUBLISHED_TEXT, "archived": ARCHIVED_TEXT}


def make_user(role, username):
    # No password: hashing one per user dominates the runtime of this matrix.
    user = User.objects.create_user(
        username=username,
        email=f"{username}@test.local",
        password=None,
        role=role,
    )
    apply_role_defaults(user)
    return user


def png(name="pic.png"):
    return SimpleUploadedFile(name, b"\x89PNG\r\n\x1a\n", content_type="image/png")


class EditLockTestBase(APITestCase):
    def setUp(self):
        self.admin = make_user(User.Role.ADMIN, "lock_admin")
        self.examinee = make_user(User.Role.STUDENT, "lock_examinee")
        self.exam_count = 0
        self.candidate = make_user(User.Role.STUDENT, "lock_candidate")
        self.department = Department.objects.create(name="Lock Dept", abbreviation="LCK")

        media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media_root, ignore_errors=True)
        media = override_settings(MEDIA_ROOT=media_root)
        media.enable()
        self.addCleanup(media.disable)
        self.media_root = media_root

        self.client.force_authenticate(user=self.admin)

    def make_exam(self, state: str, **overrides) -> Exam:
        """An exam in ``state`` with two questions, a section, a pool and an attachment."""
        spec = STATES[state]
        now = timezone.now()
        window = {
            "future": (now + timedelta(days=1), now + timedelta(days=2)),
            "open": (now - timedelta(hours=1), now + timedelta(days=1)),
            "ended": (now - timedelta(days=2), now - timedelta(days=1)),
        }[spec["window"]]
        fields = dict(
            title=f"Exam {state}",
            department=self.department,
            created_by=self.admin,
            status=spec["status"],
            available_from=window[0],
            available_until=window[1],
        )
        fields.update(overrides)
        exam = Exam.objects.create(**fields)
        exam.departments.set([self.department])
        self.section = ExamSection.objects.create(exam=exam, title="Part A", order=1)
        self.pool = QuestionPool.objects.create(exam=exam, name="Pool", order=1)
        self.q1 = Question.objects.create(
            exam=exam,
            question_text="2 + 2?",
            question_type=Question.QuestionType.MULTIPLE_CHOICE,
            options=[{"text": "3", "image": None}, {"text": "4", "image": None}],
            correct_answer="4",
            points=1,
            order=1,
            section=self.section,
        )
        self.q2 = Question.objects.create(
            exam=exam,
            question_text="The sky is blue.",
            question_type=Question.QuestionType.TRUE_FALSE,
            correct_answer="true",
            points=1,
            order=2,
        )
        self.attachment = QuestionAttachment.objects.create(
            question=self.q1, file=png("existing.png"), kind="image", order=0
        )
        if spec["session"]:
            # One examinee per exam: a user may only hold one live session.
            self.exam_count += 1
            taker = make_user(User.Role.STUDENT, f"lock_taker{self.exam_count}")
            ExamSession.objects.create(exam=exam, user=taker, status=spec["session"])
        return exam

    def fingerprint(self, exam: Exam):
        """Everything a blocked write must leave untouched, media files included."""
        exam = Exam.objects.get(pk=exam.pk)
        media_dir = os.path.join(self.media_root, "questions", str(exam.pk))
        files = sorted(
            os.path.relpath(os.path.join(root, f), media_dir)
            for root, _dirs, names in os.walk(media_dir)
            for f in names
        )
        return (
            model_to_dict(exam),
            exam.updated_at,
            list(Question.objects.filter(exam=exam).order_by("id").values()),
            list(ExamSection.objects.filter(exam=exam).order_by("id").values()),
            list(QuestionPool.objects.filter(exam=exam).order_by("id").values()),
            list(QuestionAttachment.objects.filter(question__exam=exam).order_by("id").values()),
            files,
        )


# Each write path: (callable(test, exam) -> response, success status).
def _patch_settings(t, exam):
    return t.client.patch(
        f"/api/exams/{exam.id}/",
        {"title": "Renamed", "instructions": "New rules", "shuffle_questions": True},
        format="json",
    )


def _put_settings(t, exam):
    now = timezone.now()
    return t.client.put(
        f"/api/exams/{exam.id}/",
        {
            "title": "Replaced",
            "duration_minutes": 45,
            "passing_score": 50,
            "available_from": (now + timedelta(days=3)).isoformat(),
            "available_until": (now + timedelta(days=4)).isoformat(),
        },
        format="json",
    )


def _patch_schedule(t, exam):
    now = timezone.now()
    return t.client.patch(
        f"/api/exams/{exam.id}/",
        {
            "available_from": (now + timedelta(days=3)).isoformat(),
            "available_until": (now + timedelta(days=4)).isoformat(),
        },
        format="json",
    )


def _patch_duration(t, exam):
    return t.client.patch(f"/api/exams/{exam.id}/", {"duration_minutes": 5}, format="json")


def _create_question(t, exam):
    return t.client.post(
        f"/api/exams/{exam.id}/questions/",
        {
            "question_text": "New one",
            "question_type": "short_answer",
            "correct_answer": "x",
            "points": 1,
        },
        format="json",
    )


def _update_question(t, exam):
    return t.client.patch(
        f"/api/exams/{exam.id}/questions/{t.q1.id}/",
        {"question_text": "Changed", "correct_answer": "3"},
        format="json",
    )


def _replace_question(t, exam):
    return t.client.put(
        f"/api/exams/{exam.id}/questions/{t.q2.id}/",
        {
            "question_text": "Replaced",
            "question_type": "true_false",
            "correct_answer": "false",
            "points": 3,
        },
        format="json",
    )


def _delete_question(t, exam):
    return t.client.delete(f"/api/exams/{exam.id}/questions/{t.q2.id}/")


def _reorder_questions(t, exam):
    return t.client.post(
        f"/api/exams/{exam.id}/questions/reorder/",
        {"question_ids": [t.q2.id, t.q1.id]},
        format="json",
    )


_IMPORT_ROWS = [
    {"question_text": "Imported", "question_type": "true_false", "correct_answer": "true"}
]


def _import_questions(t, exam):
    return t.client.post(
        f"/api/exams/{exam.id}/questions/import/", {"questions": _IMPORT_ROWS}, format="json"
    )


def _import_questions_dry_run(t, exam):
    return t.client.post(
        f"/api/exams/{exam.id}/questions/import/",
        {"questions": _IMPORT_ROWS, "dry_run": True},
        format="json",
    )


def _create_section(t, exam):
    return t.client.post(f"/api/exams/{exam.id}/sections/", {"title": "Part B"}, format="json")


def _update_section(t, exam):
    return t.client.patch(
        f"/api/exams/{exam.id}/sections/{t.section.id}/", {"title": "Renamed"}, format="json"
    )


def _delete_section(t, exam):
    return t.client.delete(f"/api/exams/{exam.id}/sections/{t.section.id}/")


def _create_pool(t, exam):
    return t.client.post(
        f"/api/exams/{exam.id}/pools/", {"name": "Pool 2", "draw_count": 1}, format="json"
    )


def _upload_attachment(t, exam):
    return t.client.post(
        f"/api/exams/{exam.id}/questions/{t.q1.id}/attachments/",
        {"file": png()},
        format="multipart",
    )


def _delete_attachment(t, exam):
    return t.client.delete(
        f"/api/exams/{exam.id}/questions/{t.q1.id}/attachments/{t.attachment.id}/"
    )


def _upload_option_image(t, exam):
    return t.client.post(
        f"/api/exams/{exam.id}/questions/{t.q1.id}/option-image/",
        {"file": png()},
        format="multipart",
    )


def _upload_draft_option_image(t, exam):
    return t.client.post(f"/api/exams/{exam.id}/option-image/", {"file": png()}, format="multipart")


def _submit_for_review(t, exam):
    return t.client.post(f"/api/exams/{exam.id}/submit/")


CONTENT_WRITE_PATHS = {
    "patch_settings": (_patch_settings, status.HTTP_200_OK),
    "put_settings": (_put_settings, status.HTTP_200_OK),
    "patch_schedule": (_patch_schedule, status.HTTP_200_OK),
    "patch_duration": (_patch_duration, status.HTTP_200_OK),
    "create_question": (_create_question, status.HTTP_201_CREATED),
    "update_question": (_update_question, status.HTTP_200_OK),
    "replace_question": (_replace_question, status.HTTP_200_OK),
    "delete_question": (_delete_question, status.HTTP_204_NO_CONTENT),
    "reorder_questions": (_reorder_questions, status.HTTP_200_OK),
    "import_questions": (_import_questions, status.HTTP_201_CREATED),
    "import_questions_dry_run": (_import_questions_dry_run, status.HTTP_200_OK),
    "create_section": (_create_section, status.HTTP_201_CREATED),
    "update_section": (_update_section, status.HTTP_200_OK),
    "delete_section": (_delete_section, status.HTTP_204_NO_CONTENT),
    "create_pool": (_create_pool, status.HTTP_201_CREATED),
    "upload_attachment": (_upload_attachment, status.HTTP_201_CREATED),
    "delete_attachment": (_delete_attachment, status.HTTP_204_NO_CONTENT),
    "upload_option_image": (_upload_option_image, status.HTTP_201_CREATED),
    "upload_draft_option_image": (_upload_draft_option_image, status.HTTP_201_CREATED),
    "submit_for_review": (_submit_for_review, status.HTTP_200_OK),
}


class ContentWritePathMatrixTests(EditLockTestBase):
    """Every question/content/settings write path, against every exam state."""

    def _run_path(self, name):
        call, ok_status = CONTENT_WRITE_PATHS[name]
        for state, spec in STATES.items():
            with self.subTest(path=name, state=state):
                exam = self.make_exam(state)
                before = self.fingerprint(exam)
                res = call(self, exam)
                if spec["lock"] is None:
                    self.assertEqual(res.status_code, ok_status, res.data)
                else:
                    self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, res.data)
                    self.assertIn(LOCK_TEXT[spec["lock"]], str(res.data))
                    self.assertEqual(self.fingerprint(exam), before, "blocked write changed data")


for _name in CONTENT_WRITE_PATHS:
    setattr(
        ContentWritePathMatrixTests,
        f"test_{_name}",
        lambda self, _n=_name: self._run_path(_n),
    )


class CandidateWritePathMatrixTests(EditLockTestBase):
    """Candidates stay editable in every state, including while the exam is ongoing."""

    def test_add_candidate_in_every_state(self):
        for state in STATES:
            with self.subTest(state=state):
                exam = self.make_exam(state)
                res = self.client.post(
                    f"/api/exams/{exam.id}/assignments/",
                    {"email": self.candidate.email, "extra_time_minutes": 10},
                    format="json",
                )
                self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
                self.assertTrue(
                    ExamAssignment.objects.filter(exam=exam, user=self.candidate).exists()
                )

    def test_update_candidate_in_every_state(self):
        for state in STATES:
            with self.subTest(state=state):
                exam = self.make_exam(state)
                ExamAssignment.objects.create(exam=exam, user=self.candidate)
                res = self.client.post(
                    f"/api/exams/{exam.id}/assignments/",
                    {"email": self.candidate.email, "extra_time_minutes": 25, "seat_label": "B-7"},
                    format="json",
                )
                self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
                assignment = ExamAssignment.objects.get(exam=exam, user=self.candidate)
                self.assertEqual(assignment.extra_time_minutes, 25)
                self.assertEqual(assignment.seat_label, "B-7")

    def test_import_candidates_in_every_state(self):
        for state in STATES:
            with self.subTest(state=state):
                exam = self.make_exam(state)
                csv_text = (
                    "email,extra_time_minutes,seat_label\n"
                    f"{self.candidate.email},5,A-1\n"
                )
                res = self.client.post(
                    f"/api/exams/{exam.id}/assignments/import/", {"csv": csv_text}, format="json"
                )
                self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
                self.assertEqual(res.data["created"], 1)

    def test_list_candidates_while_ongoing(self):
        exam = self.make_exam("ongoing_in_progress")
        ExamAssignment.objects.create(exam=exam, user=self.candidate)
        res = self.client.get(f"/api/exams/{exam.id}/assignments/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

    def test_candidate_edits_still_need_modify_permission(self):
        """Ongoing doesn't open the roster to anyone new - the usual access rules still apply."""
        exam = self.make_exam("ongoing_scheduled")
        self.client.force_authenticate(user=self.examinee)
        res = self.client.post(
            f"/api/exams/{exam.id}/assignments/", {"email": self.candidate.email}, format="json"
        )
        self.assertIn(res.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))
        self.assertFalse(ExamAssignment.objects.filter(exam=exam).exists())


class LifecycleActionMatrixTests(EditLockTestBase):
    """Publish, unpublish and delete against every state."""

    def test_unpublish(self):
        for state, spec in STATES.items():
            with self.subTest(state=state):
                exam = self.make_exam(state)
                res = self.client.post(f"/api/exams/{exam.id}/unpublish/")
                exam.refresh_from_db()
                if spec["can_unpublish"]:
                    self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
                    self.assertEqual(exam.status, Exam.Status.DRAFT)
                else:
                    self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, res.data)
                    self.assertEqual(exam.status, spec["status"])

    def test_unpublish_refusal_explains_ongoing(self):
        for state in ("ongoing_scheduled", "ongoing_in_progress", "ongoing_after_close"):
            with self.subTest(state=state):
                exam = self.make_exam(state)
                res = self.client.post(f"/api/exams/{exam.id}/unpublish/")
                self.assertIn("in progress", str(res.data))
                self.assertIn("Only candidates can be edited", str(res.data))

    def test_publish(self):
        for state, spec in STATES.items():
            with self.subTest(state=state):
                exam = self.make_exam(state)
                res = self.client.post(f"/api/exams/{exam.id}/publish/")
                exam.refresh_from_db()
                if spec["status"] == "draft":
                    self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
                    self.assertEqual(exam.status, Exam.Status.ACTIVE)
                else:
                    self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, res.data)
                    self.assertEqual(exam.status, spec["status"])

    def test_publish_already_published_says_so(self):
        exam = self.make_exam("published_not_started")
        res = self.client.post(f"/api/exams/{exam.id}/publish/")
        self.assertIn("already published", str(res.data))

    def test_delete_exam(self):
        for state, spec in STATES.items():
            with self.subTest(state=state):
                exam = self.make_exam(state)
                res = self.client.delete(f"/api/exams/{exam.id}/")
                deletable = spec["status"] in ("draft", "archived") and spec["session"] is None
                if deletable:
                    self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT, res.data)
                    self.assertFalse(Exam.objects.filter(pk=exam.pk).exists())
                else:
                    self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, res.data)
                    self.assertTrue(Exam.objects.filter(pk=exam.pk).exists())

    def test_delete_published_asks_to_unpublish_or_archive(self):
        exam = self.make_exam("published_not_started")
        res = self.client.delete(f"/api/exams/{exam.id}/")
        self.assertIn("Unpublish or archive it first", str(res.data))


class EditLockDetailFieldTests(EditLockTestBase):
    """The builder reads the lock from the exam detail payload."""

    def test_detail_fields_in_every_state(self):
        for state, spec in STATES.items():
            with self.subTest(state=state):
                exam = self.make_exam(state)
                data = self.client.get(f"/api/exams/{exam.id}/").data
                self.assertEqual(data["edit_lock"], spec["lock"])
                self.assertEqual(data["questions_editable"], spec["lock"] is None)
                self.assertEqual(data["can_unpublish"], spec["can_unpublish"])
                if spec["lock"]:
                    self.assertIn(LOCK_TEXT[spec["lock"]], data["edit_lock_message"])
                else:
                    self.assertIsNone(data["edit_lock_message"])


class ScheduledStartUsesServerTimeTests(EditLockTestBase):
    """The 'started' check runs on server time, to the second."""

    def setUp(self):
        super().setUp()
        self.start = timezone.now().replace(microsecond=0) + timedelta(hours=2)
        self.exam = self.make_exam(
            "published_not_started",
            available_from=self.start,
            available_until=self.start + timedelta(hours=3),
        )

    def _at(self, moment):
        return mock.patch("features.exams.services.timezone.now", return_value=moment)

    def test_one_second_before_start_is_only_published(self):
        with self._at(self.start - timedelta(seconds=1)):
            self.assertEqual(services.exam_edit_lock(self.exam), services.EDIT_LOCK_PUBLISHED)
            res = self.client.post(f"/api/exams/{self.exam.id}/unpublish/")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)

    def test_at_scheduled_start_exam_is_ongoing(self):
        with self._at(self.start):
            self.assertEqual(services.exam_edit_lock(self.exam), services.EDIT_LOCK_ONGOING)
            res = self.client.post(f"/api/exams/{self.exam.id}/unpublish/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.exam.refresh_from_db()
        self.assertEqual(self.exam.status, Exam.Status.ACTIVE)

    def test_after_window_closes_without_attempts_exam_has_ended(self):
        with self._at(self.start + timedelta(hours=3, seconds=1)):
            self.assertEqual(services.exam_edit_lock(self.exam), services.EDIT_LOCK_PUBLISHED)
            self.assertTrue(services.unpublish_block_reason(self.exam) is None)

    def test_published_exam_without_a_start_time_is_open_at_once(self):
        exam = self.make_exam("published_not_started", available_from=None, available_until=None)
        self.assertEqual(services.exam_edit_lock(exam), services.EDIT_LOCK_ONGOING)


class UnpublishEditRepublishFlowTests(EditLockTestBase):
    """The way out of Bug 5: unpublish -> edit -> republish."""

    def test_admin_round_trip(self):
        exam = self.make_exam("published_not_started")

        blocked = self.client.patch(f"/api/exams/{exam.id}/", {"title": "Fixed"}, format="json")
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(PUBLISHED_TEXT, str(blocked.data))

        res = self.client.post(f"/api/exams/{exam.id}/unpublish/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsNone(res.data["exam"]["edit_lock"])

        self.assertEqual(
            self.client.patch(f"/api/exams/{exam.id}/", {"title": "Fixed"}, format="json").status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(_update_question(self, exam).status_code, status.HTTP_200_OK)

        res = self.client.post(f"/api/exams/{exam.id}/publish/")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["exam"]["edit_lock"], "published")

        again = self.client.patch(f"/api/exams/{exam.id}/", {"title": "Again"}, format="json")
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)
        exam.refresh_from_db()
        self.assertEqual(exam.title, "Fixed")

    def test_creator_round_trip_needs_fresh_approval(self):
        faculty = make_user(User.Role.FACULTY, "lock_faculty")
        head = make_user(User.Role.PROGRAM_HEAD, "lock_head")
        exam = self.make_exam(
            "published_not_started",
            created_by=faculty,
            approval_status=Exam.ApprovalStatus.APPROVED,
        )
        self.client.force_authenticate(user=faculty)

        self.assertEqual(_update_question(self, exam).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            self.client.post(f"/api/exams/{exam.id}/unpublish/").status_code, status.HTTP_200_OK
        )
        self.assertEqual(_update_question(self, exam).status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.client.post(f"/api/exams/{exam.id}/publish/").status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            self.client.post(f"/api/exams/{exam.id}/submit/").status_code, status.HTTP_200_OK
        )

        self.client.force_authenticate(user=head)
        self.assertEqual(
            self.client.post(f"/api/exams/{exam.id}/approve/").status_code, status.HTTP_200_OK
        )

        self.client.force_authenticate(user=faculty)
        res = self.client.post(f"/api/exams/{exam.id}/publish/")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(_update_question(self, exam).status_code, status.HTTP_400_BAD_REQUEST)

    def test_archive_and_unarchive_do_not_reopen_editing(self):
        exam = self.make_exam("ongoing_in_progress")
        self.assertEqual(
            self.client.post(f"/api/exams/{exam.id}/archive/").status_code, status.HTTP_200_OK
        )
        self.assertEqual(_update_question(self, exam).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            self.client.post(f"/api/exams/{exam.id}/unarchive/").status_code, status.HTTP_200_OK
        )
        exam.refresh_from_db()
        self.assertEqual(exam.status, Exam.Status.ACTIVE)
        res = _update_question(self, exam)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(ONGOING_TEXT, str(res.data))
