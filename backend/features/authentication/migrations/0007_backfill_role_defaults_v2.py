"""Data migration: seed the new exams.approve permission row and re-apply
role-default action grants for every non-admin user, now that
GUIDANCE_STAFF/PROGRAM_HEAD/PROCTOR exist and ROLE_DEFAULT_ACTIONS has
entries for them. Safe to re-run - apply_role_defaults is additive and
respects prior revocations (see core.security.service).
"""

from django.db import migrations


def backfill_role_default_permissions(apps, schema_editor):
    from core.security.service import apply_role_defaults, ensure_registry_permissions
    from django.contrib.auth import get_user_model

    ensure_registry_permissions()

    # .only() restricts the SELECT to columns that exist as of *this*
    # migration - querying the real (non-historical) model with a bare
    # .exclude()/full fetch would pull in every field the *current* code
    # defines, including ones added by migrations that haven't run yet when
    # this migration is replayed forward on a fresh database.
    User = get_user_model()
    for user in User.objects.only('pk', 'role').exclude(role='ADMIN'):
        apply_role_defaults(user)


def noop_reverse(apps, schema_editor):
    """Grants are additive and harmless to leave in place on rollback."""


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0006_expand_roles_v2'),
    ]

    operations = [
        migrations.RunPython(backfill_role_default_permissions, noop_reverse),
    ]
