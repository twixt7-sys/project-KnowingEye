"""Download MediaPipe task models on first use (stored under backend/ai/models/)."""

from __future__ import annotations

import urllib.request
from pathlib import Path

_MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
_MODELS: dict[str, str] = {
    "face_landmarker.task": (
        "https://storage.googleapis.com/mediapipe-models/"
        "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    ),
    "pose_landmarker_lite.task": (
        "https://storage.googleapis.com/mediapipe-models/"
        "pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
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
