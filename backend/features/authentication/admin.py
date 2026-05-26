from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Custom admin for the Knowing Eye User model."""

    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "Profile",
            {
                "fields": (
                    "role",
                    "avatar",
                    "phone",
                    "institution",
                    "student_id",
                    "last_seen_at",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )
    readonly_fields = ("created_at", "updated_at", "date_joined", "last_login", "last_seen_at")
    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "role",
        "is_active",
        "last_seen_at",
        "created_at",
    )
    list_filter = ("role", "is_active", "created_at")
    search_fields = ("username", "email", "first_name", "last_name", "institution", "student_id")
    ordering = ("-created_at",)
