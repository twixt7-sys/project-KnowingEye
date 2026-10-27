"""Action permission registry (Tier 3).

Fine-grained, ``<module>.<action>`` named permissions - the Django-native
equivalent of OSAS's ``permission:<action>`` middleware.

Visibility ("can this user see this feature area") is the module registry's
job (:mod:`core.security.modules`); this registry only covers *mutating*
actions, so the two tiers never overlap. ``admin`` implicitly holds every
permission (see :func:`core.security.service.can`) and is not listed below.

Each action carries a human label for the admin screens and the modules it
needs to be usable at all: an action is pointless without the screens and
records it acts on (e.g. ``exams.update-any`` without the ``exams`` module
can't even load the exam), so granting an action from the admin screens also
turns its modules on.
"""

from __future__ import annotations

PERMISSION_META: dict[str, dict] = {
    # exams - create is a capability check; update requires ownership,
    # update-any lifts that (see features.exams.services.assert_can_modify_exam).
    "exams.create": {"label": "Create exams", "modules": ["exams"]},
    "exams.update": {"label": "Edit own exams", "modules": ["exams"]},
    "exams.update-any": {"label": "Edit any exam", "modules": ["exams"]},
    "exams.delete": {"label": "Delete any exam", "modules": ["exams"]},
    # exams.approve - Level 1 approval authority (Program Head / Admin) over
    # the submit -> review -> approve chain, see features.exams.services.
    "exams.approve": {"label": "Review and approve exams", "modules": ["exams", "exam-approvals"]},
    # monitoring / behavior
    "monitoring.intervene": {"label": "Intervene in live sessions", "modules": ["monitoring"]},
    "behavior.resolve": {"label": "Resolve behavior events", "modules": ["behavior"]},
    # reports
    "reports.export": {"label": "Export reports", "modules": ["reports"]},
    # sessions - pause/resume stops and restarts an examinee's exam clock;
    # terminate ends the attempt for good. Both happen from live monitoring.
    "sessions.pause": {"label": "Pause and resume sessions", "modules": ["monitoring"]},
    "sessions.terminate": {"label": "Terminate sessions", "modules": ["monitoring"]},
    "sessions.grade": {"label": "Grade submissions", "modules": ["exams", "sessions"]},
    # user management
    "users.view": {"label": "View users", "modules": ["user-mgmt"]},
    "users.create": {"label": "Create users", "modules": ["user-mgmt"]},
    "users.update": {"label": "Edit users and roles", "modules": ["user-mgmt"]},
    "users.reset-password": {"label": "Reset passwords", "modules": ["user-mgmt"]},
    "users.toggle-status": {"label": "Activate and deactivate users", "modules": ["user-mgmt"]},
    "users.archive": {"label": "Archive users", "modules": ["user-mgmt"]},
    "users.force-delete": {"label": "Permanently delete users", "modules": ["user-mgmt"]},
    # settings
    "settings.view": {"label": "View settings", "modules": ["settings"]},
    "settings.update": {"label": "Change settings", "modules": ["settings"]},
}

PERMISSIONS: set[str] = set(PERMISSION_META)

# Predefined action permissions per role. These are the *defaults* for the
# role-level configuration stored in ``authentication.RolePermission``: they
# are seeded for any (role, action) pair that has no row yet and used as the
# fallback while a row is missing, but an admin's edit to a role (a row) always
# wins. Every user of a role inherits the role's current configuration at
# request time; per-user grants/denies from Manage Access layer on top.
#
# Mapping rationale (Directive Area 01 - "Administrator responsibilities"):
# Guidance Staff and Teacher/Exam Creator (faculty) are the operational
# exam-creation roles; Program Head sits one level above them with approval
# authority; Proctor watches live sessions and acts on what it sees (pause,
# terminate, resolve flagged behavior) but builds no exams. Editing exams
# someone else created and deleting exams stay admin-only by default.
ROLE_DEFAULT_ACTIONS: dict[str, list[str]] = {
    "guidance_staff": [
        "exams.create",
        "exams.update",
        "monitoring.intervene",
        "behavior.resolve",
        "reports.export",
        "sessions.pause",
        "sessions.terminate",
        "sessions.grade",
    ],
    "program_head": [
        "exams.create",
        "exams.update",
        "exams.approve",
        "monitoring.intervene",
        "behavior.resolve",
        "reports.export",
        "sessions.pause",
        "sessions.terminate",
        "sessions.grade",
    ],
    "faculty": [
        "exams.create",
        "exams.update",
        "monitoring.intervene",
        "behavior.resolve",
        "reports.export",
        "sessions.pause",
        "sessions.grade",
    ],
    "proctor": [
        "monitoring.intervene",
        "behavior.resolve",
        "sessions.pause",
        "sessions.terminate",
    ],
    "student": [],
}
