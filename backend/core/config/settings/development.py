"""Development settings - SQLite, debug toolbar-friendly defaults."""

from __future__ import annotations

from .base import *  # noqa: F403
from .base import Csv, decouple_config, env_bool

DEBUG = env_bool("DJANGO_DEBUG", default=True)

# Accept any Host in development so LAN IPs work without editing .env per network.
# Vite's proxy uses changeOrigin (Host=127.0.0.1); this covers direct backend access too.
if DEBUG:
    ALLOWED_HOSTS = ["*"]  # noqa: F405

CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL_ORIGINS", default=True)
CORS_ALLOWED_ORIGINS = decouple_config(  # noqa: F405
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173",
    cast=Csv(),  # noqa: F405
)
CORS_ALLOW_CREDENTIALS = True

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

import sys  # noqa: E402

if "test" in sys.argv:
    KNOWING_EYE["ENABLE_PIPELINE"] = False  # noqa: F405
    DATABASES = {  # noqa: F405
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
