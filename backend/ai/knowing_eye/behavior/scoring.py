"""Behavior scoring — 0–100% compliance metrics, alerts below threshold."""

from __future__ import annotations

from typing import Any

from ai.knowing_eye.behavior.normalize import (
    face_presence_pct,
    gaze_focus_pct,
    identity_match_pct,
    object_clear_pct,
    overall_compliance_pct,
    posture_compliance_pct,
)
from ai.knowing_eye.detection.face_detector import DetectedFace
from ai.knowing_eye.detection.pose_detector import PoseResult
from ai.knowing_eye.detection.yolo_detector import YoloDetection
from ai.knowing_eye.types import (
    Alert,
    AlertSeverity,
    BehaviorEvent,
    BehaviorEventType,
    FaceAnalysis,
    MetricScores,
    ObjectDetection,
    PostureAnalysis,
)


class BehaviorScorer:
    def __init__(self, config: dict[str, Any]) -> None:
        pipe = config.get("pipeline", {})
        rec = config.get("recognition", {})
        beh = config.get("behavior", {})
        self._gaze_yaw = rec.get("gaze_yaw_threshold_deg", 25)
        self._gaze_pitch = rec.get("gaze_pitch_threshold_deg", 20)
        self._tilt_max = rec.get("posture_shoulder_tilt_max", 0.12)
        self._lean_max = rec.get("posture_spine_lean_max", 0.55)
        self._identity_threshold = rec.get(
            "identity_match_threshold",
            pipe.get("identity_match_threshold", 0.6),
        )
        self._weights = beh.get("weights", {})
        self._severity_map = beh.get("alert_severity", {})
        self._alert_threshold_pct = float(pipe.get("alert_threshold_pct", 80))
        self._metric_weights = beh.get("metric_weights", {})

    def build_face_analysis(
        self,
        faces: list[DetectedFace],
        identity_match: bool | None,
        identity_distance: float | None,
    ) -> FaceAnalysis:
        primary = faces[0] if faces else None
        return FaceAnalysis(
            count=len(faces),
            head_yaw_deg=primary.head_yaw_deg if primary else None,
            head_pitch_deg=primary.head_pitch_deg if primary else None,
            bbox=list(primary.bbox) if primary else None,
            identity_distance=identity_distance,
        )

    def build_posture_analysis(self, pose: PoseResult) -> PostureAnalysis:
        return PostureAnalysis(
            detected=pose.detected,
            shoulder_tilt_ratio=pose.shoulder_tilt_ratio,
            spine_lean_ratio=pose.spine_lean_ratio,
        )

    def build_objects(self, yolo_dets: list[YoloDetection]) -> list[ObjectDetection]:
        return [
            ObjectDetection(label=d.label, confidence=d.confidence, bbox=list(d.bbox))
            for d in yolo_dets
            if d.label == "cell_phone"
        ]

    def compute_metrics(
        self,
        face: FaceAnalysis,
        posture: PostureAnalysis,
        objects: list[ObjectDetection],
        pose_detected: bool,
        identity_match: bool | None,
    ) -> MetricScores:
        fp = face_presence_pct(face.count)
        yaw = face.head_yaw_deg
        pitch = face.head_pitch_deg
        if fp > 0 and (yaw is None or pitch is None):
            yaw = yaw if yaw is not None else 0.0
            pitch = pitch if pitch is not None else 0.0
        gp = gaze_focus_pct(yaw, pitch, self._gaze_yaw, self._gaze_pitch)
        pp = posture_compliance_pct(
            pose_detected,
            posture.shoulder_tilt_ratio,
            posture.spine_lean_ratio,
            self._tilt_max,
            self._lean_max,
        )
        ip = identity_match_pct(identity_match, face.identity_distance, self._identity_threshold)
        phone_conf = max((o.confidence for o in objects), default=0.0)
        oc = object_clear_pct(phone_conf)
        overall = overall_compliance_pct(fp, gp, pp, ip, oc, self._metric_weights)
        return MetricScores(
            face_presence_pct=fp,
            gaze_focus_pct=gp,
            posture_compliance_pct=pp,
            identity_match_pct=ip,
            object_clear_pct=oc,
            overall_compliance_pct=overall,
            alert_threshold_pct=self._alert_threshold_pct,
        )

    def score(
        self,
        face: FaceAnalysis,
        posture: PostureAnalysis,
        objects: list[ObjectDetection],
        pose_detected: bool,
        identity_match: bool | None,
    ) -> tuple[MetricScores, list[BehaviorEvent], list[Alert]]:
        metrics = self.compute_metrics(face, posture, objects, pose_detected, identity_match)
        events: list[BehaviorEvent] = []
        alerts: list[Alert] = []
        t = self._alert_threshold_pct

        def maybe_flag(
            etype: BehaviorEventType,
            pct: float,
            metadata: dict | None = None,
            severity_override: str | None = None,
        ) -> None:
            if pct >= t:
                return
            anomaly = (100.0 - pct) / 100.0
            w = self._weights.get(etype.value, 0.5)
            events.append(
                BehaviorEvent(
                    event_type=etype,
                    score=anomaly * w,
                    confidence=anomaly,
                    metadata={**(metadata or {}), "metric_pct": pct, "threshold_pct": t},
                )
            )
            sev = AlertSeverity(
                severity_override or self._severity_map.get(etype.value, "medium")
            )
            alerts.append(
                Alert(
                    type=etype.value,
                    severity=sev,
                    message=_alert_message(etype, pct),
                    metric_pct=pct,
                )
            )

        maybe_flag(BehaviorEventType.NO_FACE, metrics.face_presence_pct, {"face_count": face.count})

        if face.count > 1:
            maybe_flag(
                BehaviorEventType.MULTIPLE_FACES,
                metrics.face_presence_pct,
                {"face_count": face.count},
            )

        maybe_flag(
            BehaviorEventType.LOOKING_AWAY,
            metrics.gaze_focus_pct,
            {"yaw": face.head_yaw_deg, "pitch": face.head_pitch_deg},
        )

        maybe_flag(
            BehaviorEventType.BAD_POSTURE,
            metrics.posture_compliance_pct,
            {
                "shoulder_tilt": posture.shoulder_tilt_ratio,
                "spine_lean": posture.spine_lean_ratio,
                "pose_detected": pose_detected,
            },
        )

        maybe_flag(
            BehaviorEventType.OBJECT_DETECTED,
            metrics.object_clear_pct,
            {"objects": [o.label for o in objects]},
        )

        # Identity is only scored once a reference has been enrolled for the
        # session (otherwise identity_match_pct is None). A mismatch is a
        # high-severity integrity signal.
        if metrics.identity_match_pct is not None:
            maybe_flag(
                BehaviorEventType.IDENTITY_MISMATCH,
                metrics.identity_match_pct,
                {"identity_distance": face.identity_distance},
                severity_override="high",
            )

        return metrics, events, alerts


def _alert_message(etype: BehaviorEventType, pct: float) -> str:
    messages = {
        BehaviorEventType.NO_FACE: f"Face missing (presence {pct:.0f}%)",
        BehaviorEventType.MULTIPLE_FACES: f"Multiple faces detected ({pct:.0f}% compliance)",
        BehaviorEventType.LOOKING_AWAY: f"Head/gaze angle exceeds threshold ({pct:.0f}%)",
        BehaviorEventType.BAD_POSTURE: f"Upper-body posture abnormal ({pct:.0f}%)",
        BehaviorEventType.LEAVING_SEAT: f"Upper body not visible ({pct:.0f}%)",
        BehaviorEventType.OBJECT_DETECTED: f"Prohibited object detected ({pct:.0f}%)",
        BehaviorEventType.IDENTITY_MISMATCH: (
            f"Different person — face embedding mismatch ({pct:.0f}%)"
        ),
        BehaviorEventType.SUSPICIOUS_PATTERN: f"Repeated behavior flags ({pct:.0f}%)",
    }
    return messages.get(etype, f"Metric below {pct:.0f}%")
