"""
Production AI adapter for Knowing Eye.

Loads the production pipeline from ``backend/ai/knowing_eye``.
Falls back to a deterministic stub when CV/ML dependencies are unavailable.
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

from django.conf import settings

logger = logging.getLogger("knowing_eye.ai.adapter")

_PIPELINE = None
_FRAME_BUFFER = None
_PIPELINE_MODE: str = "uninitialized"
_TEMPORAL_TRACKER = None
_LOCK = threading.Lock()

_AI_ROOT = Path(__file__).resolve().parent
_DEFAULT_CONFIG = _AI_ROOT / "config" / "pipeline.yaml"


def get_pipeline_mode() -> str:
    """Returns one of ``"production"``, ``"stub"``, ``"disabled"``."""
    _get_pipeline()
    return _PIPELINE_MODE


def _config_path() -> Path:
    ke_settings = getattr(settings, "KNOWING_EYE", {})
    configured = Path(str(ke_settings.get("PIPELINE_CONFIG", "")))
    if configured.exists():
        return configured
    return _DEFAULT_CONFIG


def _buffer_depth() -> int:
    try:
        from ai.knowing_eye.config import load_config

        cfg = load_config(_config_path())
        return int(cfg.get("pipeline", {}).get("frame_buffer_depth", 3))
    except Exception:
        return 3


def _get_frame_buffer():
    global _FRAME_BUFFER
    if _FRAME_BUFFER is not None:
        return _FRAME_BUFFER
    from ai.knowing_eye.processing.frame_buffer import FrameAnalysisBuffer

    _FRAME_BUFFER = FrameAnalysisBuffer(max_depth=_buffer_depth())
    return _FRAME_BUFFER


def _get_pipeline():
    global _PIPELINE, _PIPELINE_MODE
    if _PIPELINE is not None:
        return _PIPELINE

    with _LOCK:
        if _PIPELINE is not None:
            return _PIPELINE

        ke_settings = getattr(settings, "KNOWING_EYE", {})
        if not ke_settings.get("ENABLE_PIPELINE", True):
            _PIPELINE = _StubPipeline()
            _PIPELINE_MODE = "disabled"
            logger.info("AI pipeline disabled via settings; using stub.")
            return _PIPELINE

        try:
            from ai.knowing_eye.pipeline import BehaviorPipeline

            config_path = _config_path()
            _PIPELINE = BehaviorPipeline(config_path=config_path)
            _PIPELINE_MODE = "production"
            logger.info("Loaded production BehaviorPipeline from backend/ai/knowing_eye.")
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Falling back to stub analyzer (production pipeline not loadable): %s",
                exc,
            )
            _PIPELINE = _StubPipeline()
            _PIPELINE_MODE = "stub"
        return _PIPELINE


def _get_temporal_tracker():
    global _TEMPORAL_TRACKER
    if _TEMPORAL_TRACKER is not None:
        return _TEMPORAL_TRACKER
    try:
        from ai.knowing_eye.behavior.temporal import BehaviorTemporalTracker
        from ai.knowing_eye.config import load_config

        config = load_config(_config_path())
        _TEMPORAL_TRACKER = BehaviorTemporalTracker(config)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Temporal behavior tracker unavailable: %s", exc)
        _TEMPORAL_TRACKER = None
    return _TEMPORAL_TRACKER


def _apply_temporal_stub(session_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    tracker = _get_temporal_tracker()
    if tracker is None:
        return payload

    from ai.knowing_eye.types import (
        Alert,
        AlertSeverity,
        BehaviorEvent,
        BehaviorEventType,
        FaceAnalysis,
        FrameAnalysisResult,
        MetricScores,
        ObjectDetection,
        PostureAnalysis,
    )

    metrics_raw = payload.get("metrics", {})
    face_raw = payload.get("face", {})
    posture_raw = payload.get("posture", {})

    metrics = MetricScores(
        face_presence_pct=float(metrics_raw.get("face_presence_pct", 0)),
        gaze_focus_pct=float(metrics_raw.get("gaze_focus_pct", 0)),
        posture_compliance_pct=float(metrics_raw.get("posture_compliance_pct", 0)),
        identity_match_pct=metrics_raw.get("identity_match_pct"),
        object_clear_pct=float(metrics_raw.get("object_clear_pct", 100)),
        overall_compliance_pct=float(metrics_raw.get("overall_compliance_pct", 0)),
        alert_threshold_pct=float(metrics_raw.get("alert_threshold_pct", 80)),
    )
    face = FaceAnalysis(
        count=int(face_raw.get("count", 0)),
        head_yaw_deg=face_raw.get("head_yaw_deg"),
        head_pitch_deg=face_raw.get("head_pitch_deg"),
        identity_distance=face_raw.get("identity_distance"),
    )
    posture = PostureAnalysis(
        detected=bool(posture_raw.get("detected", False)),
        shoulder_tilt_ratio=posture_raw.get("shoulder_tilt_ratio"),
        spine_lean_ratio=posture_raw.get("spine_lean_ratio"),
    )
    events = [
        BehaviorEvent(
            BehaviorEventType(e["event_type"]),
            float(e.get("score_pct", 0)) / 100.0,
            float(e.get("confidence_pct", 0)) / 100.0,
            e.get("metadata") or {},
        )
        for e in payload.get("events", [])
        if e.get("event_type") in {t.value for t in BehaviorEventType}
    ]
    alerts = [
        Alert(
            a["type"],
            AlertSeverity(a.get("severity", "medium")),
            a.get("message", ""),
            a.get("metric_pct"),
        )
        for a in payload.get("alerts", [])
    ]
    objects = [
        ObjectDetection(o["label"], o.get("confidence_pct", 0) / 100.0, o.get("bbox", []))
        for o in payload.get("objects", [])
    ]

    result = FrameAnalysisResult(
        session_id=session_id,
        timestamp=payload.get("timestamp"),
        face=face,
        posture=posture,
        objects=objects,
        metrics=metrics,
        events=events,
        alerts=alerts,
        frame_index=payload.get("frame_index"),
    )
    pose_detected = posture.detected
    out = tracker.apply(session_id, result, pose_detected=pose_detected)
    merged = out.to_dict()
    merged["pipeline_mode"] = payload.get("pipeline_mode")
    merged["behavior_score"] = payload.get("behavior_score", merged.get("behavior_score"))
    return merged


_STUB_IDENTITY_THRESHOLD = 0.15
_ALERT_THRESHOLD_PCT = 80.0


class _StubPipeline:
    """Deterministic analyzer when ML dependencies are missing."""

    def compute_embedding(self, frame_bgr) -> list[float] | None:
        if not hasattr(frame_bgr, "shape"):
            return None
        try:
            import cv2
            import numpy as np

            gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
            if float(gray.mean()) < 40:
                return None
            small = cv2.resize(gray, (16, 16)).astype("float32").flatten()
            norm = float(np.linalg.norm(small))
            if norm < 1e-6:
                return None
            return (small / norm).tolist()
        except Exception:  # noqa: BLE001
            return None

    def analyze_frame(
        self,
        frame_bgr,
        session_id: str | None = None,
        reference_embedding: list[float] | None = None,
    ) -> dict[str, Any]:
        h, w = (frame_bgr.shape[:2] if hasattr(frame_bgr, "shape") else (0, 0))
        try:
            brightness = float(frame_bgr.mean()) if hasattr(frame_bgr, "mean") else 0.0
        except Exception:
            brightness = 0.0
        face_ok = brightness > 40

        face_presence = 95.0 if face_ok else 40.0
        gaze = 90.0 if face_ok else 50.0
        posture = 88.0
        object_clear = 100.0

        identity_pct, identity_distance = self._identity_score(frame_bgr, reference_embedding)

        metric_vals = [face_presence, gaze, posture, object_clear]
        if identity_pct is not None:
            metric_vals.append(identity_pct)
        overall = round(sum(metric_vals) / len(metric_vals), 1)

        t = _ALERT_THRESHOLD_PCT
        flagged: list[str] = []
        if face_presence < t:
            flagged.append("face_presence")
        if gaze < t:
            flagged.append("gaze_focus")
        if posture < t:
            flagged.append("posture")
        if identity_pct is not None and identity_pct < t:
            flagged.append("identity")
        if object_clear < t:
            flagged.append("object_clear")

        metrics = {
            "face_presence_pct": face_presence,
            "gaze_focus_pct": gaze,
            "posture_compliance_pct": posture,
            "identity_match_pct": identity_pct,
            "object_clear_pct": object_clear,
            "overall_compliance_pct": overall,
            "alert_threshold_pct": t,
            "flagged_metrics": flagged,
            "all_compliant": len(flagged) == 0,
        }

        events: list[dict[str, Any]] = []
        alerts: list[dict[str, Any]] = []
        if not face_ok:
            events.append(
                {
                    "event_type": "no_face",
                    "score_pct": 40.0,
                    "confidence_pct": 70.0,
                    "metadata": {"stub": True, "frame_size": [w, h]},
                }
            )
            alerts.append(
                {
                    "type": "no_face",
                    "severity": "medium",
                    "message": "Face presence below threshold (stub analyzer).",
                    "metric_pct": face_presence,
                    "resolved": False,
                }
            )
        if identity_pct is not None and identity_pct < t:
            anomaly = round((100.0 - identity_pct) / 100.0, 4)
            events.append(
                {
                    "event_type": "identity_mismatch",
                    "score_pct": identity_pct,
                    "confidence_pct": round(anomaly * 100, 1),
                    "metadata": {
                        "stub": True,
                        "identity_distance": identity_distance,
                        "metric_pct": identity_pct,
                        "threshold_pct": t,
                    },
                }
            )
            alerts.append(
                {
                    "type": "identity_mismatch",
                    "severity": "high",
                    "message": (
                        f"Identity match below threshold ({identity_pct:.0f}%) — "
                        "face differs from enrolled reference."
                    ),
                    "metric_pct": identity_pct,
                    "resolved": False,
                }
            )

        return {
            "session_id": session_id,
            "timestamp": None,
            "frame_index": None,
            "face": {
                "count": 1 if face_ok else 0,
                "head_yaw_deg": 0.0 if face_ok else None,
                "head_pitch_deg": 0.0 if face_ok else None,
                "identity_distance": identity_distance,
            },
            "posture": {
                "detected": face_ok,
                "shoulder_tilt_ratio": 0.05 if face_ok else None,
                "spine_lean_ratio": 0.1 if face_ok else None,
            },
            "objects": [],
            "metrics": metrics,
            "overall_compliance_pct": overall,
            "behavior_score": round(overall / 100.0, 4),
            "events": events,
            "alerts": alerts,
            "pipeline_mode": "stub",
        }

    def _identity_score(
        self, frame_bgr, reference_embedding: list[float] | None
    ) -> tuple[float | None, float | None]:
        if reference_embedding is None:
            return None, None
        current = self.compute_embedding(frame_bgr)
        if current is None:
            return 0.0, 1.0
        try:
            import numpy as np

            ref = np.asarray(reference_embedding, dtype=float)
            cur = np.asarray(current, dtype=float)
            if ref.shape != cur.shape:
                return None, None
            cosine = float(np.clip(np.dot(ref, cur), -1.0, 1.0))
            distance = max(0.0, 1.0 - cosine)
            pct = 100.0 * (1.0 - distance / _STUB_IDENTITY_THRESHOLD)
            pct = round(max(0.0, min(100.0, pct)), 1)
            return pct, round(distance, 6)
        except Exception:  # noqa: BLE001
            return None, None


def compute_embedding(frame_bgr) -> list[float] | None:
    pipeline = _get_pipeline()
    if not hasattr(pipeline, "compute_embedding"):
        return None
    try:
        emb = pipeline.compute_embedding(frame_bgr)
    except Exception as exc:  # noqa: BLE001
        logger.exception("compute_embedding failed: %s", exc)
        return None
    return [float(x) for x in emb] if emb else None


def analyze_frame_bgr(frame_bgr, session_id: str | None = None) -> dict[str, Any]:
    """Analyze a single BGR frame through the production pipeline (sequential per session)."""
    pipeline = _get_pipeline()

    reference: list[float] | None = None
    if session_id is not None:
        try:
            from ai.identity_store import get_reference_embedding

            reference = get_reference_embedding(session_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("identity reference lookup failed: %s", exc)
            reference = None

    def _run(frame, session_id=session_id, reference_embedding=reference):
        return pipeline.analyze_frame(
            frame,
            session_id=session_id,
            reference_embedding=reference_embedding,
        )

    buffer = _get_frame_buffer()
    result = buffer.analyze(session_id, frame_bgr, reference, _run)
    payload = result.to_dict() if hasattr(result, "to_dict") else result
    mode = get_pipeline_mode()
    if session_id is not None and mode in ("stub", "disabled") and isinstance(payload, dict):
        payload = _apply_temporal_stub(str(session_id), payload)
    payload["pipeline_mode"] = mode
    return payload


def enroll_reference(frame_bgr, session=None) -> dict[str, Any]:
    mode = get_pipeline_mode()
    embedding = compute_embedding(frame_bgr)
    if not embedding:
        return {
            "ok": False,
            "enrolled": False,
            "pipeline_mode": mode,
            "message": "No face detected — please face the camera and try again.",
        }

    if session is not None:
        try:
            from ai.identity_store import store_reference

            store_reference(session, embedding, mode)
        except Exception as exc:  # noqa: BLE001
            logger.exception("store_reference failed: %s", exc)
            return {
                "ok": False,
                "enrolled": False,
                "pipeline_mode": mode,
                "message": "Could not persist the reference face.",
            }

    return {
        "ok": True,
        "enrolled": True,
        "pipeline_mode": mode,
        "backend": mode,
        "dims": len(embedding),
        "message": "Reference face enrolled.",
    }


def reset_pipeline() -> None:
    global _PIPELINE, _PIPELINE_MODE, _TEMPORAL_TRACKER, _FRAME_BUFFER
    with _LOCK:
        _PIPELINE = None
        _PIPELINE_MODE = "uninitialized"
        _TEMPORAL_TRACKER = None
        _FRAME_BUFFER = None
