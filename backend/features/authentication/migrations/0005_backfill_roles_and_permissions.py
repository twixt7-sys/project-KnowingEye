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
    from core.security.service import apply_role_defaults, ensure_registry_permissions
    from django.contrib.auth import get_user_model

    ensure_registry_permissions()

    User = get_user_model()
    for user in User.objects.exclude(role='ADMIN'):
        apply_role_defaults(user)


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
