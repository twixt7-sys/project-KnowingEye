"""Facial identity consistency - ArcFace (primary), face_recognition, or appearance fallback."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from ai.knowing_eye.recognition.arcface_backend import ArcFaceBackend, EMBEDDING_DIM as ARCFACE_DIM

try:
    import face_recognition
except ImportError:
    face_recognition = None  # type: ignore

# Cosine-distance boundary for the dependency-free appearance fallback (used
# when ArcFace / face_recognition is not installed). Tuned so a matching
# face crop scores ~100% and a clearly different one drops below threshold.
_APPEARANCE_MATCH_CD = 0.15
_FACE_RECOGNITION_DIM = 128
_APPEARANCE_DIM = 256


def _default_threshold(backend: str) -> float:
    if backend == "arcface":
        return 0.42
    if backend == "face_recognition":
        return 0.6
    return _APPEARANCE_MATCH_CD


class IdentityVerifier:
    """
    Enroll a reference face embedding per examinee session.

    Backends (selected via ``embedding_backend`` config, with automatic fallback):
      * ``arcface`` - 512-D InsightFace / ArcFace embeddings (cosine distance)
      * ``face_recognition`` - 128-D dlib embeddings (L2 distance)
      * ``appearance`` - normalised 16×16 grayscale crop (cosine distance)
    """

    def __init__(
        self,
        match_threshold: float | None = None,
        backend: str = "arcface",
        arcface_model: str = "buffalo_l",
    ) -> None:
        requested = (backend or "arcface").lower()
        self._requested_backend = requested
        self._arcface = ArcFaceBackend(model_name=arcface_model)
        self._face_recognition_ok = face_recognition is not None
        self._active_backend = self._resolve_backend(requested)
        self._threshold = (
            match_threshold
            if match_threshold is not None
            else _default_threshold(self._active_backend)
        )
        self._reference: np.ndarray | None = None

    @property
    def backend(self) -> str:
        return self._active_backend

    @property
    def requested_backend(self) -> str:
        return self._requested_backend

    @property
    def enrolled(self) -> bool:
        return self._reference is not None

    def _resolve_backend(self, requested: str) -> str:
        if requested == "appearance":
            return "appearance"
        if requested == "arcface" and self._arcface.available:
            return "arcface"
        if requested in ("arcface", "face_recognition") and self._face_recognition_ok:
            return "face_recognition"
        return "appearance"

    def enroll_from_frame(self, frame_bgr: np.ndarray, bbox: tuple[int, int, int, int]) -> bool:
        emb = self._encode_crop(frame_bgr, bbox)
        if emb is None:
            return False
        self._reference = emb
        return True

    def enroll_from_path(self, image_path: str | Path) -> bool:
        if self._active_backend == "arcface":
            emb = self._arcface.encode_path(image_path)
            if emb is None:
                return False
            self._reference = emb
            return True
        if self._active_backend == "face_recognition" and self._face_recognition_ok:
            img = face_recognition.load_image_file(str(image_path))
            encs = face_recognition.face_encodings(img)
            if not encs:
                return False
            self._reference = encs[0]
            return True
        return False

    def verify(self, frame_bgr: np.ndarray, bbox: tuple[int, int, int, int]) -> tuple[bool | None, float | None]:
        if self._reference is None:
            return None, None
        emb = self._encode_crop(frame_bgr, bbox)
        if emb is None:
            return False, self._threshold * 2
        match, dist = self._compare_vectors(self._reference, emb)
        return match, dist

    def embed(
        self, frame_bgr: np.ndarray, bbox: tuple[int, int, int, int]
    ) -> list[float] | None:
        """Return a JSON-serialisable face embedding for the given crop."""
        emb = self._encode_crop(frame_bgr, bbox)
        return [float(x) for x in emb] if emb is not None else None

    def verify_against(
        self,
        frame_bgr: np.ndarray,
        bbox: tuple[int, int, int, int],
        reference: list[float] | np.ndarray,
    ) -> tuple[bool | None, float | None]:
        """Compare the current face against an externally supplied reference embedding."""
        if reference is None:
            return None, None
        cur = self.embed(frame_bgr, bbox)
        if cur is None:
            return False, self._threshold * 2
        ref = np.asarray(reference, dtype=float)
        vec = np.asarray(cur, dtype=float)
        if ref.shape != vec.shape:
            return None, None
        return self._compare_vectors(ref, vec)

    def _compare_vectors(
        self, reference: np.ndarray, current: np.ndarray
    ) -> tuple[bool, float]:
        dim = reference.shape[0]
        if dim == ARCFACE_DIM:
            dist = ArcFaceBackend.cosine_distance(reference, current)
            return dist <= self._threshold, dist
        if dim == _FACE_RECOGNITION_DIM:
            dist = float(np.linalg.norm(reference - current))
            return dist <= self._threshold, dist
        if dim == _APPEARANCE_DIM:
            cosine = float(np.clip(np.dot(reference, current), -1.0, 1.0))
            cd = max(0.0, 1.0 - cosine)
            distance = cd * (self._threshold / _APPEARANCE_MATCH_CD)
            return cd <= _APPEARANCE_MATCH_CD, distance
        cosine = float(np.clip(np.dot(reference, current), -1.0, 1.0))
        dist = max(0.0, 1.0 - cosine)
        return dist <= self._threshold, dist

    def _encode_crop(self, frame_bgr: np.ndarray, bbox: tuple[int, int, int, int]) -> np.ndarray | None:
        if self._active_backend == "arcface":
            return self._arcface.encode_frame(frame_bgr, bbox)
        if self._active_backend == "face_recognition" and self._face_recognition_ok:
            return self._encode_face_recognition_crop(frame_bgr, bbox)
        return self._appearance_signature(frame_bgr, bbox)

    def _appearance_signature(
        self, frame_bgr: np.ndarray, bbox: tuple[int, int, int, int]
    ) -> np.ndarray | None:
        x, y, w, h = bbox
        crop = frame_bgr[y : y + h, x : x + w]
        if crop.size == 0:
            return None
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        small = cv2.resize(gray, (16, 16)).astype("float32").flatten()
        norm = float(np.linalg.norm(small))
        if norm < 1e-6:
            return None
        return small / norm

    def _encode_face_recognition_crop(
        self, frame_bgr: np.ndarray, bbox: tuple[int, int, int, int]
    ) -> np.ndarray | None:
        if not self._face_recognition_ok:
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
