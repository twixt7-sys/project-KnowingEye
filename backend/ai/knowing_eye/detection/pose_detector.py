"""Posture estimation - MediaPipe when available, heuristic fallback from face position."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import cv2
import numpy as np

from ai.knowing_eye.detection.mp_models import cascade_path

logger = logging.getLogger("knowing_eye.ai.detection")

_MEDIAPIPE_OK = False
try:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    from ai.knowing_eye.detection.mp_models import ensure_model

    _MEDIAPIPE_OK = True
except Exception:
    logger.warning("MediaPipe unavailable, pose detection will use OpenCV Haar fallback", exc_info=True)

_LEFT_SHOULDER, _RIGHT_SHOULDER, _NOSE = 11, 12, 0
_FALLBACK_OFFCENTER_MAX = 0.35

# MediaPipe always returns all 33 landmarks, guessing positions for parts that
# are out of frame. A landmark only counts as "seen" at or above this visibility.
_MIN_VISIBILITY = 0.5


@dataclass
class PoseResult:
    detected: bool
    shoulder_tilt_ratio: float | None
    spine_lean_ratio: float | None
    bad_posture: bool
    # 0-1 confidence that both shoulders are actually in view (drives Up).
    upper_body_visibility: float | None = None


class PoseDetector:
    def __init__(self, shoulder_tilt_max: float = 0.12, spine_lean_max: float = 0.55) -> None:
        self._shoulder_tilt_max = shoulder_tilt_max
        self._spine_lean_max = spine_lean_max
        self._landmarker = None
        self._backend = "opencv"
        body = cv2.CascadeClassifier(str(cascade_path("haarcascade_upperbody.xml")))
        # See face_detector.py's identical guard - CascadeClassifier() doesn't
        # raise on a failed load, it just throws on first detectMultiScale()
        # call, which crashed every monitoring frame in production.
        self._body = body if not body.empty() else None
        if self._body is None:
            logger.error("Haar cascade failed to load from %s", cascade_path("haarcascade_upperbody.xml"))

        if _MEDIAPIPE_OK:
            try:
                model_path = ensure_model("pose_landmarker_lite.task")
                options = vision.PoseLandmarkerOptions(
                    base_options=mp_python.BaseOptions(model_asset_path=str(model_path)),
                    running_mode=vision.RunningMode.IMAGE,
                    min_pose_detection_confidence=0.5,
                )
                self._landmarker = vision.PoseLandmarker.create_from_options(options)
                self._backend = "mediapipe"
            except Exception:
                self._landmarker = None

    @property
    def backend(self) -> str:
        """``"mediapipe"``, or ``"opencv"`` (the Haar fallback - unusable if the

        cascade XML failed to load, in which case pose is never detected and
        upper-body presence is permanently 0%).
        """
        if self._landmarker is not None:
            return "mediapipe"
        return "opencv" if self._body is not None else "opencv (cascade unavailable - no detection)"

    def detect(self, frame_bgr: np.ndarray) -> PoseResult:
        if self._landmarker is not None:
            return self._detect_mediapipe(frame_bgr)
        return self._detect_heuristic(frame_bgr)

    def _detect_mediapipe(self, frame_bgr: np.ndarray) -> PoseResult:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self._landmarker.detect(mp_image)
        if not result.pose_landmarks:
            return PoseResult(False, None, None, False, 0.0)
        lm = result.pose_landmarks[0]

        ls, rs, nose = lm[_LEFT_SHOULDER], lm[_RIGHT_SHOULDER], lm[_NOSE]
        shoulder_w = abs(ls.x - rs.x) + 1e-6
        tilt = abs(ls.y - rs.y) / shoulder_w
        # Sideways lean: head offset from the shoulder midpoint, in shoulder widths.
        # Hips are deliberately not used - a desk webcam frames the upper body only,
        # so hip landmarks are extrapolated guesses and made this ratio blow up.
        mid_x = (ls.x + rs.x) / 2
        spine_lean = abs(nose.x - mid_x) / shoulder_w
        bad = tilt > self._shoulder_tilt_max or spine_lean > self._spine_lean_max
        return PoseResult(True, float(tilt), float(spine_lean), bad)

    def _detect_heuristic(self, frame_bgr: np.ndarray) -> PoseResult:
        if self._body is None:
            return PoseResult(False, None, None, False, 0.0)
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        bodies = self._body.detectMultiScale(gray, 1.1, 4, minSize=(80, 80))
        if len(bodies) == 0:
            return PoseResult(False, None, None, False, 0.0)
        x, y, bw, bh = max(bodies, key=lambda r: r[2] * r[3])
        h, w = frame_bgr.shape[:2]
        # Proxy: off-center upper body suggests lean. Scaled so an offset of
        # _FALLBACK_OFFCENTER_MAX lands exactly on the configured lean limit.
        center_offset = abs((x + bw / 2) - w / 2) / (w / 2)
        tilt = center_offset * 0.15
        spine_lean = center_offset * self._spine_lean_max / _FALLBACK_OFFCENTER_MAX
        bad = tilt > self._shoulder_tilt_max or center_offset > _FALLBACK_OFFCENTER_MAX
        return PoseResult(True, float(tilt), float(spine_lean), bad)

    def close(self) -> None:
        if self._landmarker is not None:
            self._landmarker.close()


def _visibility(landmark) -> float:
    return float(getattr(landmark, "visibility", None) or 0.0)


def _in_frame(landmark, margin: float = 0.05) -> bool:
    return -margin <= landmark.x <= 1.0 + margin and -margin <= landmark.y <= 1.0 + margin
