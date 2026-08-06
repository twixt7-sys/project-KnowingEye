"""RBAC + PBAC checks and grant/deny/revoke operations.

Storage: Django's built-in ``auth.Permission`` model, attached to the
``User`` content type and assigned via the existing ``user.user_permissions``
M2M. No new tables for the grants themselves - the same mechanism used by
Django admin already manages them. This mirrors OSAS's use of Spatie
permissions, just backed by Django's own auth machinery instead of a
third-party package.

Permission "codenames" (Django limits these to model-level uniqueness, no
dots) are derived from the dotted action/module names used everywhere else
in this package:

    "exams.create"          -> codename "action_exams_create"
    access to "monitoring"  -> codename "access_monitoring"
    deny of "monitoring"    -> codename "deny_monitoring"
"""

from __future__ import annotations

from django.contrib.auth import get_user_model

from .modules import MODULES
from .permissions_registry import PERMISSIONS, ROLE_DEFAULT_ACTIONS


def _content_type():
    from django.contrib.contenttypes.models import ContentType

    return ContentType.objects.get_for_model(get_user_model())


def _slug(value: str) -> str:
    return value.replace(".", "_").replace("-", "_")


def _action_codename(action: str) -> str:
    return f"action_{_slug(action)}"


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


def _perm_ref(codename: str) -> str:
    app_label = get_user_model()._meta.app_label
    return f"{app_label}.{codename}"


def can(user, action: str) -> bool:
    """Tier 3: can ``user`` perform ``action`` (e.g. ``"exams.update"``)?"""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_admin():
        return True
    return user.has_perm(_perm_ref(_action_codename(action)))


def has_module(user, module: str) -> bool:
    """Tier 2: can ``user`` see/enter ``module``?

    An explicit deny (set by an admin) always wins over role defaults and
    explicit grants.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_admin():
        return True
    if user.has_perm(_perm_ref(_module_deny_codename(module))):
        return False

    default_roles = MODULES.get(module, {}).get("roles", [])
    if user.role.lower() in default_roles:
        return True

    return user.has_perm(_perm_ref(_module_access_codename(module)))


def _invalidate_perm_cache(user) -> None:
    """Drop Django's per-instance permission cache after a grant/revoke.

    ``ModelBackend.get_all_permissions`` caches its result on the user
    instance the first time ``has_perm``/``can``/``has_module`` runs.
    ``user.user_permissions.add()``/``.remove()`` update the DB but don't
    know about that cache, so without this, a grant/revoke followed by an
    immediate check on the *same* Python object (exactly what the Manage
    Access endpoint does: mutate, then call ``list_user_access``) would
    silently return stale results.
    """
    for attr in ("_perm_cache", "_user_perm_cache", "_group_perm_cache"):
        if hasattr(user, attr):
            delattr(user, attr)


def grant_action(user, action: str, actor=None) -> None:
    perm = _action_permission(action)
    user.user_permissions.add(perm)
    _invalidate_perm_cache(user)
    _record_change(user, actor, f"action.{action}", "grant")


def revoke_action(user, action: str, actor=None) -> None:
    perm = _action_permission(action)
    user.user_permissions.remove(perm)
    _invalidate_perm_cache(user)
    _record_change(user, actor, f"action.{action}", "revoke")


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
    """Clear any explicit grant/deny, falling back to the role default."""
    user.user_permissions.remove(_module_access_permission(module))
    user.user_permissions.remove(_module_deny_permission(module))
    _invalidate_perm_cache(user)
    _record_change(user, actor, f"module.{module}", "revoke")


def _record_change(user, actor, permission: str, action: str) -> None:
    from features.authentication.models import PermissionChange

    PermissionChange.objects.create(
        target=user,
        actor=actor if actor is not None else user,
        permission=permission,
        action=action,
    )


def apply_role_defaults(user) -> None:
    """Grant the role's default action permissions, additively.

    Idempotent and non-destructive: never removes a grant an admin has
    customised, so revocations made from the Manage Access screen stick even
    if this is re-run (e.g. calling ``set_role`` again for the same role).
    A default is skipped if the most recent :class:`PermissionChange` record
    for it was a ``revoke`` - otherwise a re-run would silently undo the
    admin's revocation, which defeats the point of per-user delegation.
    """
    if user.is_admin():
        return
    defaults = ROLE_DEFAULT_ACTIONS.get(user.role.lower(), [])
    if not defaults:
        return

    from features.authentication.models import PermissionChange

    to_grant = []
    for action in defaults:
        last_change = (
            PermissionChange.objects.filter(target=user, permission=f"action.{action}")
            .order_by("-created_at")
            .first()
        )
        if last_change is not None and last_change.action == PermissionChange.Action.REVOKE:
            continue
        to_grant.append(_action_permission(action))

    if to_grant:
        user.user_permissions.add(*to_grant)
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
