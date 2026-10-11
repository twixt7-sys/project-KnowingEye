from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('exams', '0017_audit_trail_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='exam',
            name='previous_status',
            field=models.CharField(blank=True, choices=[('draft', 'Draft'), ('active', 'Active'), ('archived', 'Archived')], default='', help_text='Status held before archiving, so unarchiving can restore it', max_length=20),
        ),
    ]
