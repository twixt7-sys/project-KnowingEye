"""Action permission registry (Tier 3).

Fine-grained, ``<module>.<action>`` named, per-user-grantable permissions -
the Django-native equivalent of OSAS's ``permission:<action>`` middleware.

Visibility ("can this user see this feature area") is the module registry's
job (:mod:`core.security.modules`); this registry only covers *mutating*
actions, so the two tiers never overlap. ``admin`` implicitly holds every
permission (see :func:`core.security.service.can`) and is not listed below.
"""

from __future__ import annotations

PERMISSIONS: set[str] = {
    # exams - create is a capability check; update/delete additionally
    # require ownership (or admin) at the service layer, see
    # features.exams.services.assert_can_modify_exam/assert_can_delete_exam.
    "exams.create",
    "exams.update",
    "exams.delete",
    # monitoring / behavior
    "monitoring.intervene",
    "behavior.resolve",
    # reports
    "reports.export",
    # sessions
    "sessions.terminate",
    "sessions.grade",
    # user management
    "users.view",
    "users.create",
    "users.update",
    "users.reset-password",
    "users.toggle-status",
    "users.archive",
    "users.force-delete",
    # settings
    "settings.view",
    "settings.update",
}

# Starter action grants applied (additively, per-user) when an account is
# created or its role changes. Stored as direct grants so an admin can
# revoke any one of them individually from the Manage Access screen without
# touching the role itself.
ROLE_DEFAULT_ACTIONS: dict[str, list[str]] = {
    "faculty": [
        "exams.create",
        "exams.update",
        "behavior.resolve",
        "reports.export",
        "sessions.grade",
    ],
    "student_assistant": [],
    "student": [],
}
