"""Drop cached department/category lists as soon as either changes."""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from core.utils.api_cache import bump_namespace

from .models import Department, ExamCategory


@receiver([post_save, post_delete], sender=Department)
@receiver([post_save, post_delete], sender=ExamCategory)
def invalidate_reference_data_cache(sender, **kwargs):
    bump_namespace("reference-data")
