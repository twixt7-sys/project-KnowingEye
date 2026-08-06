"""RBAC + PBAC enforcement layer.

Three tiers, mirroring the LCC OSAS System's proven pattern:

1. Role  - :mod:`core.security.drf` ``HasRole`` - "is this broadly an admin/
   faculty/student_assistant/student?"
2. Module access - ``MODULES`` registry + ``HasModuleAccess`` - "can this
   user see/enter this feature area?" Default audience comes from the
   module's ``roles`` list; an admin can grant ``access.<module>`` or revoke
   via ``deny.<module>`` per user.
3. Action permission - ``PERMISSIONS`` registry + ``HasPermission`` -
   "can this user perform this specific mutating action?" Granted per-user,
   seeded from ``ROLE_DEFAULT_ACTIONS`` on account creation, and revocable
   individually.
"""
