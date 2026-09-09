"""Seed (or tear down) fixture data for the Sprint 5 load-testing harness.

Directive Area 04 ("Capacity & performance", P0): the load test needs N
distinct, authenticated examinees each with a live IN_PROGRESS session to
upload frames into, so the monitoring WebSocket/REST endpoints see the same
per-user ownership checks they'd see in production - not a single shared
session shortcutting the auth path.

Usage:
    python manage.py seed_load_test --count 20 --out scripts/load/manifest.json
    python manage.py seed_load_test --flush
"""

from __future__ import annotations

import json
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from features.exams.models import Department, Exam
from features.session.models import ExamSession

User = get_user_model()

LOAD_TEST_MARKER = "loadtest"
DEPARTMENT_ABBR = "LOAD"
EXAM_TITLE = "Load Test Fixture Exam"


class Command(BaseCommand):
    help = "Seed or flush fixture users/sessions for scripts/load/ (Sprint 5 capacity testing)."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=20, help="Number of examinee sessions to seed.")
        parser.add_argument(
            "--out",
            type=str,
            default="scripts/load/manifest.json",
            help="Where to write the {session_id, token} manifest the load test reads. "
            "Relative paths resolve against the repo root (BASE_DIR's parent), not the cwd.",
        )
        parser.add_argument("--flush", action="store_true", help="Delete all previously seeded load-test data.")

    def handle(self, *args, **options):
        if options["flush"]:
            self._flush()
            return

        count = options["count"]
        manifest_path = Path(settings.BASE_DIR).parent / options["out"] if not Path(options["out"]).is_absolute() else Path(options["out"])

        with transaction.atomic():
            exam = self._get_or_create_exam()
            entries = [self._seed_one(exam, i) for i in range(count)]

        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps({"exam_id": exam.id, "sessions": entries}, indent=2))

        self.stdout.write(self.style.SUCCESS(f"Seeded {count} load-test sessions -> {manifest_path}"))

    def _get_or_create_exam(self) -> Exam:
        department, _ = Department.objects.get_or_create(
            abbreviation=DEPARTMENT_ABBR, defaults={"name": "Load Test Department"}
        )
        exam, _ = Exam.objects.get_or_create(
            title=EXAM_TITLE,
            defaults={
                "description": "Fixture exam for scripts/load/ - not a real exam, never publish-check this.",
                "department": department,
                "duration_minutes": 240,
                "passing_score": 50,
                "status": Exam.Status.ACTIVE,
                "monitoring_enabled": True,
                "max_attempts": 999,
                "created_by": self._get_or_create_creator(),
            },
        )
        if exam.status != Exam.Status.ACTIVE:
            exam.status = Exam.Status.ACTIVE
            exam.save(update_fields=["status"])
        return exam

    def _get_or_create_creator(self) -> User:
        user, created = User.objects.get_or_create(
            username="loadtest_admin",
            defaults={"email": "loadtest_admin@loadtest.local", "role": User.Role.ADMIN, "is_staff": True},
        )
        if created:
            user.set_unusable_password()
            user.save(update_fields=["password"])
        return user

    def _seed_one(self, exam: Exam, index: int) -> dict:
        username = f"{LOAD_TEST_MARKER}_user_{index}"
        user, _ = User.objects.get_or_create(
            username=username,
            defaults={"email": f"{username}@loadtest.local", "role": User.Role.STUDENT},
        )
        if not user.has_usable_password():
            user.set_unusable_password()
            user.save(update_fields=["password"])

        # One IN_PROGRESS session per user, created directly (bypassing the
        # normal setup/enrollment flow) since the load test targets the
        # monitoring endpoints, not exam-start itself.
        ExamSession.objects.filter(exam=exam, user=user).delete()
        now = timezone.now()
        session = ExamSession.objects.create(
            exam=exam,
            user=user,
            status=ExamSession.Status.IN_PROGRESS,
            exam_started_at=now,
            deadline_at=now + timedelta(hours=2),
            time_remaining=exam.duration_minutes * 60,
        )

        token = RefreshToken.for_user(user)
        return {"user": username, "session_id": str(session.id), "token": str(token.access_token)}

    def _flush(self):
        # Order matters: Exam.created_by is on_delete=PROTECT, so the Exam
        # (and the sessions pointing at it) must go before the admin user
        # that created it, not after.
        deleted_sessions, _ = ExamSession.objects.filter(user__username__startswith=f"{LOAD_TEST_MARKER}_").delete()
        Exam.objects.filter(title=EXAM_TITLE).delete()
        Department.objects.filter(abbreviation=DEPARTMENT_ABBR).delete()
        deleted_users, _ = User.objects.filter(username__startswith=f"{LOAD_TEST_MARKER}_").delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Flushed load-test fixtures ({deleted_sessions} sessions, {deleted_users} users)."
            )
        )
