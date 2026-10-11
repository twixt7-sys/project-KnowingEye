from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('exams', '0017_audit_trail_indexes'),
    ]

    operations = [
        migrations.AlterField(
            model_name='examapprovalevent',
            name='action',
            field=models.CharField(
                choices=[
                    ('submit', 'Submitted for review'),
                    ('approve', 'Approved'),
                    ('reject', 'Rejected'),
                    ('unpublish', 'Unpublished'),
                ],
                max_length=10,
            ),
        ),
    ]
