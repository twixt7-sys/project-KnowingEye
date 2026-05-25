"""Facial identity consistency (playground: face_recognition; production: FaceNet/ArcFace)."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

try:
    import face_recognition
except ImportError:
    face_recognition = None  # type: ignore


class IdentityVerifier:
    """
    Enroll a reference face embedding per examinee session.
    Production main system should swap backend to FaceNet/ArcFace per project docs.
    """

    def __init__(self, match_threshold: float = 0.6) -> None:
        self._threshold = match_threshold
        self._reference: np.ndarray | None = None
        self._available = face_recognition is not None

    @property
    def enrolled(self) -> bool:
        return self._reference is not None

    def enroll_from_frame(self, frame_bgr: np.ndarray, bbox: tuple[int, int, int, int]) -> bool:
        emb = self._encode_crop(frame_bgr, bbox)
        if emb is None:
            return False
        self._reference = emb
        return True

    def enroll_from_path(self, image_path: str | Path) -> bool:
        if not self._available:
            return False
        img = face_recognition.load_image_file(str(image_path))
        encs = face_recognition.face_encodings(img)
        if not encs:
            return False
        self._reference = encs[0]
        return True

    def verify(self, frame_bgr: np.ndarray, bbox: tuple[int, int, int, int]) -> tuple[bool | None, float | None]:
        if not self._available or self._reference is None:
            return None, None
        emb = self._encode_crop(frame_bgr, bbox)
        if emb is None:
            return False, 1.0
        dist = float(np.linalg.norm(self._reference - emb))
        return dist <= self._threshold, dist

    def _encode_crop(self, frame_bgr: np.ndarray, bbox: tuple[int, int, int, int]) -> np.ndarray | None:
        if not self._available:
            return None
        x, y, w, h = bbox
        crop = frame_bgr[y : y + h, x : x + w]
        if crop.size == 0:
            return None
        rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
        locs = face_recognition.face_locations(rgb, model="hog")
        if not locs:
            return None
        encs = face_recognition.face_encodings(rgb, known_face_locations=locs)
        return encs[0] if encs else None
