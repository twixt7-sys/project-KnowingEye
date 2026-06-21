"""Reusable input validation helpers."""

from __future__ import annotations

import re
from typing import Any

from django.core.exceptions import ValidationError


def require_non_blank(value: Any, field: str = "value") -> str:
    text = str(value or "").strip()
    if not text:
        raise ValidationError({field: "This field is required."})
    return text


def validate_phone(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return text
    if not re.fullmatch(r"[\d+\-\s()]{7,32}", text):
        raise ValidationError({"phone": "Enter a valid phone number."})
    return text


def validate_percentage(value: float | int, field: str = "value") -> float:
    try:
        pct = float(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError({field: "Must be a number."}) from exc
    if pct < 0 or pct > 100:
        raise ValidationError({field: "Must be between 0 and 100."})
    return pct
