"""Module access registry (Tier 2).

Single source of truth for which roles see which feature areas by default.
Mirrors OSAS ``config/osas.php['modules']``. Role keys are lowercase to match
``User.role.lower()``; ``User.Role`` values themselves stay uppercase for
backwards compatibility with the existing database column.

A module with an empty ``roles`` list is admin / explicit-grant only.
``student`` marks modules that are part of the student-facing workspace
(mirrors OSAS's ``student`` flag, used to keep student-only modules out of
the staff nav).
"""

from __future__ import annotations

MODULES: dict[str, dict] = {
    "dashboard": {
        "label": "Dashboard",
        "roles": ["admin", "faculty", "student_assistant"],
    },
    "exams": {
        "label": "Exam Management",
        "roles": ["admin", "faculty"],
    },
    "monitoring": {
        "label": "Live Monitoring",
        "roles": ["admin", "faculty", "student_assistant"],
    },
    "behavior": {
        "label": "Behavior Events",
        "roles": ["admin", "faculty", "student_assistant"],
    },
    "reports": {
        "label": "Reports",
        "roles": ["admin", "faculty", "student_assistant"],
    },
    "sessions": {
        "label": "Exam Sessions",
        "roles": ["admin", "faculty"],
    },
    "user-mgmt": {
        "label": "User Management",
        "roles": ["admin"],
    },
    "settings": {
        "label": "System Settings",
        "roles": ["admin"],
    },
    "my-exams": {
        "label": "My Exams",
        "roles": ["student"],
        "student": True,
    },
    "my-results": {
        "label": "My Results",
        "roles": ["student"],
        "student": True,
    },
    "my-profile": {
        "label": "My Profile",
        "roles": ["student", "student_assistant", "faculty", "admin"],
    },
}
