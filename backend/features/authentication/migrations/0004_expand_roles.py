from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('authentication', '0003_rename_auth_user_role_idx_authenticat_role_7fb088_idx_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('ADMIN', 'Administrator'),
                    ('FACULTY', 'Faculty'),
                    ('STUDENT_ASSISTANT', 'Student Assistant'),
                    ('STUDENT', 'Student'),
                ],
                default='STUDENT',
                help_text='User role: ADMIN, FACULTY, STUDENT_ASSISTANT, or STUDENT',
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name='PermissionChange',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('permission', models.CharField(help_text="e.g. 'module.exams' or 'action.exams.create'", max_length=100)),
                ('action', models.CharField(choices=[('grant', 'Grant'), ('deny', 'Deny'), ('revoke', 'Revoke')], max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='permission_changes_made', to=settings.AUTH_USER_MODEL)),
                ('target', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='permission_changes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'authentication_permission_change',
                'ordering': ['-created_at'],
            },
        ),
    ]
