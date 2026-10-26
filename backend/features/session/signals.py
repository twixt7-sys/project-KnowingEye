"""Tell open browsers when an exam attempt starts, ends or is graded."""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from core.realtime.events import STAFF_GROUP, Topic, notify

from .models import ExamSession

# Saves touching only other fields (the running timer, autosaved answers'
# bookkeeping, deadlines) change nothing another screen lists.
_VISIBLE_FIELDS = frozenset(
    {
        "status",
        "started_at",
        "exam_started_at",
        "submitted_at",
        "total_score",
        "percentage_score",
        "passed",
    }
)


def session_changed(session) -> None:
    notify(Topic.SESSIONS, exam_id=session.exam_id, audience=STAFF_GROUP, user_id=session.user_id)


@receiver(post_save, sender=ExamSession)
def session_saved(sender, instance, created, update_fields=None, **kwargs):
    if created or update_fields is None or _VISIBLE_FIELDS.intersection(update_fields):
        session_changed(instance)


@receiver(post_delete, sender=ExamSession)
def session_deleted(sender, instance, **kwargs):
    session_changed(instance)
