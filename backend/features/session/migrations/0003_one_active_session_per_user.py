# Enforce at most one active exam session per examinee.

from django.db import migrations, models
from django.utils import timezone


def expire_extra_active_sessions(apps, schema_editor):
    """Keep the newest active session per user; expire the rest."""
    ExamSession = apps.get_model("exam_sessions", "ExamSession")
    active = ExamSession.objects.filter(
        status__in=["setup", "in_progress"]
    ).order_by("user_id", "-started_at")

    seen_users: set[int] = set()
    now = timezone.now()
    for session in active.iterator():
        if session.user_id in seen_users:
            session.status = "expired"
            session.submitted_at = now
            session.save(update_fields=["status", "submitted_at"])
        else:
            seen_users.add(session.user_id)


class Migration(migrations.Migration):

    dependencies = [
        ("exam_sessions", "0002_setup_phase"),
    ]

    operations = [
        migrations.RunPython(expire_extra_active_sessions, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="examsession",
            name="unique_active_session_per_exam_user",
        ),
        migrations.AddConstraint(
            model_name="examsession",
            constraint=models.UniqueConstraint(
                condition=models.Q(("status__in", ["in_progress", "setup"])),
                fields=("user",),
                name="unique_active_session_per_user",
            ),
        ),
    ]
