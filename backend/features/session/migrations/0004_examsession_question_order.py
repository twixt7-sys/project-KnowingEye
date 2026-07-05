from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("exam_sessions", "0003_one_active_session_per_user"),
    ]

    operations = [
        migrations.AddField(
            model_name="examsession",
            name="question_order",
            field=models.JSONField(
                blank=True,
                help_text="Question IDs in the order presented to this examinee (set when the exam begins)",
                null=True,
            ),
        ),
    ]
