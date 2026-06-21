"""
Load development or production settings based on ``DJANGO_ENV``.

    DJANGO_ENV=development  (default) → core.config.settings.development
    DJANGO_ENV=production             → core.config.settings.production
"""

from __future__ import annotations

import os

_env = os.environ.get("DJANGO_ENV", "development").strip().lower()

if _env == "production":
    from .production import *  # noqa: F403
else:
    from .development import *  # noqa: F403
