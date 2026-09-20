"""Persist pipeline analysis results into behavior_logs and alerts."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.utils import timezone

from features.behavior.models import Alert, BehaviorLog


EVENT_TYPE_MAP = {
    "no_face": BehaviorLog.EventType.NO_FACE,
    "multiple_faces": BehaviorLog.EventType.MULTIPLE_FACES,
    "looking_away": BehaviorLog.EventType.LOOKING_AWAY,
    "bad_posture": BehaviorLog.EventType.BAD_POSTURE,
    "leaving_seat": BehaviorLog.EventType.LEAVING_SEAT,
    "identity_mismatch": BehaviorLog.EventType.IDENTITY_MISMATCH,
    "suspicious_pattern": BehaviorLog.EventType.SUSPICIOUS_PATTERN,
}

SEVERITY_MAP = {
    "low": Alert.Severity.LOW,
    "medium": Alert.Severity.MEDIUM,
    "high": Alert.Severity.HIGH,
}

# Skip duplicate logs/alerts of the same type within this window.
_EVENT_COOLDOWN_SECONDS = 30


def _recent_event_exists(session, event_type: str) -> bool:
    cutoff = timezone.now() - timedelta(seconds=_EVENT_COOLDOWN_SECONDS)
    return BehaviorLog.objects.filter(
        session=session,
        event_type=event_type,
        timestamp__gte=cutoff,
    ).exists()


def _recent_alert_exists(session, alert_type: str) -> bool:
    cutoff = timezone.now() - timedelta(seconds=_EVENT_COOLDOWN_SECONDS)
    return Alert.objects.filter(
        session=session,
        alert_type=alert_type,
        resolved=False,
        created_at__gte=cutoff,
    ).exists()


def _running_mean(prev_avg: float | None, count: int, value: float) -> float:
    """Fold ``value`` into a running mean of ``count`` prior samples.

    ``count`` is the number of samples already in ``prev_avg`` (0 on first
    sample). Returns the new mean after adding one sample.
    """
    if prev_avg is None or count <= 0:
        return value
    return prev_avg + (value - prev_avg) / (count + 1)


def record_frame_metrics(session, analysis: dict[str, Any]) -> bool:
    """Fold one frame's Exam Behavior Index into the session running means.

    Keeps ``ExamSession.ebi_average`` and the four component means exact and
    reproducible: each stored value is the arithmetic mean of that indicator
    over every analyzed frame. Face identity is averaged only over frames where
    it was actually evaluated (its own sample counter), mirroring the EBI's
    "identity not evaluated rather than zero" rule so a face-absence frame is
    never counted against identity.

    Returns ``True`` when the session row was updated.
    """
    metrics = analysis.get("metrics") or {}
    ebi = metrics.get("exam_behavior_index_pct")
    if ebi is None:
        ebi = analysis.get("exam_behavior_index_pct")
    if ebi is None:
        ebi = metrics.get("overall_compliance_pct")
    if ebi is None:
        return False

    components = metrics.get("ebi_components") or {}
    face = components.get("face_presence", metrics.get("face_presence_pct"))
    upper = components.get("upper_body_presence", metrics.get("posture_compliance_pct"))
    gaze = components.get("looking_away_compliance", metrics.get("gaze_focus_pct"))
    identity = components.get("face_identity", metrics.get("identity_match_pct"))

    n = session.ebi_sample_count or 0
    session.ebi_average = round(_running_mean(session.ebi_average, n, float(ebi)), 2)
    if face is not None:
        session.ebi_face_presence_avg = round(
            _running_mean(session.ebi_face_presence_avg, n, float(face)), 2
        )
    if upper is not None:
        session.ebi_upper_body_avg = round(
            _running_mean(session.ebi_upper_body_avg, n, float(upper)), 2
        )
    if gaze is not None:
        session.ebi_looking_away_avg = round(
            _running_mean(session.ebi_looking_away_avg, n, float(gaze)), 2
        )
    session.ebi_sample_count = n + 1

    update_fields = [
        "ebi_average",
        "ebi_face_presence_avg",
        "ebi_upper_body_avg",
        "ebi_looking_away_avg",
        "ebi_sample_count",
    ]

    if identity is not None:
        ni = session.ebi_identity_sample_count or 0
        session.ebi_face_identity_avg = round(
            _running_mean(session.ebi_face_identity_avg, ni, float(identity)), 2
        )
        session.ebi_identity_sample_count = ni + 1
        update_fields += ["ebi_face_identity_avg", "ebi_identity_sample_count"]

    session.save(update_fields=update_fields)
    return True


def persist_analysis(session, analysis: dict[str, Any]) -> dict[str, int]:
    """Store events and alerts from a frame analysis payload."""
    logs_created = 0
    alerts_created = 0

    record_frame_metrics(session, analysis)

    for event in analysis.get("events", []):
        raw_type = event.get("event_type", "")
        event_type = EVENT_TYPE_MAP.get(raw_type)
        if not event_type:
            continue
        if _recent_event_exists(session, event_type):
            continue
        score = float(event.get("score_pct", 0)) / 100.0
        confidence = float(event.get("confidence_pct", 0)) / 100.0
        BehaviorLog.objects.create(
            session=session,
            event_type=event_type,
            score=score,
            confidence=confidence,
            metadata=event.get("metadata") or {},
        )
        logs_created += 1

    for alert in analysis.get("alerts", []):
        alert_type = alert.get("type", "compliance")
        if _recent_alert_exists(session, alert_type):
            continue
        severity = SEVERITY_MAP.get(alert.get("severity", "medium"), Alert.Severity.MEDIUM)
        Alert.objects.create(
            session=session,
            alert_type=alert_type,
            severity=severity,
            message=alert.get("message", ""),
            metric_pct=alert.get("metric_pct"),
            resolved=bool(alert.get("resolved", False)),
        )
        alerts_created += 1

    return {"behavior_logs": logs_created, "alerts": alerts_created}
