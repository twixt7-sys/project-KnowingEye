"""Six-role expansion: add GUIDANCE_STAFF, PROGRAM_HEAD, PROCTOR.

Per the Capstone Defense Revision Directive, Area 01 ("Role-based access
control"): Administrator, Guidance Staff, Program Head, Teacher/Exam
Creator, Proctor, Examinee. ``PROCTOR`` absorbs the old
``STUDENT_ASSISTANT`` role - existing rows are migrated, not deleted.
"""

from django.db import migrations, models


def migrate_student_assistant_to_proctor(apps, schema_editor):
    User = apps.get_model('authentication', 'User')
    User.objects.filter(role='STUDENT_ASSISTANT').update(role='PROCTOR')


def revert_proctor_to_student_assistant(apps, schema_editor):
    User = apps.get_model('authentication', 'User')
    User.objects.filter(role='PROCTOR').update(role='STUDENT_ASSISTANT')


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0005_backfill_roles_and_permissions'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('ADMIN', 'Administrator'),
                    ('GUIDANCE_STAFF', 'Guidance Staff'),
                    ('PROGRAM_HEAD', 'Program Head'),
                    ('FACULTY', 'Teacher / Exam Creator'),
                    ('PROCTOR', 'Proctor'),
                    ('STUDENT', 'Examinee'),
                ],
                default='STUDENT',
                help_text='User role: ADMIN, GUIDANCE_STAFF, PROGRAM_HEAD, FACULTY, PROCTOR, or STUDENT',
                max_length=20,
            ),
        ),
        migrations.RunPython(
            migrate_student_assistant_to_proctor,
            revert_proctor_to_student_assistant,
        ),
    ]
