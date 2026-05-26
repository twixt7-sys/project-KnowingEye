"""Custom user model with role-based access control + profile fields."""

from __future__ import annotations

from django.contrib.auth.models import AbstractUser
from django.db import models


def _avatar_upload_path(instance: "User", filename: str) -> str:
    return f"avatars/{instance.id or 'tmp'}/{filename}"


class User(AbstractUser):
    """Extends Django's AbstractUser to add Knowing-Eye specific profile fields."""

    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Administrator"
        EXAMINEE = "EXAMINEE", "Examinee"

    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.EXAMINEE,
        help_text="User role: ADMIN or EXAMINEE",
    )

    avatar = models.ImageField(
        upload_to=_avatar_upload_path,
        null=True,
        blank=True,
        help_text="Profile picture",
    )
    phone = models.CharField(max_length=32, blank=True, default="")
    institution = models.CharField(max_length=255, blank=True, default="")
    student_id = models.CharField(max_length=64, blank=True, default="")

    is_active = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "authentication_user"
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["role"]),
        ]

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"

    def is_admin(self):
        return self.role == self.Role.ADMIN

    def is_examinee(self):
        return self.role == self.Role.EXAMINEE
