"""Tests for the Exam Behavior Index (EBI) composite.

The EBI is an equal-weight formative index: ``EBI = (Fp + Fi + Up + Gc) / N``,
where identity (``Fi``) is only counted when it was evaluated. These tests pin
the "measurable, provable" contract the paper documents:

* the index is the arithmetic mean of the evaluated indicators,
* identity absence drops N to 3 rather than scoring identity zero, and
* the legacy ``overall_compliance_pct`` now equals the EBI.
"""

from __future__ import annotations

import pytest

from ai.knowing_eye.behavior.normalize import (
    exam_behavior_index_pct,
    overall_compliance_pct,
)


def test_ebi_is_equal_weight_mean_of_four_indicators():
    ebi, n = exam_behavior_index_pct(80.0, 60.0, 100.0, 40.0)
    assert n == 4
    assert ebi == pytest.approx((80 + 60 + 100 + 40) / 4)  # 70.0


def test_ebi_excludes_identity_when_not_evaluated():
    ebi, n = exam_behavior_index_pct(90.0, 60.0, 30.0, None)
    assert n == 3
    assert ebi == pytest.approx((90 + 60 + 30) / 3)  # 60.0


def test_identity_absence_does_not_double_count_face_absence():
    # No face: presence 0, gaze 0, upper-body base 50, identity not evaluated.
    # EBI must average only the three evaluated indicators, not penalise
    # identity a second time for the same missing face.
    ebi, n = exam_behavior_index_pct(0.0, 0.0, 50.0, None)
    assert n == 3
    # Index is rounded to 1 decimal place (clamp_pct).
    assert ebi == pytest.approx(50.0 / 3, abs=0.05)


def test_all_perfect_is_100():
    ebi, n = exam_behavior_index_pct(100.0, 100.0, 100.0, 100.0)
    assert n == 4
    assert ebi == pytest.approx(100.0)


def test_overall_compliance_equals_ebi():
    for args in [
        (80.0, 60.0, 100.0, 40.0),
        (90.0, 60.0, 30.0, None),
        (100.0, 100.0, 100.0, 100.0),
    ]:
        ebi, _ = exam_behavior_index_pct(*args)
        assert overall_compliance_pct(*args) == pytest.approx(ebi)


def test_overall_compliance_ignores_legacy_weights_argument():
    # The weights arg is retained for backward compatibility but must not
    # change the (equal-weight) result.
    weighted = overall_compliance_pct(
        80.0, 60.0, 100.0, 40.0, weights={"face": 0.9, "gaze": 0.05, "posture": 0.05, "identity": 0.0}
    )
    ebi, _ = exam_behavior_index_pct(80.0, 60.0, 100.0, 40.0)
    assert weighted == pytest.approx(ebi)
