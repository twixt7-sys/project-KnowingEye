"""Posture estimation — MediaPipe when available, heuristic fallback from face position."""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

_MEDIAPIPE_OK = False
try:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    from knowing_eye.detection.mp_models import ensure_model

    _MEDIAPIPE_OK = True
except Exception:
    pass

_LEFT_SHOULDER, _RIGHT_SHOULDER, _NOSE, _LEFT_HIP = 11, 12, 0, 23


@dataclass
class PoseResult:
    detected: bool
    shoulder_tilt_ratio: float | None
    spine_lean_ratio: float | None
    bad_posture: bool


class PoseDetector:
    def __init__(self, shoulder_tilt_max: float = 0.12) -> None:
        self._shoulder_tilt_max = shoulder_tilt_max
        self._landmarker = None
        self._body = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_upperbody.xml")

        if _MEDIAPIPE_OK:
            try:
                model_path = ensure_model("pose_landmarker_lite.task")
                options = vision.PoseLandmarkerOptions(
                    base_options=mp_python.BaseOptions(model_asset_path=str(model_path)),
                    running_mode=vision.RunningMode.IMAGE,
                    min_pose_detection_confidence=0.5,
                )
                self._landmarker = vision.PoseLandmarker.create_from_options(options)
            except Exception:
                self._landmarker = None

    def detect(self, frame_bgr: np.ndarray) -> PoseResult:
        if self._landmarker is not None:
            return self._detect_mediapipe(frame_bgr)
        return self._detect_heuristic(frame_bgr)

    def _detect_mediapipe(self, frame_bgr: np.ndarray) -> PoseResult:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self._landmarker.detect(mp_image)
        if not result.pose_landmarks:
            return PoseResult(False, None, None, False)
        lm = result.pose_landmarks[0]
        ls, rs, nose, hip = lm[_LEFT_SHOULDER], lm[_RIGHT_SHOULDER], lm[_NOSE], lm[_LEFT_HIP]
        tilt = abs(ls.y - rs.y) / (abs(ls.x - rs.x) + 1e-6)
        mid_y = (ls.y + rs.y) / 2
        spine_lean = abs(nose.y - mid_y) / (abs(hip.y - mid_y) + 1e-6)
        bad = tilt > self._shoulder_tilt_max or spine_lean > 0.55
        return PoseResult(True, float(tilt), float(spine_lean), bad)

    def _detect_heuristic(self, frame_bgr: np.ndarray) -> PoseResult:
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        bodies = self._body.detectMultiScale(gray, 1.1, 4, minSize=(80, 80))
        if len(bodies) == 0:
            return PoseResult(False, None, None, False)
        x, y, bw, bh = max(bodies, key=lambda r: r[2] * r[3])
        h, w = frame_bgr.shape[:2]
        # Proxy: off-center upper body suggests lean
        center_offset = abs((x + bw / 2) - w / 2) / (w / 2)
        tilt = center_offset * 0.15
        spine_lean = min(1.0, (y + bh) / h)
        bad = tilt > self._shoulder_tilt_max or center_offset > 0.35
        return PoseResult(True, float(tilt), float(spine_lean), bad)

    def close(self) -> None:
        if self._landmarker is not None:
            self._landmarker.close()
