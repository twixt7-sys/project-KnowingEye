"""B1: per-exam exclusion of examinees who already completed the exam."""

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from features.exams import services
from features.exams.models import Exam, ExamAssignment
from features.session.models import ExamSession

User = get_user_model()


class ExcludeCompletedTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_ex", email="admin_ex@test.local",
            password="TestPass123!", role=User.Role.ADMIN,
        )
        self.done = self._student("done")
        self.fresh = self._student("fresh")
        self.exam = Exam.objects.create(
            title="Final", description="", duration_minutes=10, passing_score=50,
            status=Exam.Status.ACTIVE, created_by=self.admin, max_attempts=3,
            requires_assignment=True,
        )
        ExamAssignment.objects.create(exam=self.exam, user=self.done)
        ExamAssignment.objects.create(exam=self.exam, user=self.fresh)
        self._finish(self.done, state=ExamSession.Status.COMPLETED, score=82, passed=True)
        # An abandoned/in-progress attempt does not count as completing the exam.
        self._finish(self.fresh, state=ExamSession.Status.IN_PROGRESS)
        self.client.force_authenticate(user=self.admin)

    def _student(self, name):
        return User.objects.create_user(
            username=name, email=f"{name}@test.local",
            password="TestPass123!", role=User.Role.STUDENT,
        )

    def _finish(self, user, *, state, score=None, passed=None, exam=None):
        return ExamSession.objects.create(
            exam=exam or self.exam, user=user, status=state,
            exam_started_at=timezone.now(), submitted_at=timezone.now(),
            percentage_score=score, passed=passed,
        )

    def _enable(self):
        self.exam.exclude_completed_examinees = True
        self.exam.save(update_fields=["exclude_completed_examinees"])

    # -- enforcement -------------------------------------------------------

    def test_off_by_default_so_max_attempts_still_governs(self):
        self.assertEqual(services.attempts_remaining_for_user(self.exam, self.done), 2)
        services.assert_exam_available_for_user(self.exam, self.done)

    def test_enabled_blocks_a_completed_examinee_despite_remaining_attempts(self):
        self._enable()
        self.assertEqual(services.attempts_remaining_for_user(self.exam, self.done), 0)
        with self.assertRaises(ValidationError) as ctx:
            services.assert_exam_available_for_user(self.exam, self.done)
        self.assertIn("already completed", str(ctx.exception.detail))

    def test_attempts_override_cannot_reopen_an_excluded_examinee(self):
        self._enable()
        ExamAssignment.objects.filter(exam=self.exam, user=self.done).update(attempts_override=5)
        self.assertEqual(services.attempts_remaining_for_user(self.exam, self.done), 0)

    def test_enabled_does_not_touch_examinees_who_have_not_completed(self):
        self._enable()
        services.assert_exam_available_for_user(self.exam, self.fresh)
        self.assertEqual(services.attempts_remaining_for_user(self.exam, self.fresh), 3)

    def test_pending_review_counts_as_completed(self):
        self._enable()
        self._finish(self.fresh, state=ExamSession.Status.PENDING_REVIEW)
        self.assertTrue(services.user_excluded_for_completion(self.exam, self.fresh))

    def test_practice_exams_are_never_excluded(self):
        self.exam.is_practice = True
        self.exam.exclude_completed_examinees = True
        self.exam.save()
        self.assertFalse(services.user_excluded_for_completion(self.exam, self.done))

    def test_exclusion_is_per_exam(self):
        self._enable()
        other = Exam.objects.create(
            title="Other", description="", duration_minutes=10, passing_score=50,
            status=Exam.Status.ACTIVE, created_by=self.admin, max_attempts=1,
            exclude_completed_examinees=True,
        )
        self.assertFalse(services.user_excluded_for_completion(other, self.done))

    def test_examinee_sees_zero_attempts_remaining_in_mine(self):
        self._enable()
        self.client.force_authenticate(user=self.done)
        r = self.client.get("/api/exams/mine/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        row = next(e for e in r.data if e["id"] == self.exam.id)
        self.assertEqual(row["attempts_remaining"], 0)

    # -- examiner list -----------------------------------------------------

    def test_completed_examinees_list(self):
        self._finish(self.done, state=ExamSession.Status.COMPLETED, score=60, passed=True)
        r = self.client.get(f"/api/exams/{self.exam.id}/completed-examinees/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertFalse(r.data["exclusion_enforced"])
        self.assertEqual(r.data["count"], 1)
        row = r.data["results"][0]
        self.assertEqual(row["username"], "done")
        self.assertEqual(row["attempts_completed"], 2)
        self.assertTrue(row["on_roster"])
        self.assertEqual(row["roster_status"], "eligible")

    def test_list_reports_enforcement_flag(self):
        self._enable()
        r = self.client.get(f"/api/exams/{self.exam.id}/completed-examinees/")
        self.assertTrue(r.data["exclusion_enforced"])

    def test_list_requires_exam_edit_rights(self):
        self.client.force_authenticate(user=self.fresh)
        r = self.client.get(f"/api/exams/{self.exam.id}/completed-examinees/")
        self.assertIn(r.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

    # -- roster ------------------------------------------------------------

    def test_adding_an_excluded_candidate_is_rejected(self):
        self._enable()
        newbie = self._student("late")
        self._finish(newbie, state=ExamSession.Status.COMPLETED, score=40, passed=False)
        r = self.client.post(
            f"/api/exams/{self.exam.id}/assignments/", {"email": newbie.email}, format="json"
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(ExamAssignment.objects.filter(exam=self.exam, user=newbie).exists())

    def test_adding_the_same_candidate_is_fine_when_not_enforced(self):
        newbie = self._student("late")
        self._finish(newbie, state=ExamSession.Status.COMPLETED, score=40, passed=False)
        r = self.client.post(
            f"/api/exams/{self.exam.id}/assignments/", {"email": newbie.email}, format="json"
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_csv_import_skips_excluded_and_reports_them(self):
        self._enable()
        newbie = self._student("newbie")
        csv_text = f"email,extra_time_minutes,seat_label\n{self.done.email},0,\n{newbie.email},5,A1\n"
        r = self.client.post(
            f"/api/exams/{self.exam.id}/assignments/import/", {"csv": csv_text}, format="json"
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["created"], 1)
        self.assertEqual(r.data["skipped"], [self.done.email])
        self.assertTrue(ExamAssignment.objects.filter(exam=self.exam, user=newbie).exists())

    def test_exam_api_exposes_and_saves_the_flag(self):
        # Like every other setting, it is edited while the exam is a draft.
        self.exam.sessions.filter(status=ExamSession.Status.IN_PROGRESS).delete()
        self.exam.status = Exam.Status.DRAFT
        self.exam.save(update_fields=["status"])
        r = self.client.patch(
            f"/api/exams/{self.exam.id}/", {"exclude_completed_examinees": True}, format="json"
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.exam.refresh_from_db()
        self.assertTrue(self.exam.exclude_completed_examinees)
        detail = self.client.get(f"/api/exams/{self.exam.id}/")
        self.assertTrue(detail.data["exclude_completed_examinees"])
