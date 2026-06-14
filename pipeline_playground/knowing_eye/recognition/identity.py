"""Facial identity consistency (playground: face_recognition; production: FaceNet/ArcFace)."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

try:
    import face_recognition
except ImportError:
    face_recognition = None  # type: ignore

# Cosine-distance boundary for the dependency-free appearance fallback (used
# when face_recognition / a deep model is not installed). Tuned so a matching
# face crop scores ~100% and a clearly different one drops below threshold.
_APPEARANCE_MATCH_CD = 0.15


class IdentityVerifier:
    """
    Enroll a reference face embedding per examinee session.

    Two backends, picked automatically:
      * ``face_recognition`` deep embeddings (128-d, Euclidean distance) when
        the library is installed — production should swap this for
        FaceNet/ArcFace per the project docs.
      * a dependency-free *appearance signature* (normalised 16×16 grayscale
        of the detected face crop, cosine distance) otherwise, so identity
        verification still functions on the detected face region.
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

    def embed(
        self, frame_bgr: np.ndarray, bbox: tuple[int, int, int, int]
    ) -> list[float] | None:
        """Return a JSON-serialisable face embedding for the given crop.

        Used to enrol a per-session reference that callers persist themselves
        (instead of relying on this object's single in-memory reference).
        """
        if self._available:
            emb = self._encode_crop(frame_bgr, bbox)
            return [float(x) for x in emb] if emb is not None else None
        sig = self._appearance_signature(frame_bgr, bbox)
        return [float(x) for x in sig] if sig is not None else None

    def verify_against(
        self,
        frame_bgr: np.ndarray,
        bbox: tuple[int, int, int, int],
        reference: list[float] | np.ndarray,
    ) -> tuple[bool | None, float | None]:
        """Compare the current face against an externally supplied reference
        embedding (e.g. one stored per exam session)."""
        if reference is None:
            return None, None
        cur = self.embed(frame_bgr, bbox)
        if cur is None:
            return False, self._threshold * 2
        ref = np.asarray(reference, dtype=float)
        vec = np.asarray(cur, dtype=float)
        if ref.shape != vec.shape:
            return None, None

        if self._available and ref.shape[0] == 128:
            dist = float(np.linalg.norm(ref - vec))
            return dist <= self._threshold, dist

        # Appearance fallback: cosine distance, rescaled so it can reuse the
        # same configured match threshold downstream.
        cosine = float(np.clip(np.dot(ref, vec), -1.0, 1.0))
        cd = max(0.0, 1.0 - cosine)
        distance = cd * (self._threshold / _APPEARANCE_MATCH_CD)
        return cd <= _APPEARANCE_MATCH_CD, distance

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
