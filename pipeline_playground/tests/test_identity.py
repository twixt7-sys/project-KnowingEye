"""Identity verifier unit tests (no webcam / models required)."""

from __future__ import annotations

import numpy as np

from knowing_eye.recognition.identity import IdentityVerifier


def test_appearance_backend_enroll_and_match():
    verifier = IdentityVerifier(backend="appearance", match_threshold=0.15)
    assert verifier.backend == "appearance"

    frame = np.full((120, 120, 3), 180, dtype=np.uint8)
    bbox = (20, 20, 60, 60)
    assert verifier.enroll_from_frame(frame, bbox)

    match, dist = verifier.verify(frame, bbox)
    assert match is True
    assert dist is not None
    assert dist <= 0.15


def test_appearance_mismatch_on_different_crop():
    verifier = IdentityVerifier(backend="appearance", match_threshold=0.15)
    frame_a = np.zeros((120, 120, 3), dtype=np.uint8)
    frame_b = np.zeros((120, 120, 3), dtype=np.uint8)
    bbox = (20, 20, 60, 60)
    # Vertical split vs horizontal split inside the crop region.
    frame_a[20:80, 20:50] = 240
    frame_b[20:50, 20:80] = 240
    assert verifier.enroll_from_frame(frame_a, bbox)

    match, dist = verifier.verify(frame_b, bbox)
    assert match is False
    assert dist is not None


def test_verify_against_rejects_dimension_mismatch():
    verifier = IdentityVerifier(backend="appearance", match_threshold=0.15)
    frame = np.full((120, 120, 3), 180, dtype=np.uint8)
    bbox = (20, 20, 60, 60)
    ref = verifier.embed(frame, bbox)
    assert ref is not None

    wrong_ref = [0.0] * 128
    match, dist = verifier.verify_against(frame, bbox, wrong_ref)
    assert match is None
    assert dist is None


def test_arcface_requested_falls_back_without_deps():
    verifier = IdentityVerifier(backend="arcface")
    # Without insightface installed this should not crash.
    assert verifier.backend in ("arcface", "face_recognition", "appearance")
