"""Shared helpers for Django REST API tests."""

from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image


def validation_details(response) -> dict:
    """Return field-level validation errors from a DRF response (envelope or flat)."""
    data = response.data
    if isinstance(data, dict) and "error" in data:
        details = data.get("error", {}).get("details")
        if isinstance(details, dict):
            return details
    return data if isinstance(data, dict) else {}


def sample_avatar_file(name: str = "avatar.jpg") -> SimpleUploadedFile:
    """Minimal valid JPEG for registration / avatar upload tests."""
    buffer = BytesIO()
    Image.new("RGB", (1, 1), color="red").save(buffer, format="JPEG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")
