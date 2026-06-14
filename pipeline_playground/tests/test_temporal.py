"""Tests for temporal MVP behavior rules."""

from __future__ import annotations

import time

import pytest

from knowing_eye.behavior.scoring import BehaviorScorer
from knowing_eye.behavior.temporal import BehaviorTemporalTracker
from knowing_eye.types import (
    Alert,
    AlertSeverity,
    BehaviorEvent,
    BehaviorEventType,
    FaceAnalysis,
    FrameAnalysisResult,
    MetricScores,
    PostureAnalysis,
)


def _config(**overrides) -> dict:
    base = {
        "pipeline": {"alert_threshold_pct": 80},
        "recognition": {"no_face_grace_seconds": 2.0},
        "behavior": {
            "leaving_seat_grace_seconds": 3.0,
            "suspicious_pattern": {
                "window_seconds": 60,
                "min_flags": 3,
                "cooldown_seconds": 120,
            },
            "weights": {},
            "alert_severity": {},
        },
    }
    base.update(overrides)
    return base


def _metrics(**kwargs) -> MetricScores:
    defaults = dict(
        face_presence_pct=0.0,
        gaze_focus_pct=90.0,
        posture_compliance_pct=50.0,
        identity_match_pct=None,
        object_clear_pct=100.0,
        overall_compliance_pct=60.0,
        alert_threshold_pct=80.0,
    )
    defaults.update(kwargs)
    return MetricScores(**defaults)


def _result(
    *,
    face_count: int = 0,
    events: list[BehaviorEvent] | None = None,
    alerts: list[Alert] | None = None,
) -> FrameAnalysisResult:
    return FrameAnalysisResult(
        session_id="sess-1",
        timestamp="2026-01-01T00:00:00+00:00",
        face=FaceAnalysis(count=face_count, head_yaw_deg=None, head_pitch_deg=None),
        posture=PostureAnalysis(detected=False, shoulder_tilt_ratio=None, spine_lean_ratio=None),
        objects=[],
        metrics=_metrics(face_presence_pct=0.0 if face_count == 0 else 100.0),
        events=events or [],
        alerts=alerts or [],
        frame_index=1,
    )


def test_no_face_suppressed_within_grace():
    tracker = BehaviorTemporalTracker(_config())
    event = BehaviorEvent(BehaviorEventType.NO_FACE, 1.0, 1.0, {})
    alert = Alert("no_face", AlertSeverity.HIGH, "x", 0.0)
    base = _result(events=[event], alerts=[alert])

    out = tracker.apply("sess-1", base, pose_detected=False)
    assert out.events == []
    assert out.alerts == []


def test_no_face_fires_after_grace():
    tracker = BehaviorTemporalTracker(_config())
    event = BehaviorEvent(BehaviorEventType.NO_FACE, 1.0, 1.0, {})
    base = _result(events=[event])

    tracker.apply("sess-1", base, pose_detected=False)
    time.sleep(2.1)
    out = tracker.apply("sess-1", base, pose_detected=False)

    assert any(e.event_type == BehaviorEventType.NO_FACE for e in out.events)


def test_leaving_seat_after_grace_with_face_visible():
    tracker = BehaviorTemporalTracker(_config())
    base = _result(face_count=1)

    tracker.apply("sess-1", base, pose_detected=False)
    time.sleep(3.1)
    out = tracker.apply("sess-1", base, pose_detected=False)

    assert any(e.event_type == BehaviorEventType.LEAVING_SEAT for e in out.events)


def test_suspicious_pattern_after_repeated_flags():
    tracker = BehaviorTemporalTracker(_config())
    scorer = BehaviorScorer(_config())
    face = FaceAnalysis(count=1, head_yaw_deg=40.0, head_pitch_deg=0.0, identity_distance=None)
    posture = PostureAnalysis(detected=True, shoulder_tilt_ratio=0.01, spine_lean_ratio=0.01)
    metrics, events, alerts = scorer.score(face, posture, [], True, None)

    result = FrameAnalysisResult(
        session_id="sess-2",
        timestamp="t",
        face=face,
        posture=posture,
        objects=[],
        metrics=metrics,
        events=events,
        alerts=alerts,
        frame_index=1,
    )

    out = tracker.apply("sess-2", result, pose_detected=True)
    out = tracker.apply("sess-2", result, pose_detected=True)
    out = tracker.apply("sess-2", result, pose_detected=True)

    assert any(e.event_type == BehaviorEventType.SUSPICIOUS_PATTERN for e in out.events)


def test_mvp_event_types_defined():
    """All MVP behaviors from docs/todo have matching event types."""
    expected = {
        "no_face",
        "identity_mismatch",
        "looking_away",
        "bad_posture",
        "leaving_seat",
        "multiple_faces",
        "suspicious_pattern",
    }
    defined = {e.value for e in BehaviorEventType}
    assert expected.issubset(defined)
