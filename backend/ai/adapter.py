"""
Bridge Django backend to pipeline_playground/knowing_eye.

When CV dependencies are unavailable (CI, minimal install), falls back to a
deterministic stub that still returns the contract expected by monitoring APIs.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

_PIPELINE = None
_PIPELINE_MODE = "uninitialized"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _ensure_playground_on_path() -> None:
    playground = _repo_root() / "pipeline_playground"
    if playground.is_dir() and str(playground) not in sys.path:
        sys.path.insert(0, str(playground))


def get_pipeline_mode() -> str:
    """Returns 'playground', 'stub', or 'uninitialized'."""
    _get_pipeline()
    return _PIPELINE_MODE


def _get_pipeline():
    global _PIPELINE, _PIPELINE_MODE
    if _PIPELINE is not None:
        return _PIPELINE

    _ensure_playground_on_path()
    try:
        from knowing_eye.pipeline import BehaviorPipeline

        config = _repo_root() / "pipeline_playground" / "config" / "pipeline.yaml"
        _PIPELINE = BehaviorPipeline(config_path=config if config.exists() else None)
        _PIPELINE_MODE = "playground"
    except Exception:
        _PIPELINE = _StubPipeline()
        _PIPELINE_MODE = "stub"
    return _PIPELINE


class _StubPipeline:
    """Lightweight analyzer when ML stack is not installed."""

    def analyze_frame(self, frame_bgr, session_id: str | None = None) -> dict[str, Any]:
        h, w = frame_bgr.shape[:2]
        brightness = float(frame_bgr.mean()) if frame_bgr.size else 0.0
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
        events = []
        alerts = []
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


def analyze_frame_bgr(frame_bgr, session_id: str | None = None) -> dict[str, Any]:
    pipeline = _get_pipeline()
    result = pipeline.analyze_frame(frame_bgr, session_id=session_id)
    if hasattr(result, "to_dict"):
        payload = result.to_dict()
    else:
        payload = result
    payload["pipeline_mode"] = get_pipeline_mode()
    return payload
