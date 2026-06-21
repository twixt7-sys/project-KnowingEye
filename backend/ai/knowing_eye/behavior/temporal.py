"""Temporal behavior rules — grace periods, leaving seat, suspicious patterns."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from ai.knowing_eye.types import (
    Alert,
    AlertSeverity,
    BehaviorEvent,
    BehaviorEventType,
    FrameAnalysisResult,
)


@dataclass
class _SessionState:
    no_face_since: float | None = None
    leaving_seat_since: float | None = None
    flag_times: list[tuple[float, str]] = field(default_factory=list)
    last_suspicious_at: float | None = None


class BehaviorTemporalTracker:
    """
    Apply MVP temporal rules on top of per-frame scoring:

    * **no_face** — only after face missing for ``no_face_grace_seconds``
    * **leaving_seat** — face visible but upper-body keypoints missing for grace period
    * **suspicious_pattern** — repeated flags within a sliding time window
    """

    def __init__(self, config: dict[str, Any]) -> None:
        rec = config.get("recognition", {})
        beh = config.get("behavior", {})
        sp = beh.get("suspicious_pattern", {})
        pipe = config.get("pipeline", {})

        self._no_face_grace = float(rec.get("no_face_grace_seconds", 2.0))
        self._leaving_seat_grace = float(beh.get("leaving_seat_grace_seconds", 3.0))
        self._pattern_window = float(sp.get("window_seconds", 60))
        self._pattern_min_flags = int(sp.get("min_flags", 3))
        self._pattern_cooldown = float(sp.get("cooldown_seconds", 120))
        self._alert_threshold_pct = float(pipe.get("alert_threshold_pct", 80))
        self._weights = beh.get("weights", {})
        self._severity_map = beh.get("alert_severity", {})
        self._states: dict[str, _SessionState] = {}

    def reset_session(self, session_id: str) -> None:
        self._states.pop(str(session_id), None)

    def apply(
        self,
        session_id: str,
        result: FrameAnalysisResult,
        *,
        pose_detected: bool,
    ) -> FrameAnalysisResult:
        now = time.monotonic()
        state = self._states.setdefault(str(session_id), _SessionState())
        face_count = result.face.count

        # --- no_face grace timer ---
        if face_count == 0:
            if state.no_face_since is None:
                state.no_face_since = now
            no_face_elapsed = now - state.no_face_since
        else:
            state.no_face_since = None
            no_face_elapsed = 0.0

        # --- leaving seat: face present but upper body not detected ---
        leaving_active = face_count > 0 and not pose_detected
        if leaving_active:
            if state.leaving_seat_since is None:
                state.leaving_seat_since = now
            leaving_elapsed = now - state.leaving_seat_since
        else:
            state.leaving_seat_since = None
            leaving_elapsed = 0.0

        events: list[BehaviorEvent] = []
        alerts: list[Alert] = []

        for event in result.events:
            etype = event.event_type.value
            if etype == BehaviorEventType.NO_FACE.value:
                if no_face_elapsed >= self._no_face_grace:
                    events.append(event)
                continue
            events.append(event)

        for alert in result.alerts:
            if alert.type == BehaviorEventType.NO_FACE.value:
                if no_face_elapsed >= self._no_face_grace:
                    alerts.append(alert)
                continue
            alerts.append(alert)

        if face_count == 0 and no_face_elapsed >= self._no_face_grace:
            self._ensure_event(
                events,
                alerts,
                BehaviorEventType.NO_FACE,
                result.metrics.face_presence_pct,
                {"face_count": 0, "no_face_seconds": round(no_face_elapsed, 2)},
            )

        if leaving_elapsed >= self._leaving_seat_grace:
            posture_pct = result.metrics.posture_compliance_pct
            self._ensure_event(
                events,
                alerts,
                BehaviorEventType.LEAVING_SEAT,
                posture_pct,
                {
                    "pose_detected": pose_detected,
                    "leaving_seat_seconds": round(leaving_elapsed, 2),
                },
            )

        for event in events:
            state.flag_times.append((now, event.event_type.value))

        cutoff = now - self._pattern_window
        state.flag_times = [(t, e) for t, e in state.flag_times if t >= cutoff]

        if (
            len(state.flag_times) >= self._pattern_min_flags
            and (
                state.last_suspicious_at is None
                or now - state.last_suspicious_at >= self._pattern_cooldown
            )
        ):
            state.last_suspicious_at = now
            types_in_window = [e for _, e in state.flag_times]
            pct = max(0.0, 100.0 - len(types_in_window) * 15.0)
            self._ensure_event(
                events,
                alerts,
                BehaviorEventType.SUSPICIOUS_PATTERN,
                pct,
                {
                    "flag_count": len(types_in_window),
                    "window_seconds": self._pattern_window,
                    "event_types": types_in_window[-self._pattern_min_flags :],
                },
                severity_override="high",
            )

        return FrameAnalysisResult(
            session_id=result.session_id,
            timestamp=result.timestamp,
            face=result.face,
            posture=result.posture,
            objects=result.objects,
            metrics=result.metrics,
            events=events,
            alerts=alerts,
            frame_index=result.frame_index,
        )

    def _ensure_event(
        self,
        events: list[BehaviorEvent],
        alerts: list[Alert],
        etype: BehaviorEventType,
        metric_pct: float,
        metadata: dict[str, Any],
        *,
        severity_override: str | None = None,
    ) -> None:
        if any(e.event_type == etype for e in events):
            return

        anomaly = max(0.0, (100.0 - metric_pct) / 100.0)
        w = self._weights.get(etype.value, 0.5)
        events.append(
            BehaviorEvent(
                event_type=etype,
                score=anomaly * w,
                confidence=anomaly,
                metadata={
                    **metadata,
                    "metric_pct": metric_pct,
                    "threshold_pct": self._alert_threshold_pct,
                },
            )
        )
        sev = AlertSeverity(
            severity_override or self._severity_map.get(etype.value, "medium")
        )
        alerts.append(
            Alert(
                type=etype.value,
                severity=sev,
                message=_alert_message(etype, metric_pct, metadata),
                metric_pct=metric_pct,
            )
        )


def _alert_message(etype: BehaviorEventType, pct: float, metadata: dict[str, Any]) -> str:
    if etype == BehaviorEventType.NO_FACE:
        secs = metadata.get("no_face_seconds", "?")
        return f"No face detected for {secs}s (presence {pct:.0f}%)"
    if etype == BehaviorEventType.LEAVING_SEAT:
        secs = metadata.get("leaving_seat_seconds", "?")
        return f"Upper body not visible for {secs}s — possible leaving seat ({pct:.0f}%)"
    if etype == BehaviorEventType.SUSPICIOUS_PATTERN:
        count = metadata.get("flag_count", 0)
        window = metadata.get("window_seconds", 60)
        return (
            f"Suspicious pattern: {count} behavior flags within {window:.0f}s "
            f"(compliance {pct:.0f}%)"
        )
    return f"Behavior alert ({pct:.0f}%)"
