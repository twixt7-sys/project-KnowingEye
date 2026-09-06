"""Synthetic test frame for the load-testing harness.

Matches the real frontend's capture profile (frontend/src/shared/hooks/
use-monitoring.ts): ~480px wide, JPEG quality 0.6, encoded as a data URL -
so the harness exercises realistic payload sizes without needing a real
webcam photo. A plain gradient + a face-like blob is enough: the AI
pipeline's face/pose detectors will most likely find nothing recognizable
in it (a synthetic image isn't a face), which is fine for a *capacity* load
test - the goal is measuring per-frame server cost (decode + inference +
persist + broadcast), not detection accuracy.
"""

from __future__ import annotations

import base64
import io

CAPTURE_MAX_WIDTH = 480
CAPTURE_HEIGHT = 360
JPEG_QUALITY = 60  # PIL scale 0-95; matches canvas.toDataURL quality 0.6


def build_frame_data_url() -> str:
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (CAPTURE_MAX_WIDTH, CAPTURE_HEIGHT), color=(40, 40, 45))
    draw = ImageDraw.Draw(img)
    # A soft oval + two dots - not a real face, just enough structure that
    # the payload isn't trivially compressible to nothing (real webcam
    # frames aren't flat color either).
    draw.ellipse((160, 80, 320, 280), fill=(210, 180, 160))
    draw.ellipse((200, 150, 220, 170), fill=(30, 30, 30))
    draw.ellipse((260, 150, 280, 170), fill=(30, 30, 30))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY)
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


if __name__ == "__main__":
    url = build_frame_data_url()
    print(f"Frame data URL length: {len(url)} chars (~{len(url) * 3 // 4} bytes decoded)")
