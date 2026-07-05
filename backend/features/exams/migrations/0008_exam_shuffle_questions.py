from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("exams", "0007_exam_monitoring_enabled"),
    ]

    operations = [
        migrations.AddField(
            model_name="exam",
            name="shuffle_questions",
            field=models.BooleanField(
                default=False,
                help_text="When enabled, each examinee receives questions in a randomized order",
            ),
        ),
    ]
