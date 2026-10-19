from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('exams', '0019_alter_examapprovalevent_action'),
    ]

    operations = [
        migrations.AddField(
            model_name='exam',
            name='exclude_completed_examinees',
            field=models.BooleanField(
                default=False,
                help_text=(
                    'When true, examinees who already completed this exam are excluded: '
                    'they cannot start it again regardless of max_attempts, and are skipped '
                    'when candidates are added to the roster'
                ),
            ),
        ),
    ]
