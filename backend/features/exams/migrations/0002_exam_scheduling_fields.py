from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("exams", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="exam",
            name="available_from",
            field=models.DateTimeField(
                blank=True,
                help_text="When examinees may start the exam (null = immediately when active)",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="exam",
            name="available_until",
            field=models.DateTimeField(
                blank=True,
                help_text="Last moment examinees may start the exam",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="exam",
            name="exam_code",
            field=models.CharField(
                blank=True,
                help_text="Institutional exam code (e.g. ENT-2026-A)",
                max_length=32,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name="exam",
            name="max_attempts",
            field=models.PositiveIntegerField(
                default=1,
                help_text="Maximum completed attempts per examinee",
                validators=[django.core.validators.MinValueValidator(1)],
            ),
        ),
        migrations.AddIndex(
            model_name="exam",
            index=models.Index(fields=["exam_code"], name="exams_exam_exam_co_idx"),
        ),
        migrations.AddIndex(
            model_name="exam",
            index=models.Index(
                fields=["available_from", "available_until"],
                name="exams_exam_avail_idx",
            ),
        ),
    ]
