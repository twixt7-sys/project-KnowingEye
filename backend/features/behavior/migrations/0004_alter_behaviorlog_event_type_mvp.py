# Generated manually for MVP behavior event types

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("behavior", "0003_alter_behaviorlog_event_type"),
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
                    ("object_detected", "Object Detected"),
                    ("identity_mismatch", "Identity Mismatch"),
                    ("suspicious_pattern", "Suspicious Pattern"),
                ],
                max_length=32,
            ),
        ),
    ]
