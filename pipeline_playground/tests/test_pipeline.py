"""Basic pipeline tests (no webcam required)."""

from __future__ import annotations

import numpy as np
import pytest

from knowing_eye.pipeline import BehaviorPipeline


@pytest.fixture
def pipeline():
    p = BehaviorPipeline()
    yield p
    p.close()


def test_analyze_blank_frame(pipeline: BehaviorPipeline):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    result = pipeline.analyze_frame(frame, session_id="test")
    assert result.metrics.face_presence_pct == 0.0
    assert result.metrics.overall_compliance_pct >= 0
    d = result.to_dict()
    assert "metrics" in d
    assert d["session_id"] == "test"
    assert "overall_compliance_pct" in d["metrics"]


def test_result_schema(pipeline: BehaviorPipeline):
    frame = np.zeros((240, 320, 3), dtype=np.uint8)
    result = pipeline.analyze_frame(frame)
    data = result.to_dict()
    for key in ("timestamp", "face", "posture", "objects", "metrics", "events", "alerts"):
        assert key in data
    assert data["metrics"]["alert_threshold_pct"] == 80.0


def test_threshold_flags_no_face(pipeline: BehaviorPipeline):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    result = pipeline.analyze_frame(frame)
    assert result.metrics.face_presence_pct < 80
    assert "face_presence" in result.metrics.flagged_metrics()
