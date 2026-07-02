import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("exams", "0005_questionattachment"),
    ]

    operations = [
        migrations.CreateModel(
            name="Department",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=255, unique=True)),
                (
                    "abbreviation",
                    models.CharField(
                        help_text="Short code used in exam identifiers (e.g. ENT, IIT)",
                        max_length=16,
                        unique=True,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "exams_department",
                "ordering": ["sort_order", "name"],
            },
        ),
        migrations.AddField(
            model_name="exam",
            name="department",
            field=models.ForeignKey(
                blank=True,
                help_text="Department that owns this exam (used for auto-generated codes)",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="exams",
                to="exams.department",
            ),
        ),
    ]
