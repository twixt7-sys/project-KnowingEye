"""Back-compat re-exports.

The bespoke permission classes that used to live here moved to
:mod:`core.security.drf` so every feature shares the same RBAC/PBAC
building blocks. Ownership + action-permission logic for exams now lives in
``features.exams.services`` (``assert_can_modify_exam`` /
``assert_can_delete_exam``), which the viewset calls from ``perform_create``/
``perform_update``/``destroy`` rather than an object-level permission class.
"""

from __future__ import annotations

from core.security.drf import IsAdminOrReadOnly, IsOwnerOrHasPermission

IsExamOwnerOrAdmin = IsOwnerOrHasPermission("exams.update")

__all__ = ["IsAdminOrReadOnly", "IsExamOwnerOrAdmin"]
