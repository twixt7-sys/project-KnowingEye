"""Validation helpers for question attachments."""

from __future__ import annotations

import mimetypes

from django.conf import settings
from rest_framework.exceptions import ValidationError

ALLOWED_KINDS = {
    "image": {"image/jpeg", "image/png", "image/gif", "image/webp"},
    "pdf": {"application/pdf"},
    "audio": {"audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp3"},
}

MAX_BYTES = getattr(settings, "QUESTION_ATTACHMENT_MAX_BYTES", 10 * 1024 * 1024)


def infer_kind(content_type: str, filename: str) -> str:
    ct = (content_type or "").split(";")[0].strip().lower()
    if not ct or ct == "application/octet-stream":
        ct = mimetypes.guess_type(filename or "")[0] or ""
    for kind, mimes in ALLOWED_KINDS.items():
        if ct in mimes:
            return kind
    raise ValidationError({"file": f"Unsupported file type: {ct or 'unknown'}"})


def validate_attachment_file(uploaded_file) -> str:
    size = getattr(uploaded_file, "size", 0) or 0
    if size > MAX_BYTES:
        raise ValidationError({"file": f"File exceeds {MAX_BYTES // (1024 * 1024)} MB limit."})
    return infer_kind(getattr(uploaded_file, "content_type", ""), getattr(uploaded_file, "name", ""))
