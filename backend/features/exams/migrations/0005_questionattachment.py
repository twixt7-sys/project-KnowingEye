# Generated manually for question attachments

import features.exams.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("exams", "0004_alter_exam_max_attempts_default"),
    ]

    operations = [
        migrations.CreateModel(
            name="QuestionAttachment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to=features.exams.models._question_attachment_path)),
                ("kind", models.CharField(choices=[("image", "Image"), ("pdf", "PDF"), ("audio", "Audio")], max_length=16)),
                ("caption", models.CharField(blank=True, default="", max_length=255)),
                ("order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "question",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="attachments",
                        to="exams.question",
                    ),
                ),
            ],
            options={
                "db_table": "exams_question_attachment",
                "ordering": ["order", "id"],
            },
        ),
    ]
