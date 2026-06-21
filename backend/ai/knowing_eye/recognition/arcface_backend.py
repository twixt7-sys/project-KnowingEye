"""ArcFace identity embeddings via InsightFace (512-D, cosine distance)."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

EMBEDDING_DIM = 512


class ArcFaceBackend:
    """Lazy-loaded InsightFace ``FaceAnalysis`` recognizer (ArcFace / ArcNN weights)."""

    def __init__(self, model_name: str = "buffalo_l", ctx_id: int = -1) -> None:
        self._model_name = model_name
        self._ctx_id = ctx_id
        self._app = None
        self._load_error: str | None = None

    @property
    def available(self) -> bool:
        self._ensure_loaded()
        return self._app is not None

    @property
    def load_error(self) -> str | None:
        self._ensure_loaded()
        return self._load_error

    def _ensure_loaded(self) -> None:
        if self._app is not None or self._load_error is not None:
            return
        try:
            from insightface.app import FaceAnalysis

            app = FaceAnalysis(name=self._model_name, providers=["CPUExecutionProvider"])
            app.prepare(ctx_id=self._ctx_id, det_size=(640, 640))
            self._app = app
        except Exception as exc:  # noqa: BLE001 - degrade to next backend
            self._load_error = str(exc)
            self._app = None

    def encode_frame(
        self,
        frame_bgr: np.ndarray,
        bbox: tuple[int, int, int, int] | None = None,
    ) -> np.ndarray | None:
        self._ensure_loaded()
        if self._app is None:
            return None

        faces = self._app.get(frame_bgr)
        if not faces:
            return None

        face = self._pick_face(faces, bbox)
        if face is None:
            return None

        emb = getattr(face, "normed_embedding", None)
        if emb is None:
            return None
        vec = np.asarray(emb, dtype=np.float32).reshape(-1)
        if vec.shape[0] != EMBEDDING_DIM:
            return None
        return vec

    def encode_path(self, image_path: str | Path) -> np.ndarray | None:
        img = cv2.imread(str(image_path))
        if img is None:
            return None
        return self.encode_frame(img)

    @staticmethod
    def cosine_distance(reference: np.ndarray, current: np.ndarray) -> float:
        cosine = float(np.clip(np.dot(reference, current), -1.0, 1.0))
        return max(0.0, 1.0 - cosine)

    @staticmethod
    def _pick_face(faces, bbox: tuple[int, int, int, int] | None):
        if not faces:
            return None
        if bbox is None:
            return max(
                faces,
                key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]),
            )

        x, y, w, h = bbox
        cx, cy = x + w / 2.0, y + h / 2.0

        def _center_dist(face) -> float:
            fb = face.bbox
            fx = (fb[0] + fb[2]) / 2.0
            fy = (fb[1] + fb[3]) / 2.0
            return (fx - cx) ** 2 + (fy - cy) ** 2

        return min(faces, key=_center_dist)
