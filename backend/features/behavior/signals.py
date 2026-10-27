"""Tell proctor screens when an alert is raised or resolved."""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from core.realtime.events import STAFF_GROUP, Topic, notify

from .models import Alert


@receiver([post_save, post_delete], sender=Alert)
def alert_changed(sender, **kwargs):
    notify(Topic.ALERTS, audience=STAFF_GROUP)
