"""Face detection — MediaPipe Tasks when available, OpenCV Haar fallback."""

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


@dataclass
class DetectedFace:
    bbox: tuple[int, int, int, int]
    landmarks: np.ndarray | None
    head_yaw_deg: float
    head_pitch_deg: float


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
                    min_face_detection_confidence=0.5,
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
        for face_lm in result.face_landmarks:
            pts = np.array([(lm.x * w, lm.y * h) for lm in face_lm])
            x_min, y_min = pts.min(axis=0)
            x_max, y_max = pts.max(axis=0)
            pad = 0.08
            bw, bh = x_max - x_min, y_max - y_min
            x0 = max(0, int(x_min - pad * bw))
            y0 = max(0, int(y_min - pad * bh))
            x1 = min(w, int(x_max + pad * bw))
            y1 = min(h, int(y_max + pad * bh))
            yaw, pitch = _estimate_head_pose(pts)
            faces.append(DetectedFace((x0, y0, x1 - x0, y1 - y0), pts, yaw, pitch))
        return faces

    def _detect_opencv(self, frame_bgr: np.ndarray) -> list[DetectedFace]:
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        rects = self._cascade.detectMultiScale(gray, 1.1, 5, minSize=(60, 60))
        faces: list[DetectedFace] = []
        h, w = frame_bgr.shape[:2]
        for x, y, bw, bh in rects:
            cx = x + bw / 2
            # Rough head-pose proxy from face position in frame
            yaw = float((cx - w / 2) / (w / 2) * 30)
            pitch = float((y + bh / 2 - h / 2) / (h / 2) * 20)
            faces.append(DetectedFace((int(x), int(y), int(bw), int(bh)), None, yaw, pitch))
        return faces

    def close(self) -> None:
        if self._landmarker is not None:
            self._landmarker.close()


def _estimate_head_pose(landmarks: np.ndarray) -> tuple[float, float]:
    idx = {"nose": 1, "chin": 152, "left_eye": 33, "right_eye": 263}
    try:
        nose = landmarks[idx["nose"]]
        chin = landmarks[idx["chin"]]
        le = landmarks[idx["left_eye"]]
        re = landmarks[idx["right_eye"]]
    except IndexError:
        return 0.0, 0.0
    eye_mid = (le + re) / 2
    eye_dist = np.linalg.norm(re - le) + 1e-6
    yaw = float(np.degrees(np.arctan2(nose[0] - eye_mid[0], eye_dist * 0.5)))
    pitch = float(np.degrees(np.arctan2(chin[1] - nose[1], np.linalg.norm(chin - nose) + 1e-6)))
    return yaw, pitch
