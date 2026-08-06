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
        FACULTY = "FACULTY", "Faculty"
        STUDENT_ASSISTANT = "STUDENT_ASSISTANT", "Student Assistant"
        STUDENT = "STUDENT", "Student"

    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STUDENT,
        help_text="User role: ADMIN, FACULTY, STUDENT_ASSISTANT, or STUDENT",
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

    def is_faculty(self):
        return self.role == self.Role.FACULTY

    def is_student_assistant(self):
        return self.role == self.Role.STUDENT_ASSISTANT

    def is_student(self):
        return self.role == self.Role.STUDENT

    def is_staff_role(self):
        """True for any role that isn't a plain student (admin/faculty/SA)."""
        return self.role != self.Role.STUDENT

    # Back-compat alias for the old binary role model.
    def is_examinee(self):
        return self.role == self.Role.STUDENT


class PermissionChange(models.Model):
    """Audit trail for delegated RBAC/PBAC grant, deny, and revoke actions."""

    class Action(models.TextChoices):
        GRANT = "grant", "Grant"
        DENY = "deny", "Deny"
        REVOKE = "revoke", "Revoke"

    target = models.ForeignKey(
        "authentication.User", on_delete=models.CASCADE, related_name="permission_changes"
    )
    actor = models.ForeignKey(
        "authentication.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="permission_changes_made",
    )
    permission = models.CharField(max_length=100, help_text="e.g. 'module.exams' or 'action.exams.create'")
    action = models.CharField(max_length=10, choices=Action.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "authentication_permission_change"
        ordering = ["-created_at"]
