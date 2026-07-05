# Drop prohibited-object detection from behavior logs and alerts.

from django.db import migrations, models


def remove_object_detected_records(apps, schema_editor):
    BehaviorLog = apps.get_model("behavior", "BehaviorLog")
    Alert = apps.get_model("behavior", "Alert")
    BehaviorLog.objects.filter(event_type="object_detected").delete()
    Alert.objects.filter(alert_type="object_detected").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("behavior", "0006_add_object_detected_event_type"),
    ]

    operations = [
        migrations.RunPython(remove_object_detected_records, migrations.RunPython.noop),
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
