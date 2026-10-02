"""Tests for Upper-Body Presence (``Up``) and the separate bad-posture signal.

Regression: ``Up`` used to be a posture score that returned a "neutral" 50%
whenever the pose model missed, and scored detected upper bodies against a
hip landmark that is never in frame at a webcam - so it sat at 50% (or far
below it) no matter how the examinee was seated.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from ai.knowing_eye.behavior.normalize import posture_quality_pct, upper_body_presence_pct
from ai.knowing_eye.detection.pose_detector import _in_frame, _visibility


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
    assert posture_quality_pct(True, 0.25, None, 0.18) == 0.0


def test_offscreen_landmark_is_not_in_frame():
    # MediaPipe's guessed hip for a seated examinee (see pose probe data).
    hip = SimpleNamespace(x=0.7, y=1.7, visibility=0.01)
    assert not _in_frame(hip)
    assert _visibility(hip) < 0.5
    shoulder = SimpleNamespace(x=1.01, y=0.8, visibility=0.99)
    assert _in_frame(shoulder)
