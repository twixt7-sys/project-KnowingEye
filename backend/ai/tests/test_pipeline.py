"""Production pipeline tests (no webcam required)."""

from __future__ import annotations

import numpy as np
import pytest

from ai.knowing_eye.pipeline import BehaviorPipeline
from ai.knowing_eye.preprocessing.frame import prepare_frame, reduce_noise


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


def test_result_schema(pipeline: BehaviorPipeline):
    frame = np.zeros((240, 320, 3), dtype=np.uint8)
    result = pipeline.analyze_frame(frame)
    data = result.to_dict()
    for key in ("timestamp", "face", "posture", "objects", "metrics", "events", "alerts"):
        assert key in data
    assert data["metrics"]["alert_threshold_pct"] == 80.0


def test_preprocessing_denoise():
    frame = np.random.randint(0, 255, (240, 320, 3), dtype=np.uint8)
    out = reduce_noise(frame, strength="light")
    assert out.shape == frame.shape


def test_prepare_frame_applies_resize():
    frame = np.zeros((480, 1280, 3), dtype=np.uint8)
    prepared = prepare_frame(frame, {"preprocessing": {"max_width": 640, "denoise": "off", "normalize_histogram": False}})
    assert prepared.shape[1] <= 640
