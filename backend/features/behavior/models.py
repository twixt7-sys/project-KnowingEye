import uuid

from django.db import models

from features.session.models import ExamSession


class BehaviorLog(models.Model):
    """AI-generated behavioral events for an exam session."""

    class EventType(models.TextChoices):
        NO_FACE = "no_face", "No Face Detected"
        MULTIPLE_FACES = "multiple_faces", "Multiple Faces"
        LOOKING_AWAY = "looking_away", "Looking Away"
        BAD_POSTURE = "bad_posture", "Bad Posture"
        OBJECT_DETECTED = "object_detected", "Object Detected"
        IDENTITY_MISMATCH = "identity_mismatch", "Identity Mismatch"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name="behavior_logs",
    )
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    score = models.FloatField(help_text="Compliance score 0.0–1.0 for this event")
    confidence = models.FloatField(default=0.0)
    metadata = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "behavior_log"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["session", "timestamp"]),
            models.Index(fields=["event_type"]),
        ]

    def __str__(self):
        return f"{self.session_id} — {self.event_type}"


class Alert(models.Model):
    """Flagged suspicious events raised during monitoring."""

    class Severity(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name="alerts",
    )
    alert_type = models.CharField(max_length=64)
    severity = models.CharField(max_length=16, choices=Severity.choices, default=Severity.MEDIUM)
    message = models.TextField()
    metric_pct = models.FloatField(null=True, blank=True)
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "behavior_alert"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["session", "created_at"]),
            models.Index(fields=["resolved"]),
        ]

    def __str__(self):
        return f"{self.session_id} — {self.alert_type} ({self.severity})"
