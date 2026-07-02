from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("exams", "0006_department_and_exam_fk"),
    ]

    operations = [
        migrations.AddField(
            model_name="exam",
            name="monitoring_enabled",
            field=models.BooleanField(
                default=True,
                help_text="When enabled, examinees complete proctoring setup and webcam monitoring during the exam",
            ),
        ),
    ]
