"""Tests for the posture / identity accuracy rules.

* thresholds land exactly on the 80% alert cutoff (not at 20% of the threshold),
* posture is measured from landmarks a webcam actually sees (shoulders + ears),
* identity is decided on a rolling median, skips off-angle faces, and treats
  "couldn't embed" as unknown rather than a mismatch,
* multi-frame enrollment fuses samples and rejects an outlier.
"""

from __future__ import annotations

from types import SimpleNamespace

import numpy as np
import pytest

from ai.knowing_eye.behavior.normalize import (
    identity_match_pct,
    posture_compliance_pct,
    threshold_compliance_pct,
)
from ai.knowing_eye.detection.face_detector import DetectedFace
from ai.knowing_eye.detection.pose_detector import PoseDetector
from ai.knowing_eye.pipeline import BehaviorPipeline
from ai.knowing_eye.recognition.identity import fuse_embeddings


# --- threshold -> compliance mapping ----------------------------------------


@pytest.mark.parametrize(
    "value,expected",
    [(0.0, 100.0), (0.21, 90.0), (0.42, 80.0), (0.63, 40.0), (0.84, 0.0), (2.0, 0.0)],
)
def test_threshold_maps_to_alert_cutoff(value, expected):
    assert threshold_compliance_pct(value, 0.42) == pytest.approx(expected)


def test_genuine_arcface_distance_is_not_flagged():
    # 0.30 is a typical same-person ArcFace distance on a webcam. The old
    # linear mapping scored it 28.6% (flagged); it must now stay above 80%.
    assert identity_match_pct(True, 0.30, 0.42) > 80.0
    assert identity_match_pct(False, 0.50, 0.42) < 80.0


def test_small_shoulder_tilt_is_not_flagged():
    # ~3 degrees of tilt (tan = 0.05) used to score 72% against a 0.18 max.
    assert posture_compliance_pct(True, 0.05, 0.05, 0.18, 0.30) > 80.0
    assert posture_compliance_pct(True, 0.25, 0.05, 0.18, 0.30) < 80.0
    assert posture_compliance_pct(True, 0.05, 0.40, 0.18, 0.30) < 80.0


# --- posture geometry --------------------------------------------------------


def _lm(x, y, vis=0.99):
    return SimpleNamespace(x=x, y=y, visibility=vis)


def _pose_landmarks(*, ls, rs, le, re, nose=None, shoulder_vis=0.99):
    lm = [_lm(0.5, 0.9, 0.1) for _ in range(33)]  # everything else unseen
    lm[0] = _lm(*(nose or ((le[0] + re[0]) / 2, le[1] + 0.02)))
    lm[7], lm[8] = _lm(*le), _lm(*re)
    lm[11], lm[12] = _lm(*ls, shoulder_vis), _lm(*rs, shoulder_vis)
    return lm


@pytest.fixture(scope="module")
def pose_detector():
    det = PoseDetector.__new__(PoseDetector)  # geometry only - skip model load
    det._shoulder_tilt_max, det._spine_lean_max, det._min_visibility = 0.18, 0.30, 0.5
    return det


def test_upright_posture_is_good(pose_detector):
    lm = _pose_landmarks(ls=(0.65, 0.75), rs=(0.35, 0.75), le=(0.56, 0.40), re=(0.44, 0.40))
    res = pose_detector._measure(lm, 640, 480)
    assert res.detected and not res.bad_posture
    assert res.shoulder_tilt_ratio == pytest.approx(0.0)
    assert res.spine_lean_ratio == pytest.approx(0.0, abs=1e-6)


def test_head_over_shoulder_is_bad(pose_detector):
    lm = _pose_landmarks(ls=(0.65, 0.75), rs=(0.35, 0.75), le=(0.68, 0.42), re=(0.58, 0.42))
    res = pose_detector._measure(lm, 640, 480)
    assert res.detected and res.bad_posture
    assert res.spine_lean_ratio > 0.30


def test_hidden_shoulders_mean_no_upper_body(pose_detector):
    lm = _pose_landmarks(
        ls=(0.65, 0.98), rs=(0.35, 0.98), le=(0.56, 0.40), re=(0.44, 0.40), shoulder_vis=0.2
    )
    assert not pose_detector._measure(lm, 640, 480).detected


# --- identity smoothing / gating ---------------------------------------------


class _FakeVerifier:
    threshold = 0.42

    def __init__(self, distances):
        self._distances = list(distances)
        self.calls = 0

    def verify_against(self, frame, bbox, reference):
        self.calls += 1
        d = self._distances.pop(0)
        return (None, None) if d is None else (d <= self.threshold, d)


def _pipeline_with(verifier, every=1, window=5):
    p = BehaviorPipeline.__new__(BehaviorPipeline)  # skip model load
    p._identity = verifier
    p._identity_check_every = every
    p._identity_window = window
    p._identity_min_face_px = 64
    p._identity_max_yaw = 30.0
    p._identity_max_pitch = 30.0
    p._identity_tracks = {}
    return p


_FRONTAL = DetectedFace((100, 100, 150, 150), None, 5.0, 5.0)
_REF = [0.1] * 512


def test_single_bad_frame_does_not_flip_identity():
    p = _pipeline_with(_FakeVerifier([0.30, 0.32, 0.90, 0.31]))
    results = [p._verify_identity("s", None, _FRONTAL, _REF) for _ in range(4)]
    assert all(match for match, _ in results)


def test_sustained_mismatch_is_detected():
    p = _pipeline_with(_FakeVerifier([0.30, 0.31, 0.90, 0.95, 0.92, 0.93]))
    results = [p._verify_identity("s", None, _FRONTAL, _REF) for _ in range(6)]
    assert results[-1][0] is False


def test_off_angle_face_is_not_checked():
    verifier = _FakeVerifier([0.30])
    p = _pipeline_with(verifier)
    p._verify_identity("s", None, _FRONTAL, _REF)
    turned = DetectedFace((100, 100, 150, 150), None, 55.0, 5.0)
    match, dist = p._verify_identity("s", None, turned, _REF)
    assert verifier.calls == 1  # gated - previous decision carried over
    assert match is True and dist == pytest.approx(0.30)


def test_embedding_failure_is_unknown_not_mismatch():
    p = _pipeline_with(_FakeVerifier([None]))
    assert p._verify_identity("s", None, _FRONTAL, _REF) == (None, None)


def test_window_resets_after_face_leaves():
    p = _pipeline_with(_FakeVerifier([0.30, 0.30, 0.90]))
    p._verify_identity("s", None, _FRONTAL, _REF)
    p._verify_identity("s", None, _FRONTAL, _REF)
    p._verify_identity("s", None, None, _REF)
    p._verify_identity("s", None, None, _REF)
    match, dist = p._verify_identity("s", None, _FRONTAL, _REF)
    assert match is False and dist == pytest.approx(0.90)


# --- enrollment fusion -------------------------------------------------------


def test_fuse_embeddings_drops_outlier():
    rng = np.random.default_rng(0)
    base = rng.normal(size=512)
    same = [base + rng.normal(scale=0.3, size=512) for _ in range(3)]
    other = rng.normal(size=512)
    fused = np.asarray(fuse_embeddings([*same, other], max_cosine_distance=0.42))
    unit = base / np.linalg.norm(base)
    assert np.linalg.norm(fused) == pytest.approx(1.0)
    assert float(fused @ unit) > 0.9
