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

    import numpy as np
    import cv2

    np_arr = np.frombuffer(decoded, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
