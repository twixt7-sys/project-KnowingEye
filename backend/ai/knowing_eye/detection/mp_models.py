"""Download MediaPipe task models on first use (stored under backend/ai/models/)."""

from __future__ import annotations

import urllib.request
from pathlib import Path

_MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
_CASCADES_DIR = _MODELS_DIR / "cascades"
_MODELS: dict[str, str] = {
    "face_landmarker.task": (
        "https://storage.googleapis.com/mediapipe-models/"
        "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    ),
    "pose_landmarker_lite.task": (
        "https://storage.googleapis.com/mediapipe-models/"
        "pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
    ),
    "pose_landmarker_full.task": (
        "https://storage.googleapis.com/mediapipe-models/"
        "pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
    ),
    "pose_landmarker_heavy.task": (
        "https://storage.googleapis.com/mediapipe-models/"
        "pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task"
    ),
}


def ensure_model(filename: str) -> Path:
    _MODELS_DIR.mkdir(parents=True, exist_ok=True)
    path = _MODELS_DIR / filename
    if path.exists() and path.stat().st_size > 0:
        return path
    url = _MODELS.get(filename)
    if not url:
        raise ValueError(f"Unknown model: {filename}")
    urllib.request.urlretrieve(url, path)
    return path


def cascade_path(filename: str) -> Path:
    """Path to a Haar cascade XML committed under ai/models/cascades/.

    cv2.data.haarcascades is NOT a reliable source for these - some
    opencv-python(-headless) releases (confirmed: 5.0.0.93) ship a cv2/data/
    directory with no cascade XMLs at all, which is what caused every
    monitoring frame to fail detection in production. Bundling our own copy
    (same BSD-licensed files OpenCV has shipped for years) sidesteps
    whatever the installed opencv wheel does or doesn't include.
    """
    path = _CASCADES_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Missing bundled cascade: {path}")
    return path


def load_cascade(filename: str):
    """Load a bundled Haar cascade, or return ``None`` if it can't be used.

    OpenCV 5 moved ``CascadeClassifier`` out of the main module, so on a 5.x
    wheel ``cv2.CascadeClassifier`` simply doesn't exist. That used to raise
    inside FaceDetector/PoseDetector __init__ and take the whole MediaPipe
    pipeline down with it (the adapter then silently fell back to the stub).
    The cascade is only the fallback path, so its absence must never be fatal.
    A cascade that fails to load returns an empty classifier rather than
    raising, so that is treated as unavailable too.
    """
    import cv2

    if not hasattr(cv2, "CascadeClassifier"):
        return None
    try:
        cascade = cv2.CascadeClassifier(str(cascade_path(filename)))
    except Exception:  # noqa: BLE001
        return None
    return None if cascade.empty() else cascade
