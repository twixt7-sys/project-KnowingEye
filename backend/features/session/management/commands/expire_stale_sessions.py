"""Expire in-progress sessions whose allotted time has elapsed."""

from __future__ import annotations

from django.core.management.base import BaseCommand

from features.session.models import ExamSession
from features.session.services import expire_session_if_timed_out


class Command(BaseCommand):
    help = "Mark timed-out in-progress exam sessions as expired."

    def handle(self, *args, **options):
        qs = ExamSession.objects.filter(status=ExamSession.Status.IN_PROGRESS).select_related(
            "exam"
        )
        expired = 0
        for session in qs:
            if expire_session_if_timed_out(session):
                expired += 1
        self.stdout.write(self.style.SUCCESS(f"Expired {expired} session(s)."))
