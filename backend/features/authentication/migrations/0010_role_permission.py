"""Role-level permissions: add ``RolePermission``, seed each role's defaults,
and turn the per-user copies of role defaults back into inheritance.

Before this, a role's default actions were *copied* onto each user when the
account was created or its role changed, so nothing an admin later changed
reached existing users, and a role change kept the old role's grants. From
here on users inherit their role's configuration live (see
``core.security.service``), and ``user.user_permissions`` only holds an
admin's per-user overrides:

* a grant an admin made from Manage Access (latest ``PermissionChange`` for
  it is a ``grant``) stays an explicit grant;
* an action an admin revoked (latest record is a ``revoke``) becomes an
  explicit deny, so it stays off even though the role grants it;
* any other direct action grant was a seeded copy and is removed - the user
  now gets it (or not) from their role.

Role rows are only created where missing, so re-running never overwrites an
admin's edits.
"""

from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


CONFIGURABLE_ROLES = ["GUIDANCE_STAFF", "PROGRAM_HEAD", "FACULTY", "PROCTOR", "STUDENT"]


def _slug(value):
    return value.replace(".", "_").replace("-", "_")


def _user_content_type(apps):
    ContentType = apps.get_model("contenttypes", "ContentType")
    ct, _ = ContentType.objects.get_or_create(app_label="authentication", model="user")
    return ct


def seed_role_permissions(apps, schema_editor):
    from core.security.service import role_defaults

    RolePermission = apps.get_model("authentication", "RolePermission")
    existing = set(RolePermission.objects.values_list("role", "permission"))
    RolePermission.objects.bulk_create(
        [
            RolePermission(role=role, permission=perm, granted=granted)
            for role in CONFIGURABLE_ROLES
            for perm, granted in role_defaults(role).items()
            if (role, perm) not in existing
        ]
    )


def convert_user_action_grants(apps, schema_editor):
    from core.security.permissions_registry import PERMISSIONS

    Permission = apps.get_model("auth", "Permission")
    PermissionChange = apps.get_model("authentication", "PermissionChange")
    User = apps.get_model("authentication", "User")
    ct = _user_content_type(apps)

    for action in sorted(PERMISSIONS):
        grant = Permission.objects.filter(codename=f"action_{_slug(action)}", content_type=ct).first()
        deny, _ = Permission.objects.get_or_create(
            codename=f"deny_action_{_slug(action)}",
            content_type=ct,
            defaults={"name": f"Deny action: {action}"},
        )

        latest = {}
        for target_id, change in (
            PermissionChange.objects.filter(permission=f"action.{action}")
            .order_by("target_id", "-created_at", "-id")
            .values_list("target_id", "action")
        ):
            latest.setdefault(target_id, change)

        holders = set()
        if grant is not None:
            holders = set(
                User.objects.filter(user_permissions=grant).exclude(role="ADMIN").values_list("pk", flat=True)
            )

        for user in User.objects.filter(pk__in=holders | set(latest)).exclude(role="ADMIN"):
            change = latest.get(user.pk)
            if change == "revoke":
                if grant is not None:
                    user.user_permissions.remove(grant)
                user.user_permissions.add(deny)
            elif change == "grant":
                continue
            elif grant is not None:
                user.user_permissions.remove(grant)


def restore_user_action_grants(apps, schema_editor):
    """Reverse: copy each user's role configuration back onto them as direct grants."""
    from core.security.permissions_registry import PERMISSIONS

    Permission = apps.get_model("auth", "Permission")
    RolePermission = apps.get_model("authentication", "RolePermission")
    User = apps.get_model("authentication", "User")
    ct = _user_content_type(apps)

    for action in sorted(PERMISSIONS):
        deny = Permission.objects.filter(codename=f"deny_action_{_slug(action)}", content_type=ct).first()
        grant, _ = Permission.objects.get_or_create(
            codename=f"action_{_slug(action)}",
            content_type=ct,
            defaults={"name": f"Can perform action: {action}"},
        )
        roles = set(
            RolePermission.objects.filter(permission=f"action.{action}", granted=True).values_list("role", flat=True)
        )
        for user in User.objects.exclude(role="ADMIN"):
            denied = deny is not None and user.user_permissions.filter(pk=deny.pk).exists()
            if deny is not None:
                user.user_permissions.remove(deny)
            if user.role in roles and not denied:
                user.user_permissions.add(grant)


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0009_audit_trail_indexes"),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [
        migrations.CreateModel(
            name="RolePermission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("ADMIN", "Administrator"),
                            ("GUIDANCE_STAFF", "Guidance Staff"),
                            ("PROGRAM_HEAD", "Program Head"),
                            ("FACULTY", "Teacher / Exam Creator"),
                            ("PROCTOR", "Proctor"),
                            ("STUDENT", "Examinee"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "permission",
                    models.CharField(
                        help_text="'module.<module>' or 'action.<action>', e.g. 'action.exams.update'",
                        max_length=100,
                    ),
                ),
                ("granted", models.BooleanField(default=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="role_permission_changes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "authentication_role_permission",
                "ordering": ["role", "permission"],
                "constraints": [
                    models.UniqueConstraint(fields=("role", "permission"), name="uniq_role_permission")
                ],
            },
        ),
        migrations.RunPython(seed_role_permissions, migrations.RunPython.noop),
        migrations.RunPython(convert_user_action_grants, restore_user_action_grants),
    ]
