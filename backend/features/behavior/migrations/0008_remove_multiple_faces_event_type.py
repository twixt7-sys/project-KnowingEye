# Drop multiple-face detection from the selectable behavior event types.
#
# Schema-only: existing multiple_faces rows are kept as historical records of
# past sessions (event_type is a plain varchar, so they remain readable).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("behavior", "0007_remove_object_detected_event_type"),
    ]

    operations = [
        migrations.AlterField(
            model_name="behaviorlog",
            name="event_type",
            field=models.CharField(
                choices=[
                    ("no_face", "No Face Detected"),
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
