import uuid

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
