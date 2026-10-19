"""Delete proctoring snapshots older than the retention window."""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from features.monitoring.models import SessionSnapshot

DEFAULT_RETENTION_DAYS = 180


class Command(BaseCommand):
    help = "Delete session snapshots (proctoring evidence) older than --days (default 180)."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=DEFAULT_RETENTION_DAYS)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        days = options["days"]
        if days < 1:
            self.stderr.write("--days must be at least 1")
            return
        cutoff = timezone.now() - timedelta(days=days)
        stale = SessionSnapshot.objects.filter(created_at__lt=cutoff)
        count = stale.count()
        if options["dry_run"]:
            self.stdout.write(f"{count} snapshot(s) older than {days} days would be deleted.")
            return
        stale.delete()
        self.stdout.write(f"Deleted {count} snapshot(s) older than {days} days.")
