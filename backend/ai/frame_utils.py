"""Decode base64 webcam frames for monitoring endpoints."""

from __future__ import annotations

import base64


def decode_base64_image(image_data: str):
    """Return BGR numpy array or None. Imports cv2/numpy only when called."""
    if not image_data:
        return None
    if ";base64," in image_data:
        _, encoded = image_data.split(";base64,", 1)
    else:
        encoded = image_data
    try:
        decoded = base64.b64decode(encoded)
    except (ValueError, TypeError):
        return None

    return decode_image_bytes(decoded)


def decode_image_bytes(data: bytes):
    """Return BGR numpy array or None for raw encoded image bytes (e.g. a binary websocket frame)."""
    if not data:
        return None
    import numpy as np
    import cv2

    np_arr = np.frombuffer(data, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)


def encode_jpeg_bytes(frame_bgr, max_width: int = 320, quality: int = 65) -> tuple[bytes, int, int] | None:
    """Return ``(jpeg bytes, width, height)`` after downscaling to ``max_width``."""
    if frame_bgr is None:
        return None
    import cv2

    h, w = frame_bgr.shape[:2]
    if w > max_width:
        scale = max_width / w
        frame_bgr = cv2.resize(frame_bgr, (max_width, int(h * scale)))
        h, w = frame_bgr.shape[:2]
    ok, buf = cv2.imencode(".jpg", frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        return None
    return buf.tobytes(), w, h


def encode_jpeg_snapshot(frame_bgr, max_width: int = 320, quality: int = 65) -> str | None:
    """Return a data-URL JPEG suitable for observer thumbnails."""
    encoded = encode_jpeg_bytes(frame_bgr, max_width, quality)
    if encoded is None:
        return None
    return f"data:image/jpeg;base64,{base64.b64encode(encoded[0]).decode('ascii')}"
