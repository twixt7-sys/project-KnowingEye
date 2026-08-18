"""Custom user model with role-based access control + profile fields."""

from __future__ import annotations

from django.contrib.auth.models import AbstractUser
from django.db import models


def _avatar_upload_path(instance: "User", filename: str) -> str:
    return f"avatars/{instance.id or 'tmp'}/{filename}"


class User(AbstractUser):
    """Extends Django's AbstractUser to add Knowing-Eye specific profile fields.

    Six named roles, per the Capstone Defense Revision Directive Area 01
    ("Role-based access control"): Administrator, Guidance Staff, Program
    Head, Teacher/Exam Creator, Proctor, Examinee. ``PROCTOR`` absorbs the
    old ``STUDENT_ASSISTANT`` role (see migration 0006).
    """

    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Administrator"
        GUIDANCE_STAFF = "GUIDANCE_STAFF", "Guidance Staff"
        PROGRAM_HEAD = "PROGRAM_HEAD", "Program Head"
        FACULTY = "FACULTY", "Teacher / Exam Creator"
        PROCTOR = "PROCTOR", "Proctor"
        STUDENT = "STUDENT", "Examinee"

    email = models.EmailField(unique=True)
    email_verified = models.BooleanField(
        default=False,
        help_text="Whether the account email has been confirmed via OTP",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STUDENT,
        help_text="User role: ADMIN, GUIDANCE_STAFF, PROGRAM_HEAD, FACULTY, PROCTOR, or STUDENT",
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

    def is_guidance_staff(self):
        return self.role == self.Role.GUIDANCE_STAFF

    def is_program_head(self):
        return self.role == self.Role.PROGRAM_HEAD

    def is_faculty(self):
        return self.role == self.Role.FACULTY

    def is_proctor(self):
        return self.role == self.Role.PROCTOR

    # Back-compat alias - PROCTOR absorbs the old STUDENT_ASSISTANT role.
    def is_student_assistant(self):
        return self.is_proctor()

    def is_student(self):
        return self.role == self.Role.STUDENT

    def is_staff_role(self):
        """True for any role that isn't a plain student (every non-examinee role)."""
        return self.role != self.Role.STUDENT

    def can_approve_exams(self):
        """Level 1 approval authority, per Directive A1 (Administrator responsibilities)."""
        return self.role in (self.Role.ADMIN, self.Role.PROGRAM_HEAD)

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


class EmailVerification(models.Model):
    """A one-time code issued for OTP-based email verification.

    Directive Area 01 ("Registration & verification") - "implement OTP
    verification" and "add email verification". The code itself is stored
    hashed (via Django's password hasher, which works for any short string)
    so a database read alone can't be used to impersonate a pending
    verification. Generalized with a ``purpose`` field so the same mechanism
    can back a future password-reset OTP without a new table.
    """

    class Purpose(models.TextChoices):
        EMAIL_VERIFY = "email_verify", "Email verification"

    user = models.ForeignKey(
        "authentication.User",
        on_delete=models.CASCADE,
        related_name="email_verifications",
    )
    purpose = models.CharField(
        max_length=20, choices=Purpose.choices, default=Purpose.EMAIL_VERIFY
    )
    code_hash = models.CharField(max_length=255)
    attempts = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "authentication_email_verification"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "purpose", "consumed_at"]),
        ]

    def __str__(self):
        return f"{self.purpose} OTP for {self.user_id}"
