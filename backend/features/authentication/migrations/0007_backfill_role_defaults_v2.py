"""Data migration: seed the new exams.approve permission row and re-apply
role-default action grants for every non-admin user, now that
GUIDANCE_STAFF/PROGRAM_HEAD/PROCTOR exist and ROLE_DEFAULT_ACTIONS has
entries for them. Safe to re-run - apply_role_defaults is additive and
respects prior revocations (see core.security.service).
"""

from django.db import migrations


def backfill_role_default_permissions(apps, schema_editor):
    # Used to copy each role's default actions onto every user. Users now
    # inherit their role's permissions live (0010_role_permission seeds the
    # role configuration and converts earlier copies), so on a fresh
    # database only the Permission rows are needed here.
    from core.security.service import ensure_registry_permissions

    ensure_registry_permissions()


def noop_reverse(apps, schema_editor):
    """Grants are additive and harmless to leave in place on rollback."""


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0006_expand_roles_v2'),
    ]

    operations = [
        migrations.RunPython(backfill_role_default_permissions, noop_reverse),
    ]
