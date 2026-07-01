"""Structured types aligned with main-system behavior_logs and alerts."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class BehaviorEventType(str, Enum):
    NO_FACE = "no_face"
    MULTIPLE_FACES = "multiple_faces"
    LOOKING_AWAY = "looking_away"
    BAD_POSTURE = "bad_posture"
    LEAVING_SEAT = "leaving_seat"
    IDENTITY_MISMATCH = "identity_mismatch"
    SUSPICIOUS_PATTERN = "suspicious_pattern"


class AlertSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class BehaviorEvent:
    event_type: BehaviorEventType
    score: float
    confidence: float
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_type": self.event_type.value,
            "score_pct": round(self.score * 100, 1),
            "confidence_pct": round(self.confidence * 100, 1),
            "metadata": self.metadata,
        }


@dataclass
class Alert:
    type: str
    severity: AlertSeverity
    message: str
    metric_pct: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "severity": self.severity.value,
            "message": self.message,
            "metric_pct": self.metric_pct,
            "resolved": False,
        }


@dataclass
class MetricScores:
    """0–100% compliance (higher = better). Alerts when any metric < alert_threshold_pct."""

    face_presence_pct: float
    gaze_focus_pct: float
    posture_compliance_pct: float
    identity_match_pct: float | None
    overall_compliance_pct: float
    alert_threshold_pct: float = 80.0

    def to_dict(self) -> dict[str, Any]:
        flags = self.flagged_metrics()
        return {
            "face_presence_pct": self.face_presence_pct,
            "gaze_focus_pct": self.gaze_focus_pct,
            "posture_compliance_pct": self.posture_compliance_pct,
            "identity_match_pct": self.identity_match_pct,
            "overall_compliance_pct": self.overall_compliance_pct,
            "alert_threshold_pct": self.alert_threshold_pct,
            "flagged_metrics": flags,
            "all_compliant": len(flags) == 0,
        }

    def flagged_metrics(self) -> list[str]:
        t = self.alert_threshold_pct
        out: list[str] = []
        if self.face_presence_pct < t:
            out.append("face_presence")
        if self.gaze_focus_pct < t:
            out.append("gaze_focus")
        if self.posture_compliance_pct < t:
            out.append("posture")
        if self.identity_match_pct is not None and self.identity_match_pct < t:
            out.append("identity")
        return out


@dataclass
class FaceAnalysis:
    count: int
    head_yaw_deg: float | None
    head_pitch_deg: float | None
    bbox: list[int] | None = None
    bbox_norm: list[float] | None = None
    identity_distance: float | None = None

    def to_dict(self, metrics: MetricScores) -> dict[str, Any]:
        out: dict[str, Any] = {
            "count": self.count,
            "head_yaw_deg": self.head_yaw_deg,
            "head_pitch_deg": self.head_pitch_deg,
            "bbox": self.bbox,
            "identity_distance": self.identity_distance,
            "face_presence_pct": metrics.face_presence_pct,
            "gaze_focus_pct": metrics.gaze_focus_pct,
            "identity_match_pct": metrics.identity_match_pct,
        }
        if self.bbox_norm is not None:
            out["bbox_norm"] = self.bbox_norm
        return out


@dataclass
class PostureAnalysis:
    detected: bool
    shoulder_tilt_ratio: float | None
    spine_lean_ratio: float | None
    guide_status: str = "no_pose"

    def to_dict(self, metrics: MetricScores) -> dict[str, Any]:
        return {
            "detected": self.detected,
            "shoulder_tilt_ratio": self.shoulder_tilt_ratio,
            "spine_lean_ratio": self.spine_lean_ratio,
            "posture_compliance_pct": metrics.posture_compliance_pct,
            "guide_status": self.guide_status,
        }


@dataclass
class FrameAnalysisResult:
    session_id: str | None
    timestamp: str
    face: FaceAnalysis
    posture: PostureAnalysis
    metrics: MetricScores
    events: list[BehaviorEvent]
    alerts: list[Alert]
    frame_index: int | None = None
    frame_size: list[int] | None = None

    @property
    def behavior_score(self) -> float:
        """Legacy 0–1 compliance (overall / 100)."""
        return self.metrics.overall_compliance_pct / 100.0

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "session_id": self.session_id,
            "timestamp": self.timestamp,
            "frame_index": self.frame_index,
            "face": self.face.to_dict(self.metrics),
            "posture": self.posture.to_dict(self.metrics),
            "metrics": self.metrics.to_dict(),
            "overall_compliance_pct": self.metrics.overall_compliance_pct,
            "behavior_score": round(self.behavior_score, 4),
            "events": [e.to_dict() for e in self.events],
            "alerts": [a.to_dict() for a in self.alerts],
        }
        if self.frame_size is not None:
            payload["frame_size"] = self.frame_size
        return payload


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
