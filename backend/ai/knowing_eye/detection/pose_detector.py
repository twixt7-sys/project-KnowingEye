"""Posture estimation - MediaPipe when available, heuristic fallback from face position."""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass

import cv2
import numpy as np

from ai.knowing_eye.detection.mp_models import cascade_path, load_cascade

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

# BlazePose landmark indices. Hips (23/24) are deliberately NOT used: at normal
# webcam framing they are below the frame edge, and MediaPipe still returns
# extrapolated (low-visibility) hip points - the old hip-based spine-lean ratio
# was computed from those guesses, so it was mostly noise.
_NOSE, _LEFT_EAR, _RIGHT_EAR, _LEFT_SHOULDER, _RIGHT_SHOULDER = 0, 7, 8, 11, 12
_FALLBACK_OFFCENTER_MAX = 0.35

# MediaPipe always returns all 33 landmarks, guessing positions for parts that
# are out of frame. A landmark only counts as "seen" at or above this visibility.
_MIN_VISIBILITY = 0.5

_POSE_MODELS = ("lite", "full", "heavy")


@dataclass
class PoseResult:
    detected: bool
    shoulder_tilt_ratio: float | None
    spine_lean_ratio: float | None
    bad_posture: bool
    # 0-1 confidence that both shoulders are actually in view (drives Up).
    upper_body_visibility: float | None = None


class PoseDetector:
    """Upper-body posture from MediaPipe Pose landmarks.

    * ``shoulder_tilt_ratio`` - |dy| / |dx| between the shoulders (tan of the
      shoulder-line angle; 0.18 ~= 10 degrees). Captures whole-torso side lean.
    * ``spine_lean_ratio`` - head offset from the shoulder midpoint, measured
      along the shoulder axis and normalised by shoulder width. 0 = head centred
      over the torso, 0.5 = head directly above one shoulder. Uses the ear
      midpoint (stable under head rotation) and falls back to the nose.
    * ``upper_body_visibility`` - the lower of the two shoulders' visibility.

    Both ratios are scale-invariant (distance to camera doesn't matter) and only
    use landmarks that are actually visible in a webcam frame.
    """

    def __init__(
        self,
        shoulder_tilt_max: float = 0.18,
        spine_lean_max: float = 0.30,
        model: str = "full",
        min_visibility: float = _MIN_VISIBILITY,
    ) -> None:
        self._shoulder_tilt_max = shoulder_tilt_max
        self._spine_lean_max = spine_lean_max
        self._min_visibility = min_visibility
        self._landmarker = None
        self._model = None
        # See face_detector.py's identical guard / load_cascade().
        self._body = load_cascade("haarcascade_upperbody.xml")
        if self._body is None:
            logger.error("Haar cascade unavailable: %s", cascade_path("haarcascade_upperbody.xml"))

        if _MEDIAPIPE_OK:
            requested = model if model in _POSE_MODELS else "full"
            # Fall back to the lite model if the requested one can't be fetched
            # (e.g. offline host with only the bundled lite .task file).
            for candidate in dict.fromkeys((requested, "lite")):
                try:
                    model_path = ensure_model(f"pose_landmarker_{candidate}.task")
                    options = vision.PoseLandmarkerOptions(
                        base_options=mp_python.BaseOptions(model_asset_path=str(model_path)),
                        running_mode=vision.RunningMode.IMAGE,
                        min_pose_detection_confidence=0.5,
                        min_pose_presence_confidence=0.5,
                    )
                    self._landmarker = vision.PoseLandmarker.create_from_options(options)
                    self._model = candidate
                    break
                except Exception:
                    logger.warning("MediaPipe pose model %r failed to load", candidate, exc_info=True)
                    self._landmarker = None

    @property
    def backend(self) -> str:
        """``"mediapipe (<model>)"``, or ``"opencv"`` (the Haar fallback - unusable if the

        cascade XML failed to load, in which case pose is never detected and
        upper-body presence is permanently 0%).
        """
        if self._landmarker is not None:
            return f"mediapipe ({self._model})"
        return "opencv" if self._body is not None else "opencv (cascade unavailable - no detection)"

    def detect(self, frame_bgr: np.ndarray) -> PoseResult:
        if self._landmarker is not None:
            return self._detect_mediapipe(frame_bgr)
        return self._detect_heuristic(frame_bgr)

    def _detect_mediapipe(self, frame_bgr: np.ndarray) -> PoseResult:
        h, w = frame_bgr.shape[:2]
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self._landmarker.detect(mp_image)
        if not result.pose_landmarks:
            return PoseResult(False, None, None, False, 0.0)
        return self._measure(result.pose_landmarks[0], w, h)

    def _measure(self, lm, w: int, h: int) -> PoseResult:
        ls, rs = lm[_LEFT_SHOULDER], lm[_RIGHT_SHOULDER]
        visibility = min(_visibility(ls), _visibility(rs))
        # Upper body only counts as present when both shoulders are actually
        # seen and on screen - MediaPipe always emits all 33 points, including
        # guessed ones.
        if visibility < self._min_visibility or not (_in_frame(ls) and _in_frame(rs)):
            return PoseResult(False, None, None, False, visibility)

        # Pixel space, so the ratios aren't distorted by a non-square frame.
        lsx, lsy, rsx, rsy = ls.x * w, ls.y * h, rs.x * w, rs.y * h
        dx, dy = rsx - lsx, rsy - lsy
        shoulder_w = math.hypot(dx, dy)
        if shoulder_w < 0.05 * w:
            return PoseResult(False, None, None, False, visibility)

        tilt = abs(dy) / max(abs(dx), 1e-6)

        le, re, nose = lm[_LEFT_EAR], lm[_RIGHT_EAR], lm[_NOSE]
        if min(_visibility(le), _visibility(re)) >= self._min_visibility:
            hx, hy = (le.x + re.x) / 2 * w, (le.y + re.y) / 2 * h
        elif _visibility(nose) >= self._min_visibility:
            hx, hy = nose.x * w, nose.y * h
        else:
            hx = hy = None

        lean: float | None = None
        if hx is not None:
            mx, my = (lsx + rsx) / 2, (lsy + rsy) / 2
            # Project the head offset onto the shoulder axis: a rigid whole-body
            # lean rotates both together (caught by tilt), while leaning the head
            # out over one shoulder shows up here.
            lean = abs((hx - mx) * dx + (hy - my) * dy) / (shoulder_w * shoulder_w)

        bad = tilt > self._shoulder_tilt_max or (lean is not None and lean > self._spine_lean_max)
        return PoseResult(True, float(tilt), None if lean is None else float(lean), bad, visibility)

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
    vis = getattr(landmark, "visibility", None)
    return 1.0 if vis is None else float(vis)


def _in_frame(landmark, margin: float = 0.05) -> bool:
    return -margin <= landmark.x <= 1.0 + margin and -margin <= landmark.y <= 1.0 + margin
