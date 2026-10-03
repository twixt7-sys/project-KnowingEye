"""Tests for Upper-Body Presence (``Up``) and the separate bad-posture signal.

Regression: ``Up`` used to be a posture score that returned a "neutral" 50%
whenever the pose model missed, and scored detected upper bodies against a
hip landmark that is never in frame at a webcam - so it sat at 50% (or far
below it) no matter how the examinee was seated.

Regression: a close webcam framing that shows only the head and upper torso
puts the shoulders below the frame edge, so the pose model reported "not
detected" and ``Up`` read 0% for an examinee sitting right there. With the
identity detected and the face box present, ``Up`` now stays within 50-100%.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from ai.knowing_eye.behavior import temporal
from ai.knowing_eye.behavior.normalize import posture_quality_pct, upper_body_presence_pct
from ai.knowing_eye.behavior.scoring import BehaviorScorer
from ai.knowing_eye.detection.pose_detector import _in_frame, _visibility
from ai.knowing_eye.types import (
    BehaviorEventType,
    FaceAnalysis,
    FrameAnalysisResult,
    PostureAnalysis,
)

_CONFIG = {
    "pipeline": {"alert_threshold_pct": 80},
    "recognition": {"identity_match_threshold": 0.42},
    "behavior": {"leaving_seat_grace_seconds": 3.0},
}


def test_presence_is_zero_when_not_detected():
    assert upper_body_presence_pct(False) == 0.0
    assert upper_body_presence_pct(False, 0.9) == 0.0


def test_presence_follows_shoulder_visibility():
    assert upper_body_presence_pct(True, 0.99) == pytest.approx(99.0)
    assert upper_body_presence_pct(True, None) == 100.0


def test_posture_quality_ignores_missing_body():
    assert posture_quality_pct(False, None, None, 0.18) is None


def test_posture_quality_without_hips_uses_tilt_only():
    # Typical webcam framing: level shoulders, hips out of frame (lean=None).
    assert posture_quality_pct(True, 0.02, None, 0.18) >= 80.0
    # Past the limit is flagged (below the 80% cutoff) but falls off gradually,
    # only reaching 0% at twice the limit.
    assert posture_quality_pct(True, 0.25, None, 0.18) < 80.0
    assert posture_quality_pct(True, 0.36, None, 0.18) == 0.0


def test_offscreen_landmark_is_not_in_frame():
    # MediaPipe's guessed hip for a seated examinee (see pose probe data).
    hip = SimpleNamespace(x=0.7, y=1.7, visibility=0.01)
    assert not _in_frame(hip)
    assert _visibility(hip) < 0.5
    shoulder = SimpleNamespace(x=1.01, y=0.8, visibility=0.99)
    assert _in_frame(shoulder)


# --- identity detected + face box present -------------------------------------


@pytest.mark.parametrize(
    "detected,visibility,expected",
    [
        (False, 0.0, 50.0),  # pose model found no shoulders at all
        (False, 0.3, 65.0),  # shoulders cut off at the bottom of the frame
        (False, None, 50.0),
        (True, 0.6, 80.0),
        (True, 0.99, 99.5),
        (True, None, 100.0),
    ],
)
def test_verified_examinee_scores_within_50_to_100(detected, visibility, expected):
    pct = upper_body_presence_pct(
        detected, visibility, identity_detected=True, face_box_present=True
    )
    assert pct == pytest.approx(expected)


@pytest.mark.parametrize("detected", [False, True])
@pytest.mark.parametrize("visibility", [None, 0.0, 0.2, 0.5, 0.8, 1.0])
def test_verification_never_lowers_presence(detected, visibility):
    plain = upper_body_presence_pct(detected, visibility)
    verified = upper_body_presence_pct(
        detected, visibility, identity_detected=True, face_box_present=True
    )
    assert 50.0 <= verified <= 100.0
    assert verified >= plain


@pytest.mark.parametrize(
    "identity_detected,face_box_present", [(True, False), (False, True), (False, False)]
)
def test_needs_both_identity_and_face_box(identity_detected, face_box_present):
    pct = upper_body_presence_pct(
        False, 0.3, identity_detected=identity_detected, face_box_present=face_box_present
    )
    assert pct == 0.0


def _torso_only_frame(identity_match: bool | None, distance: float | None) -> FrameAnalysisResult:
    """Head and upper torso in view, shoulders below the frame edge."""
    face = FaceAnalysis(
        count=1,
        head_yaw_deg=0.0,
        head_pitch_deg=0.0,
        bbox=[200, 60, 240, 300],
        identity_distance=distance,
    )
    posture = PostureAnalysis(
        detected=False, shoulder_tilt_ratio=None, spine_lean_ratio=None, upper_body_visibility=0.3
    )
    metrics, events, alerts = BehaviorScorer(_CONFIG).score(face, posture, False, identity_match)
    return FrameAnalysisResult(
        session_id="s", timestamp=None, face=face, posture=posture,
        metrics=metrics, events=events, alerts=alerts, frame_index=1,
    )


_UNVERIFIED = [(None, None), (False, 0.90)]  # not evaluated yet / different person


def test_scorer_keeps_verified_torso_only_examinee_above_zero():
    assert _torso_only_frame(True, 0.20).metrics.posture_compliance_pct == pytest.approx(65.0)


@pytest.mark.parametrize("identity_match,distance", _UNVERIFIED)
def test_scorer_unverified_torso_only_examinee_is_zero(identity_match, distance):
    assert _torso_only_frame(identity_match, distance).metrics.posture_compliance_pct == 0.0


@pytest.fixture
def clock(monkeypatch):
    """The temporal tracker's clock, in seconds, set by hand."""
    now = [0.0]
    monkeypatch.setattr(temporal, "time", SimpleNamespace(monotonic=lambda: now[0]))
    return now


def _hold_torso_only(clock, identity_match, distance, seconds=5.0, fps=5):
    """Feed torso-only frames for longer than the 3 s leaving-seat grace period."""
    tracker = temporal.BehaviorTemporalTracker(_CONFIG)
    seen: set[BehaviorEventType] = set()
    for i in range(int(seconds * fps) + 1):
        clock[0] = i / fps
        out = tracker.apply("s", _torso_only_frame(identity_match, distance), pose_detected=False)
        seen |= {e.event_type for e in out.events}
    return out, seen


def test_verified_examinee_is_not_flagged_as_leaving_seat(clock):
    out, seen = _hold_torso_only(clock, True, 0.20)
    assert BehaviorEventType.LEAVING_SEAT not in seen
    assert out.metrics.posture_compliance_pct == pytest.approx(65.0)


@pytest.mark.parametrize("identity_match,distance", _UNVERIFIED)
def test_unverified_examinee_is_still_flagged_as_leaving_seat(clock, identity_match, distance):
    _, seen = _hold_torso_only(clock, identity_match, distance)
    assert BehaviorEventType.LEAVING_SEAT in seen
