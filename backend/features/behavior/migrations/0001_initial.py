import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("exam_sessions", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="BehaviorLog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "event_type",
                    models.CharField(
                        choices=[
                            ("no_face", "No Face Detected"),
                            ("multiple_faces", "Multiple Faces"),
                            ("looking_away", "Looking Away"),
                            ("bad_posture", "Bad Posture"),
                            ("object_detected", "Object Detected"),
                        ],
                        max_length=32,
                    ),
                ),
                ("score", models.FloatField(help_text="Compliance score 0.0–1.0 for this event")),
                ("confidence", models.FloatField(default=0.0)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("timestamp", models.DateTimeField(auto_now_add=True)),
                (
                    "session",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="behavior_logs",
                        to="exam_sessions.examsession",
                    ),
                ),
            ],
            options={
                "db_table": "behavior_log",
                "ordering": ["-timestamp"],
            },
        ),
        migrations.CreateModel(
            name="Alert",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("alert_type", models.CharField(max_length=64)),
                (
                    "severity",
                    models.CharField(
                        choices=[("low", "Low"), ("medium", "Medium"), ("high", "High")],
                        default="medium",
                        max_length=16,
                    ),
                ),
                ("message", models.TextField()),
                ("metric_pct", models.FloatField(blank=True, null=True)),
                ("resolved", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "session",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="alerts",
                        to="exam_sessions.examsession",
                    ),
                ),
            ],
            options={
                "db_table": "behavior_alert",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="behaviorlog",
            index=models.Index(fields=["session", "timestamp"], name="behavior_lo_session_6e2e0a_idx"),
        ),
        migrations.AddIndex(
            model_name="behaviorlog",
            index=models.Index(fields=["event_type"], name="behavior_lo_event_t_8f3b2c_idx"),
        ),
        migrations.AddIndex(
            model_name="alert",
            index=models.Index(fields=["session", "created_at"], name="behavior_al_session_4a1c9d_idx"),
        ),
        migrations.AddIndex(
            model_name="alert",
            index=models.Index(fields=["resolved"], name="behavior_al_resolve_2b7e1a_idx"),
        ),
    ]
