"""Server-side image compression for user uploads.

Uploads are downscaled and re-encoded as WebP so stored media (and every
page that renders it) stays small. The helper fails open: anything it cannot
decode, animated GIFs, and re-encodes that would not actually be smaller are
returned untouched, so compression can never reject an upload.
"""

from __future__ import annotations

import logging
import os
from io import BytesIO

from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

AVATAR_MAX_DIMENSION = 512
OPTION_IMAGE_MAX_DIMENSION = 800
ATTACHMENT_IMAGE_MAX_DIMENSION = 1600
DEFAULT_QUALITY = 82

# Images already within bounds and this small aren't worth a lossy re-encode.
SKIP_BELOW_BYTES = 60 * 1024

# A re-encode must save at least this fraction of the original to be kept;
# otherwise an already-optimised file would just be lossy-encoded twice.
MIN_SAVINGS = 0.10


def compress_image(
    uploaded,
    *,
    max_dimension: int,
    quality: int = DEFAULT_QUALITY,
):
    """Return a smaller WebP version of ``uploaded``, or ``uploaded`` itself."""
    try:
        uploaded.seek(0)
        original_size = getattr(uploaded, "size", None) or len(uploaded.read())
        uploaded.seek(0)
        with Image.open(uploaded) as img:
            if img.format == "GIF" and getattr(img, "n_frames", 1) > 1:
                uploaded.seek(0)
                return uploaded
            if max(img.size) <= max_dimension and original_size <= SKIP_BELOW_BYTES:
                uploaded.seek(0)
                return uploaded
            img = ImageOps.exif_transpose(img)  # bake in rotation before metadata is dropped
            img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
            has_alpha = img.mode in ("RGBA", "LA") or "transparency" in img.info
            img = img.convert("RGBA" if has_alpha else "RGB")
            buffer = BytesIO()
            img.save(buffer, format="WEBP", quality=quality, method=6)
    except Exception:  # noqa: BLE001 - undecodable input is the caller's validation problem
        logger.debug("Image compression skipped", exc_info=True)
        try:
            uploaded.seek(0)
        except Exception:  # noqa: BLE001
            pass
        return uploaded

    if buffer.tell() > original_size * (1 - MIN_SAVINGS):
        uploaded.seek(0)
        return uploaded

    buffer.seek(0)
    stem = os.path.splitext(os.path.basename(getattr(uploaded, "name", "") or "image"))[0] or "image"
    return InMemoryUploadedFile(
        file=buffer,
        field_name=getattr(uploaded, "field_name", None),
        name=f"{stem}.webp",
        content_type="image/webp",
        size=buffer.getbuffer().nbytes,
        charset=None,
    )
