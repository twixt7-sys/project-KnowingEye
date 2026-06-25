# Generated manually for proctoring setup phase

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("exam_sessions", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="examsession",
            name="exam_started_at",
            field=models.DateTimeField(
                blank=True,
                help_text="When the examinee began the timed exam portion",
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="examsession",
            name="started_at",
            field=models.DateTimeField(
                auto_now_add=True,
                help_text="When the session record was created",
            ),
        ),
        migrations.AlterField(
            model_name="examsession",
            name="status",
            field=models.CharField(
                choices=[
                    ("setup", "Setup"),
                    ("in_progress", "In Progress"),
                    ("completed", "Completed"),
                    ("terminated", "Terminated"),
                    ("expired", "Expired"),
                ],
                default="setup",
                help_text="Current session status",
                max_length=20,
            ),
        ),
        migrations.RemoveConstraint(
            model_name="examsession",
            name="unique_active_session_per_exam_user",
        ),
        migrations.AddConstraint(
            model_name="examsession",
            constraint=models.UniqueConstraint(
                condition=models.Q(("status__in", ["in_progress", "setup"])),
                fields=("exam", "user"),
                name="unique_active_session_per_exam_user",
            ),
        ),
        migrations.AlterField(
            model_name="sessionlog",
            name="event_type",
            field=models.CharField(
                choices=[
                    ("started", "Session Started"),
                    ("submitted", "Session Submitted"),
                    ("terminated", "Session Terminated"),
                    ("expired", "Session Expired"),
                    ("resumed", "Session Resumed"),
                    ("paused", "Session Paused"),
                    ("exam_began", "Exam Began"),
                ],
                help_text="Type of session event",
                max_length=20,
            ),
        ),
    ]
