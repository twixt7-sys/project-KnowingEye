import uuid

from django.conf import settings
from django.db import models

from features.session.models import ExamSession


class SessionIdentityReference(models.Model):
    """Enrolled reference face embedding for a single exam session.

    Stored once at session start (enrollment) and compared against every
    subsequent frame to verify the examinee's identity remains consistent
    (Objective 3.1 / 4.3). Keeping one reference *per session* avoids the
    cross-session contamination of a single process-global reference.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.OneToOneField(
        ExamSession,
        on_delete=models.CASCADE,
        related_name="identity_reference",
    )
    embedding = models.JSONField(
        default=list,
        help_text="Serialised reference face embedding (list of floats).",
    )
    backend = models.CharField(
        max_length=32,
        default="stub",
        help_text="Pipeline backend that produced the embedding (production/stub/disabled).",
    )
    dims = models.PositiveIntegerField(default=0, help_text="Embedding dimensionality.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "monitoring_identity_reference"
        verbose_name = "Session Identity Reference"
        verbose_name_plural = "Session Identity References"

    def __str__(self):
        return f"identity[{self.session_id}] dims={self.dims} ({self.backend})"


class SessionSnapshot(models.Model):
    """A proctoring still kept as evidence for an incident or a student dispute.

    Two kinds exist: a ``warning`` snapshot is the frame that raised one
    ``behavior.Alert``; ``termination`` snapshots are the last frames seen
    before a proctor ended the attempt, linked to its ``terminated``
    ``SessionLog`` entry. Every row also names the student, exam and session so
    evidence can be found without walking the alert chain.

    The JPEG lives in the database, not under ``MEDIA_ROOT``: media is served
    publicly by URL, and this must only ever be readable through the
    permission-checked endpoints in ``features.monitoring.snapshot_views``.
    """

    class Kind(models.TextChoices):
        WARNING = "warning", "Warning"
        TERMINATION = "termination", "Termination"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name="snapshots",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="evidence_snapshots",
        help_text="The examinee shown in the snapshot.",
    )
    exam = models.ForeignKey(
        "exams.Exam",
        on_delete=models.PROTECT,
        related_name="evidence_snapshots",
    )
    kind = models.CharField(max_length=16, choices=Kind.choices)
    alert = models.ForeignKey(
        "behavior.Alert",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="snapshots",
        help_text="The warning this frame triggered (warning snapshots).",
    )
    session_log = models.ForeignKey(
        "exam_sessions.SessionLog",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="snapshots",
        help_text="The termination record these frames belong to (termination snapshots).",
    )
    label = models.CharField(
        max_length=128,
        blank=True,
        help_text="What the frame was flagged for, e.g. the alert type.",
    )
    flags = models.JSONField(
        default=list,
        blank=True,
        help_text="Anomaly types the analysis reported for this frame.",
    )
    image = models.BinaryField(editable=False, help_text="JPEG bytes.")
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    captured_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "monitoring_session_snapshot"
        ordering = ["captured_at"]
        indexes = [
            models.Index(fields=["session", "kind", "captured_at"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"snapshot[{self.session_id}] {self.kind} @ {self.captured_at:%Y-%m-%d %H:%M:%S}"
