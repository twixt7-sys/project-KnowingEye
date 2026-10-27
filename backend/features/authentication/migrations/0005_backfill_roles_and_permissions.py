"""Data migration: EXAMINEE -> STUDENT, then backfill role-default action grants.

Runs the real (non-historical) permission-granting code from
``core.security.service`` rather than reimplementing it against migration
state, since Permission/ContentType are stable, unversioned infrastructure
models. This keeps the seeding logic in exactly one place.
"""

from django.db import migrations


def migrate_examinee_to_student(apps, schema_editor):
    User = apps.get_model('authentication', 'User')
    User.objects.filter(role='EXAMINEE').update(role='STUDENT')


def revert_student_to_examinee(apps, schema_editor):
    User = apps.get_model('authentication', 'User')
    User.objects.filter(role='STUDENT').update(role='EXAMINEE')


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
        ('authentication', '0004_expand_roles'),
    ]

    operations = [
        migrations.RunPython(migrate_examinee_to_student, revert_student_to_examinee),
        migrations.RunPython(backfill_role_default_permissions, noop_reverse),
    ]
