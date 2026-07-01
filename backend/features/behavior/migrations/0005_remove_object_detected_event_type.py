# Drop the prohibited-object detection event type from behavior logs.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("behavior", "0004_alter_behaviorlog_event_type_mvp"),
    ]

    operations = [
        migrations.AlterField(
            model_name="behaviorlog",
            name="event_type",
            field=models.CharField(
                choices=[
                    ("no_face", "No Face Detected"),
                    ("multiple_faces", "Multiple Faces"),
                    ("looking_away", "Looking Away"),
                    ("bad_posture", "Bad Posture"),
                    ("leaving_seat", "Leaving Seat"),
                    ("identity_mismatch", "Identity Mismatch"),
                    ("suspicious_pattern", "Suspicious Pattern"),
                ],
                max_length=32,
            ),
        ),
    ]
