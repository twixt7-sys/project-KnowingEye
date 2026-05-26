"""
Bridge from the Django backend to ``pipeline_playground/knowing_eye``.

Behavior
--------
* Lazily imports the heavy ML stack (mediapipe / opencv / ultralytics).
* When ML dependencies aren't installed, transparently falls back to a
  deterministic stub so the monitoring API contract is always honored.
* Threadsafe initialization — used from both DRF views and Channels consumers.
"""

from __future__ import annotations

import logging
import sys
import threading
from pathlib import Path
from typing import Any

from django.conf import settings

logger = logging.getLogger("knowing_eye.ai.adapter")

_PIPELINE = None
_PIPELINE_MODE: str = "uninitialized"
_LOCK = threading.Lock()


def _repo_root() -> Path:
    """Returns the project root (parent of ``backend/``)."""
    return Path(settings.BASE_DIR).parent


def _ensure_playground_on_path() -> None:
    playground = _repo_root() / "pipeline_playground"
    if playground.is_dir() and str(playground) not in sys.path:
        sys.path.insert(0, str(playground))


def get_pipeline_mode() -> str:
    """Returns one of ``"playground"``, ``"stub"``, ``"disabled"``."""
    _get_pipeline()
    return _PIPELINE_MODE


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

        _ensure_playground_on_path()
        try:
            from knowing_eye.pipeline import BehaviorPipeline  # type: ignore

            config_path = Path(ke_settings.get("PIPELINE_CONFIG", ""))
            _PIPELINE = BehaviorPipeline(
                config_path=config_path if config_path.exists() else None
            )
            _PIPELINE_MODE = "playground"
            logger.info("Loaded pipeline_playground BehaviorPipeline.")
        except Exception as exc:  # noqa: BLE001 - we always want to degrade gracefully
            logger.warning(
                "Falling back to stub analyzer (pipeline_playground not loadable): %s",
                exc,
            )
            _PIPELINE = _StubPipeline()
            _PIPELINE_MODE = "stub"
        return _PIPELINE


class _StubPipeline:
    """Lightweight deterministic analyzer used when the ML stack is missing."""

    enrolled = False

    def analyze_frame(self, frame_bgr, session_id: str | None = None) -> dict[str, Any]:
        h, w = (frame_bgr.shape[:2] if hasattr(frame_bgr, "shape") else (0, 0))
        try:
            brightness = float(frame_bgr.mean()) if hasattr(frame_bgr, "mean") else 0.0
        except Exception:
            brightness = 0.0
        face_ok = brightness > 40
        overall = 92.0 if face_ok else 55.0
        metrics = {
            "face_presence_pct": 95.0 if face_ok else 40.0,
            "gaze_focus_pct": 90.0 if face_ok else 50.0,
            "posture_compliance_pct": 88.0,
            "identity_match_pct": None,
            "object_clear_pct": 100.0,
            "overall_compliance_pct": overall,
            "alert_threshold_pct": 80.0,
            "flagged_metrics": [] if overall >= 80 else ["face_presence"],
            "all_compliant": overall >= 80,
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
                    "type": "face_presence",
                    "severity": "medium",
                    "message": "Face presence below threshold (stub analyzer).",
                    "metric_pct": metrics["face_presence_pct"],
                    "resolved": False,
                }
            )
        return {
            "session_id": session_id,
            "timestamp": None,
            "frame_index": None,
            "metrics": metrics,
            "overall_compliance_pct": overall,
            "behavior_score": round(overall / 100.0, 4),
            "events": events,
            "alerts": alerts,
            "pipeline_mode": "stub",
        }

    def enroll_reference(self, frame_bgr) -> bool:
        self.enrolled = True
        return True


def analyze_frame_bgr(frame_bgr, session_id: str | None = None) -> dict[str, Any]:
    """Analyze a single BGR frame and return the canonical contract dict."""
    pipeline = _get_pipeline()
    result = pipeline.analyze_frame(frame_bgr, session_id=session_id)
    payload = result.to_dict() if hasattr(result, "to_dict") else result
    payload["pipeline_mode"] = get_pipeline_mode()
    return payload


def enroll_reference(frame_bgr) -> bool:
    """Register a reference face for identity verification (best-effort)."""
    pipeline = _get_pipeline()
    if hasattr(pipeline, "enroll_reference"):
        try:
            return bool(pipeline.enroll_reference(frame_bgr))
        except Exception as exc:  # noqa: BLE001
            logger.exception("enroll_reference failed: %s", exc)
            return False
    return False


def reset_pipeline() -> None:
    """Force re-initialization on the next call (useful for tests)."""
    global _PIPELINE, _PIPELINE_MODE
    with _LOCK:
        _PIPELINE = None
        _PIPELINE_MODE = "uninitialized"
