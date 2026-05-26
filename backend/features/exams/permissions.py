"""Reusable DRF permission classes for the exams module."""

from __future__ import annotations

from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdminOrReadOnly(BasePermission):
    """Read for any authenticated user, write only for admins.

    Used at the viewset level to gate creation/mutation routes while still
    letting examinees list active exams.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return getattr(request.user, "is_admin", lambda: False)()


class IsExamOwnerOrAdmin(BasePermission):
    """Object-level: only the creator (or a superuser) may mutate."""

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        owner_id = getattr(obj, "created_by_id", None) or getattr(
            getattr(obj, "exam", None), "created_by_id", None
        )
        return (
            owner_id == request.user.id or getattr(request.user, "is_superuser", False)
        )
