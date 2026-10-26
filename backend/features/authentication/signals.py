"""Tell open browsers when a user account or its access changes."""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from core.realtime.events import STAFF_GROUP, Topic, notify

from .models import PermissionChange, User

# Bookkeeping written on every sign-in; nothing on screen depends on it.
_BOOKKEEPING_FIELDS = frozenset({"last_login", "last_seen_at", "updated_at"})


@receiver(post_save, sender=User)
def user_saved(sender, instance, update_fields=None, **kwargs):
    if update_fields is not None and set(update_fields) <= _BOOKKEEPING_FIELDS:
        return
    notify(Topic.USERS, audience=STAFF_GROUP)
    # The user's own tabs re-read their role, access and profile.
    notify(Topic.ME, audience=None, user_id=instance.pk)


@receiver(post_delete, sender=User)
def user_deleted(sender, **kwargs):
    notify(Topic.USERS, audience=STAFF_GROUP)


@receiver(post_save, sender=PermissionChange)
def permissions_changed(sender, instance, **kwargs):
    notify(Topic.USERS, audience=STAFF_GROUP)
    notify(Topic.ME, audience=None, user_id=instance.target_id)
