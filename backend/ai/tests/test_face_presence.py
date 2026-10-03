"""Face Presence (``Fp``) is binary - exactly 0% or 100% - and detecting the
examinee's identity always pins it to 100%."""

from __future__ import annotations

import pytest

from ai.knowing_eye.behavior.normalize import face_presence_pct, multiple_faces_compliance_pct
from ai.knowing_eye.behavior.scoring import BehaviorScorer
from ai.knowing_eye.behavior.temporal import BehaviorTemporalTracker
from ai.knowing_eye.types import BehaviorEventType, FaceAnalysis, PostureAnalysis

_CONFIG = {"pipeline": {"alert_threshold_pct": 80}, "recognition": {"identity_match_threshold": 0.42}}


def _scorer() -> BehaviorScorer:
    return BehaviorScorer(_CONFIG)


def _face(count: int, distance: float | None = None) -> FaceAnalysis:
    return FaceAnalysis(
        count=count,
        head_yaw_deg=0.0 if count else None,
        head_pitch_deg=0.0 if count else None,
        identity_distance=distance,
    )


_POSTURE = PostureAnalysis(detected=True, shoulder_tilt_ratio=0.0, spine_lean_ratio=0.0)


@pytest.mark.parametrize("count,expected", [(0, 0.0), (1, 100.0), (2, 100.0), (5, 100.0)])
def test_presence_is_only_zero_or_hundred(count, expected):
    assert face_presence_pct(count) == expected


@pytest.mark.parametrize("count", [0, 1, 3])
def test_identity_detected_is_always_hundred(count):
    assert face_presence_pct(count, identity_detected=True) == 100.0


def test_multiple_faces_still_scored_separately():
    assert multiple_faces_compliance_pct(1) == 100.0
    assert multiple_faces_compliance_pct(2) == 75.0
    assert multiple_faces_compliance_pct(3) == 50.0


def test_scorer_presence_is_binary_with_several_faces():
    metrics, events, _ = _scorer().score(_face(3), _POSTURE, True, None)
    assert metrics.face_presence_pct == 100.0
    # More than one face no longer lowers presence, but is still flagged.
    assert BehaviorEventType.MULTIPLE_FACES in {e.event_type for e in events}
    assert BehaviorEventType.NO_FACE not in {e.event_type for e in events}


def test_scorer_no_face_is_zero():
    metrics, events, _ = _scorer().score(_face(0), _POSTURE, False, None)
    assert metrics.face_presence_pct == 0.0
    assert BehaviorEventType.NO_FACE in {e.event_type for e in events}


def test_scorer_identity_match_forces_presence_hundred_without_face_count():
    metrics, events, _ = _scorer().score(_face(0, distance=0.20), _POSTURE, True, True)
    assert metrics.face_presence_pct == 100.0
    assert BehaviorEventType.NO_FACE not in {e.event_type for e in events}


def test_temporal_tracker_keeps_presence_hundred_when_identity_detected():
    scorer = _scorer()
    face = _face(0, distance=0.20)
    metrics, events, alerts = scorer.score(face, _POSTURE, True, True)

    from ai.knowing_eye.types import FrameAnalysisResult

    result = FrameAnalysisResult(
        session_id="s", timestamp=None, face=face, posture=_POSTURE,
        metrics=metrics, events=events, alerts=alerts, frame_index=1,
    )
    out = BehaviorTemporalTracker(_CONFIG).apply("s", result, pose_detected=True)
    assert out.metrics.face_presence_pct == 100.0
