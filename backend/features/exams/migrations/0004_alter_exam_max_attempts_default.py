from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("exams", "0003_rename_exams_exam_exam_co_idx_exams_exam_exam_co_1362ff_idx_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="exam",
            name="max_attempts",
            field=models.PositiveIntegerField(
                default=1,
                help_text="Maximum completed attempts per examinee",
                validators=[django.core.validators.MinValueValidator(1)],
            ),
        ),
    ]
