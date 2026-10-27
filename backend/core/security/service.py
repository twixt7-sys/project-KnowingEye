"""RBAC + PBAC checks and grant/deny/revoke operations.

Two layers decide what a non-admin user may do, evaluated on every check
(nothing is copied onto the user or cached across requests, so an admin's
change applies on the user's next request):

1. **Role configuration** - ``authentication.RolePermission`` rows, one per
   (role, ``module.<m>``/``action.<a>``), edited from the Role Permissions
   screen. A missing row falls back to the code defaults in
   :data:`core.security.modules.MODULES` / :data:`ROLE_DEFAULT_ACTIONS`.
2. **Per-user overrides** - Django's built-in ``auth.Permission`` attached to
   the ``User`` content type via ``user.user_permissions``, set from the
   Manage Access screen. An explicit deny beats an explicit grant, which
   beats the role configuration.

Permission "codenames" (Django limits these to model-level uniqueness, no
dots) are derived from the dotted action/module names used everywhere else
in this package:

    grant of "exams.create" -> codename "action_exams_create"
    deny of "exams.create"  -> codename "deny_action_exams_create"
    grant of "monitoring"   -> codename "access_monitoring"
    deny of "monitoring"    -> codename "deny_monitoring"
"""

from __future__ import annotations

from django.contrib.auth import get_user_model

from .modules import MODULES
from .permissions_registry import PERMISSION_META, PERMISSIONS, ROLE_DEFAULT_ACTIONS


def _content_type():
    from django.contrib.contenttypes.models import ContentType

    return ContentType.objects.get_for_model(get_user_model())


def _slug(value: str) -> str:
    return value.replace(".", "_").replace("-", "_")


def _action_codename(action: str) -> str:
    return f"action_{_slug(action)}"


def _action_deny_codename(action: str) -> str:
    return f"deny_action_{_slug(action)}"


def _module_access_codename(module: str) -> str:
    return f"access_{_slug(module)}"


def _module_deny_codename(module: str) -> str:
    return f"deny_{_slug(module)}"


def _get_or_create_permission(codename: str, name: str):
    from django.contrib.auth.models import Permission

    perm, _created = Permission.objects.get_or_create(
        codename=codename,
        content_type=_content_type(),
        defaults={"name": name[:255]},
    )
    return perm


def _action_permission(action: str):
    return _get_or_create_permission(_action_codename(action), f"Can perform action: {action}")


def _action_deny_permission(action: str):
    return _get_or_create_permission(_action_deny_codename(action), f"Deny action: {action}")


def _module_access_permission(module: str):
    label = MODULES.get(module, {}).get("label", module)
    return _get_or_create_permission(_module_access_codename(module), f"Access module: {label}")


def _module_deny_permission(module: str):
    label = MODULES.get(module, {}).get("label", module)
    return _get_or_create_permission(_module_deny_codename(module), f"Deny module: {label}")


def ensure_registry_permissions() -> None:
    """Create Permission rows for every entry in MODULES/PERMISSIONS.

    Idempotent. Called from a post_migrate signal so newly added registry
    entries always have a backing Permission row before anyone tries to
    grant them.
    """
    for module in MODULES:
        _module_access_permission(module)
        _module_deny_permission(module)
    for action in PERMISSIONS:
        _action_permission(action)
        _action_deny_permission(action)


def _perm_ref(codename: str) -> str:
    app_label = get_user_model()._meta.app_label
    return f"{app_label}.{codename}"


# --- Role configuration -------------------------------------------------------


def _role_key(role: str) -> str:
    """``User.Role`` value (``"FACULTY"``) -> registry key (``"faculty"``)."""
    return (role or "").lower()


def configurable_roles() -> list[str]:
    """Every role whose permissions an admin can edit (admin itself can't be narrowed)."""
    User = get_user_model()
    return [value for value, _label in User.Role.choices if value != User.Role.ADMIN]


def role_defaults(role: str) -> dict[str, bool]:
    """The predefined module/action set for ``role``, keyed ``module.<m>``/``action.<a>``."""
    key = _role_key(role)
    defaults = {f"module.{m}": key in meta.get("roles", []) for m, meta in MODULES.items()}
    granted_actions = set(ROLE_DEFAULT_ACTIONS.get(key, []))
    defaults.update({f"action.{a}": a in granted_actions for a in PERMISSIONS})
    return defaults


def role_access(role: str) -> dict[str, bool]:
    """``role``'s current configuration: stored rows over the code defaults."""
    from features.authentication.models import RolePermission

    config = role_defaults(role)
    rows = RolePermission.objects.filter(role=(role or "").upper()).values_list(
        "permission", "granted"
    )
    config.update({perm: granted for perm, granted in rows if perm in config})
    return config


def _role_access_for(user) -> dict[str, bool]:
    """``role_access`` for ``user``'s role, memoised on the instance.

    Same lifetime as Django's ``_perm_cache``: one request, since DRF loads a
    fresh user per request. Keyed by role so a ``set_role`` on the same
    instance isn't served the previous role's set.
    """
    cached = getattr(user, "_role_access_cache", None)
    if cached is not None and cached[0] == user.role:
        return cached[1]
    config = role_access(user.role)
    user._role_access_cache = (user.role, config)
    return config


def ensure_role_defaults(roles=None) -> int:
    """Seed missing (role, permission) rows from the code defaults.

    Never touches an existing row, so an admin's edits survive re-runs,
    deploys and new registry entries. Returns how many rows were created.
    Called from post_migrate, the data migration, and whenever a user is
    created or assigned a role.
    """
    from features.authentication.models import RolePermission

    roles = configurable_roles() if roles is None else [r.upper() for r in roles]
    User = get_user_model()
    roles = [r for r in roles if r != User.Role.ADMIN]
    existing = set(
        RolePermission.objects.filter(role__in=roles).values_list("role", "permission")
    )
    missing = [
        RolePermission(role=role, permission=perm, granted=granted)
        for role in roles
        for perm, granted in role_defaults(role).items()
        if (role, perm) not in existing
    ]
    RolePermission.objects.bulk_create(missing, ignore_conflicts=True)
    return len(missing)


def _module_dependants(module: str) -> list[str]:
    return [a for a, meta in PERMISSION_META.items() if module in meta.get("modules", [])]


def set_role_permissions(role: str, modules: dict, actions: dict, actor=None) -> dict[str, bool]:
    """Apply an admin's edit to ``role`` and return its resulting configuration.

    ``modules``/``actions`` map a key to ``True``/``False``; unknown keys are
    ignored. Dependencies are kept consistent so the result is usable:
    turning an action on turns on the modules it needs, and turning a module
    off turns off the actions that need it.
    """
    from features.authentication.models import RolePermission

    role = role.upper()
    current = role_access(role)
    new = dict(current)
    for module, enabled in (modules or {}).items():
        if module in MODULES:
            new[f"module.{module}"] = bool(enabled)
    for action, enabled in (actions or {}).items():
        if action in PERMISSIONS:
            new[f"action.{action}"] = bool(enabled)

    for module in MODULES:
        if current[f"module.{module}"] and not new[f"module.{module}"]:
            for action in _module_dependants(module):
                new[f"action.{action}"] = False
    for action in PERMISSIONS:
        if new[f"action.{action}"] and not current[f"action.{action}"]:
            for module in PERMISSION_META[action].get("modules", []):
                new[f"module.{module}"] = True

    for perm, granted in new.items():
        RolePermission.objects.update_or_create(
            role=role,
            permission=perm,
            defaults={"granted": granted, "updated_by": actor},
        )
    return new


# --- Checks -------------------------------------------------------------------


def can(user, action: str) -> bool:
    """Tier 3: can ``user`` perform ``action`` (e.g. ``"exams.update"``)?"""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_admin():
        return True
    if user.has_perm(_perm_ref(_action_deny_codename(action))):
        return False
    if user.has_perm(_perm_ref(_action_codename(action))):
        return True
    return _role_access_for(user).get(f"action.{action}", False)


def has_module(user, module: str) -> bool:
    """Tier 2: can ``user`` see/enter ``module``?

    An explicit per-user deny always wins over the role configuration and
    explicit grants.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_admin():
        return True
    if user.has_perm(_perm_ref(_module_deny_codename(module))):
        return False
    if user.has_perm(_perm_ref(_module_access_codename(module))):
        return True
    return _role_access_for(user).get(f"module.{module}", False)


# --- Per-user overrides ---------------------------------------------------------


def _invalidate_perm_cache(user) -> None:
    """Drop the per-instance permission caches after a grant/revoke.

    ``ModelBackend.get_all_permissions`` caches its result on the user
    instance the first time ``has_perm``/``can``/``has_module`` runs.
    ``user.user_permissions.add()``/``.remove()`` update the DB but don't
    know about that cache, so without this, a grant/revoke followed by an
    immediate check on the *same* Python object (exactly what the Manage
    Access endpoint does: mutate, then call ``list_user_access``) would
    silently return stale results.
    """
    for attr in ("_perm_cache", "_user_perm_cache", "_group_perm_cache", "_role_access_cache"):
        if hasattr(user, attr):
            delattr(user, attr)


def grant_action(user, action: str, actor=None) -> None:
    """Explicitly grant ``action`` to ``user``, whatever their role says."""
    user.user_permissions.remove(_action_deny_permission(action))
    user.user_permissions.add(_action_permission(action))
    _invalidate_perm_cache(user)
    _record_change(user, actor, f"action.{action}", "grant")


def revoke_action(user, action: str, actor=None) -> None:
    """Explicitly deny ``action`` to ``user``, whatever their role says."""
    user.user_permissions.remove(_action_permission(action))
    user.user_permissions.add(_action_deny_permission(action))
    _invalidate_perm_cache(user)
    _record_change(user, actor, f"action.{action}", "deny")


def clear_action_override(user, action: str, actor=None) -> None:
    """Drop any explicit grant/deny, falling back to the role configuration."""
    user.user_permissions.remove(_action_permission(action))
    user.user_permissions.remove(_action_deny_permission(action))
    _invalidate_perm_cache(user)
    _record_change(user, actor, f"action.{action}", "revoke")


def set_user_action(user, action: str, enabled, actor=None) -> None:
    """Make ``user``'s effective ``action`` match ``enabled`` with the least override.

    An override is only stored where the user differs from their role, so a
    user whose toggle matches the role keeps following later role edits.
    ``None`` clears the override.
    """
    if enabled is None or bool(enabled) == _role_access_for(user).get(f"action.{action}", False):
        clear_action_override(user, action, actor=actor)
    elif enabled:
        grant_action(user, action, actor=actor)
    else:
        revoke_action(user, action, actor=actor)


def grant_module_access(user, module: str, actor=None) -> None:
    user.user_permissions.remove(_module_deny_permission(module))
    user.user_permissions.add(_module_access_permission(module))
    _invalidate_perm_cache(user)
    _record_change(user, actor, f"module.{module}", "grant")


def deny_module_access(user, module: str, actor=None) -> None:
    user.user_permissions.remove(_module_access_permission(module))
    user.user_permissions.add(_module_deny_permission(module))
    _invalidate_perm_cache(user)
    _record_change(user, actor, f"module.{module}", "deny")


def revoke_module_override(user, module: str, actor=None) -> None:
    """Clear any explicit grant/deny, falling back to the role configuration."""
    user.user_permissions.remove(_module_access_permission(module))
    user.user_permissions.remove(_module_deny_permission(module))
    _invalidate_perm_cache(user)
    _record_change(user, actor, f"module.{module}", "revoke")


def set_user_module(user, module: str, state, actor=None) -> None:
    """``state`` is ``"grant"``/``"deny"``/``None``; stores an override only where needed."""
    role_on = _role_access_for(user).get(f"module.{module}", False)
    if state is None or (state == "grant") == role_on:
        revoke_module_override(user, module, actor=actor)
    elif state == "grant":
        grant_module_access(user, module, actor=actor)
    else:
        deny_module_access(user, module, actor=actor)


def user_overrides(user) -> dict:
    """The explicit per-user grants/denies, for the Manage Access screen."""
    perms = {p.codename for p in user.user_permissions.all()}
    modules = {}
    for module in MODULES:
        if _module_deny_codename(module) in perms:
            modules[module] = "deny"
        elif _module_access_codename(module) in perms:
            modules[module] = "grant"
    actions = {}
    for action in PERMISSIONS:
        if _action_deny_codename(action) in perms:
            actions[action] = "deny"
        elif _action_codename(action) in perms:
            actions[action] = "grant"
    return {"modules": modules, "actions": actions}


def _record_change(user, actor, permission: str, action: str) -> None:
    from features.authentication.models import PermissionChange

    PermissionChange.objects.create(
        target=user,
        actor=actor if actor is not None else user,
        permission=permission,
        action=action,
    )


def apply_role_defaults(user) -> None:
    """Make sure ``user``'s role has its predefined permissions configured.

    Users inherit their role's permissions live, so nothing is copied onto
    the user any more (copies are what made later role edits not apply, and
    what let a role change keep the old role's grants). This only seeds the
    role's missing rows; existing rows - including an admin's edits - are
    left alone. Safe to call repeatedly.
    """
    if user.is_admin():
        return
    ensure_role_defaults([user.role])
    _invalidate_perm_cache(user)


def list_user_access(user) -> dict:
    """Build the payload for ``GET /api/auth/access-map/``."""
    if not user or not getattr(user, "is_authenticated", False):
        return {"role": None, "modules": [], "permissions": []}

    modules = [m for m in MODULES if has_module(user, m)]
    permissions = list(PERMISSIONS) if user.is_admin() else [p for p in PERMISSIONS if can(user, p)]

    return {
        "role": user.role,
        "modules": sorted(modules),
        "permissions": sorted(permissions),
    }
