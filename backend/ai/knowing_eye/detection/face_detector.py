"""Face detection - MediaPipe Tasks when available, OpenCV Haar fallback."""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

_MEDIAPIPE_OK = False
try:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    from ai.knowing_eye.detection.mp_models import ensure_model

    _MEDIAPIPE_OK = True
except Exception:
    pass


@dataclass
class DetectedFace:
    bbox: tuple[int, int, int, int]
    landmarks: np.ndarray | None
    head_yaw_deg: float
    head_pitch_deg: float


_MIN_FACE_PX = 56
_MIN_FACE_AREA_RATIO = 0.012
_MAX_FACE_AREA_RATIO = 0.72
_MIN_ASPECT = 0.62
_MAX_ASPECT = 1.28


def _is_plausible_face(
    bbox: tuple[int, int, int, int],
    frame_w: int,
    frame_h: int,
    landmarks: np.ndarray | None = None,
) -> bool:
    x, y, bw, bh = bbox
    if bw < _MIN_FACE_PX or bh < _MIN_FACE_PX:
        return False
    frame_area = max(frame_w * frame_h, 1)
    face_area = bw * bh
    ratio = face_area / frame_area
    if ratio < _MIN_FACE_AREA_RATIO or ratio > _MAX_FACE_AREA_RATIO:
        return False
    aspect = bw / max(bh, 1)
    if aspect < _MIN_ASPECT or aspect > _MAX_ASPECT:
        return False
    if landmarks is not None and len(landmarks) >= 20:
        span_y = float(landmarks[:, 1].max() - landmarks[:, 1].min())
        if span_y < bh * 0.45:
            return False
    return True


class FaceDetector:
    def __init__(self) -> None:
        self._backend = "opencv"
        self._landmarker = None
        self._cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

        if _MEDIAPIPE_OK:
            try:
                model_path = ensure_model("face_landmarker.task")
                options = vision.FaceLandmarkerOptions(
                    base_options=mp_python.BaseOptions(model_asset_path=str(model_path)),
                    running_mode=vision.RunningMode.IMAGE,
                    num_faces=3,
                    min_face_detection_confidence=0.62,
                    output_facial_transformation_matrixes=True,
                )
                self._landmarker = vision.FaceLandmarker.create_from_options(options)
                self._backend = "mediapipe"
            except Exception:
                self._landmarker = None

    def detect(self, frame_bgr: np.ndarray) -> list[DetectedFace]:
        if self._backend == "mediapipe" and self._landmarker is not None:
            return self._detect_mediapipe(frame_bgr)
        return self._detect_opencv(frame_bgr)

    def _detect_mediapipe(self, frame_bgr: np.ndarray) -> list[DetectedFace]:
        h, w = frame_bgr.shape[:2]
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self._landmarker.detect(mp_image)
        faces: list[DetectedFace] = []
        if not result.face_landmarks:
            return faces
        matrices = getattr(result, "facial_transformation_matrixes", None) or []
        for i, face_lm in enumerate(result.face_landmarks):
            pts = np.array([(lm.x * w, lm.y * h) for lm in face_lm])
            x_min, y_min = pts.min(axis=0)
            x_max, y_max = pts.max(axis=0)
            pad = 0.08
            bw, bh = x_max - x_min, y_max - y_min
            x0 = max(0, int(x_min - pad * bw))
            y0 = max(0, int(y_min - pad * bh))
            x1 = min(w, int(x_max + pad * bw))
            y1 = min(h, int(y_max + pad * bh))
            bbox = (x0, y0, x1 - x0, y1 - y0)
            if not _is_plausible_face(bbox, w, h, pts):
                continue
            if i < len(matrices):
                yaw, pitch = _yaw_pitch_from_transform(matrices[i])
            else:
                yaw, pitch = _estimate_head_pose(pts, bbox)
            faces.append(DetectedFace(bbox, pts, yaw, pitch))
        return faces

    def _detect_opencv(self, frame_bgr: np.ndarray) -> list[DetectedFace]:
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        rects = self._cascade.detectMultiScale(gray, 1.08, 6, minSize=(72, 72))
        faces: list[DetectedFace] = []
        h, w = frame_bgr.shape[:2]
        for x, y, bw, bh in rects:
            bbox = (int(x), int(y), int(bw), int(bh))
            if not _is_plausible_face(bbox, w, h):
                continue
            cx = x + bw / 2
            # Rough head-pose proxy from face position in frame
            yaw = float((cx - w / 2) / (w / 2) * 30)
            pitch = float((y + bh / 2 - h / 2) / (h / 2) * 20)
            faces.append(DetectedFace(bbox, None, yaw, pitch))
        return faces

    def close(self) -> None:
        if self._landmarker is not None:
            self._landmarker.close()


def _yaw_pitch_from_transform(matrix) -> tuple[float, float]:
    """Extract head yaw/pitch (degrees) from MediaPipe's 4×4 face transform."""
    try:
        mat = np.array(matrix, dtype=float).reshape(4, 4)
        r = mat[:3, :3]
        sy = float(np.sqrt(r[0, 0] ** 2 + r[1, 0] ** 2))
        if sy >= 1e-6:
            pitch = float(np.degrees(np.arctan2(-r[2, 0], sy)))
            yaw = float(np.degrees(np.arctan2(r[1, 0], r[0, 0])))
        else:
            pitch = float(np.degrees(np.arctan2(-r[2, 0], sy)))
            yaw = float(np.degrees(np.arctan2(-r[1, 2], r[1, 1])))
        return yaw, pitch
    except Exception:
        return 0.0, 0.0


def _estimate_head_pose(
    landmarks: np.ndarray,
    bbox: tuple[int, int, int, int],
) -> tuple[float, float]:
    """Fallback pose estimate from landmark geometry when no transform matrix."""
    x0, y0, bw, bh = bbox
    if len(landmarks) > 1:
        nose = landmarks[1]
    else:
        nose = landmarks.mean(axis=0)
    cx = x0 + bw / 2
    cy = y0 + bh * 0.42
    yaw = float((nose[0] - cx) / max(bw / 2, 1) * 28)
    pitch = float((nose[1] - cy) / max(bh / 2, 1) * 22)
    return yaw, pitch
