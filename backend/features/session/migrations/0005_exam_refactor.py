# Generated manually for exam system refactor

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('exam_sessions', '0004_examsession_question_order'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='examsession',
            name='accommodation_extra_minutes',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='examsession',
            name='deadline_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='examsession',
            name='option_order',
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='examsession',
            name='status',
            field=models.CharField(
                choices=[
                    ('setup', 'Setup'),
                    ('in_progress', 'In Progress'),
                    ('pending_review', 'Pending Review'),
                    ('completed', 'Completed'),
                    ('terminated', 'Terminated'),
                    ('expired', 'Expired'),
                ],
                default='setup',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='response',
            name='autosaved_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='response',
            name='graded_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='response',
            name='graded_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='graded_responses',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='response',
            name='grader_comment',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='response',
            name='points_awarded',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='sessionlog',
            name='event_type',
            field=models.CharField(
                choices=[
                    ('started', 'Session Started'),
                    ('submitted', 'Session Submitted'),
                    ('terminated', 'Session Terminated'),
                    ('expired', 'Session Expired'),
                    ('resumed', 'Session Resumed'),
                    ('paused', 'Session Paused'),
                    ('exam_began', 'Exam Began'),
                    ('tab_hidden', 'Tab Hidden'),
                    ('tab_visible', 'Tab Visible'),
                    ('fullscreen_exit', 'Fullscreen Exit'),
                ],
                max_length=20,
            ),
        ),
    ]
