"""Frame preprocessing - decode, resize, denoise, and normalize for inference."""

from __future__ import annotations

import base64
from io import BytesIO
from typing import Any

import cv2
import numpy as np
from PIL import Image


def decode_image(data: bytes | str) -> np.ndarray:
    """Decode raw bytes or base64 string to BGR numpy array."""
    if isinstance(data, str):
        if "," in data:
            data = data.split(",", 1)[1]
        raw = base64.b64decode(data)
    else:
        raw = data
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        pil = Image.open(BytesIO(raw)).convert("RGB")
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    return img


def resize_frame(frame: np.ndarray, max_width: int = 640) -> np.ndarray:
    h, w = frame.shape[:2]
    if w <= max_width:
        return frame
    scale = max_width / w
    return cv2.resize(frame, (max_width, int(h * scale)), interpolation=cv2.INTER_AREA)


def reduce_noise(frame_bgr: np.ndarray, strength: str = "light") -> np.ndarray:
    """Apply fast non-local means denoising (preserves edges for CV models)."""
    if strength == "off":
        return frame_bgr
    h = frame_bgr.shape[0]
    if strength == "light" or h <= 360:
        return cv2.fastNlMeansDenoisingColored(frame_bgr, None, 4, 4, 7, 21)
    return cv2.fastNlMeansDenoisingColored(frame_bgr, None, 6, 6, 7, 21)


def normalize_frame(frame_bgr: np.ndarray) -> np.ndarray:
    """Histogram equalization on the luminance channel for stable lighting."""
    ycrcb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2YCrCb)
    y, cr, cb = cv2.split(ycrcb)
    y = cv2.equalizeHist(y)
    merged = cv2.merge([y, cr, cb])
    return cv2.cvtColor(merged, cv2.COLOR_YCrCb2BGR)


def prepare_frame(frame_bgr: np.ndarray, config: dict[str, Any] | None = None) -> np.ndarray:
    """Full preprocessing chain used before every model inference pass."""
    prep = (config or {}).get("preprocessing", {})
    max_width = int(prep.get("max_width", 640))
    denoise = str(prep.get("denoise", "light"))
    normalize = bool(prep.get("normalize_histogram", True))

    frame = resize_frame(frame_bgr, max_width=max_width)
    if denoise != "off":
        frame = reduce_noise(frame, strength=denoise)
    if normalize:
        frame = normalize_frame(frame)
    return frame
