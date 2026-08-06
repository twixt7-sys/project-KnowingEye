"""Reusable DRF permission classes for the three enforcement tiers.

Parametrised classes (``HasRole``, ``HasModuleAccess``, ``HasPermission``,
``IsOwnerOrHasPermission``) are factory functions returning a configured
``BasePermission`` subclass, e.g.::

    permission_classes = [IsAuthenticated, HasModuleAccess("exams")]

All short-circuit ``admin`` to allow, matching OSAS's ``Gate::before`` /
super-admin bypass.
"""

from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS, BasePermission

from . import service


def HasRole(*roles: str):
    """Tier 1 - allow only these roles (admin always allowed)."""

    roles_lower = {r.lower() for r in roles}

    class _HasRole(BasePermission):
        message = "Your role does not have access to this resource."

        def has_permission(self, request, view):
            user = request.user
            if not (user and user.is_authenticated):
                return False
            if user.is_admin():
                return True
            return user.role.lower() in roles_lower

    return _HasRole


def HasModuleAccess(module: str):
    """Tier 2 - allow when the user can see ``module``."""

    class _HasModuleAccess(BasePermission):
        message = "You do not have access to this module."

        def has_permission(self, request, view):
            return service.has_module(request.user, module)

    return _HasModuleAccess


def HasPermission(action: str):
    """Tier 3 - allow when the user can perform ``action``."""

    class _HasPermission(BasePermission):
        message = "You do not have permission to perform this action."

        def has_permission(self, request, view):
            return service.can(request.user, action)

    return _HasPermission


def IsOwnerOrHasPermission(action: str, owner_attr: str = "created_by_id"):
    """Object-level - admin, or ``action`` capability AND ownership.

    Replaces ad-hoc "is this the creator, or an admin" checks. The action
    permission is a prerequisite, not a bypass: holding e.g. ``exams.update``
    lets a role edit objects it owns, it does not grant editing of every
    object of that type (unless the object also carries a truthy
    ``is_superuser``-style admin bypass).
    """

    class _IsOwnerOrHasPermission(BasePermission):
        message = "You can only modify objects you own."

        def has_permission(self, request, view):
            return bool(request.user and request.user.is_authenticated)

        def has_object_permission(self, request, view, obj):
            user = request.user
            if user.is_admin():
                return True
            if not service.can(user, action):
                return False
            owner_id = getattr(obj, owner_attr, None)
            return owner_id == getattr(user, "id", None)

    return _IsOwnerOrHasPermission


class IsAdminOrReadOnly(BasePermission):
    """Read for any authenticated user, write only for admins."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_admin()
