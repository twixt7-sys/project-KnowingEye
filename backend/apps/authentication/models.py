from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom User model with role-based access control.
    Extends Django's AbstractUser to add exam-specific features.
    """

    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Administrator'
        EXAMINEE = 'EXAMINEE', 'Examinee'

    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.EXAMINEE,
        help_text='User role: ADMIN or EXAMINEE'
    )
    is_active = models.BooleanField(
        default=True,
        help_text='Designates whether this user account should be treated as active.'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'authentication_user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"

    def is_admin(self):
        """Check if user is an administrator."""
        return self.role == self.Role.ADMIN

    def is_examinee(self):
        """Check if user is an examinee."""
        return self.role == self.Role.EXAMINEE

