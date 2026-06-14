"""Persist pipeline analysis results into behavior_logs and alerts."""

from __future__ import annotations

from typing import Any

from features.behavior.models import Alert, BehaviorLog


EVENT_TYPE_MAP = {
    "no_face": BehaviorLog.EventType.NO_FACE,
    "multiple_faces": BehaviorLog.EventType.MULTIPLE_FACES,
    "looking_away": BehaviorLog.EventType.LOOKING_AWAY,
    "bad_posture": BehaviorLog.EventType.BAD_POSTURE,
    "object_detected": BehaviorLog.EventType.OBJECT_DETECTED,
    "identity_mismatch": BehaviorLog.EventType.IDENTITY_MISMATCH,
}

SEVERITY_MAP = {
    "low": Alert.Severity.LOW,
    "medium": Alert.Severity.MEDIUM,
    "high": Alert.Severity.HIGH,
}


def persist_analysis(session, analysis: dict[str, Any]) -> dict[str, int]:
    """Store events and alerts from a frame analysis payload."""
    logs_created = 0
    alerts_created = 0

    for event in analysis.get("events", []):
        raw_type = event.get("event_type", "")
        event_type = EVENT_TYPE_MAP.get(raw_type)
        if not event_type:
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
        severity = SEVERITY_MAP.get(alert.get("severity", "medium"), Alert.Severity.MEDIUM)
        Alert.objects.create(
            session=session,
            alert_type=alert.get("type", "compliance"),
            severity=severity,
            message=alert.get("message", ""),
            metric_pct=alert.get("metric_pct"),
            resolved=bool(alert.get("resolved", False)),
        )
        alerts_created += 1

    return {"behavior_logs": logs_created, "alerts": alerts_created}
