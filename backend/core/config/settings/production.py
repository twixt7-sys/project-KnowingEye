"""Production settings - hardened cookies, HSTS, strict CORS."""

from __future__ import annotations

import sys

from .base import *  # noqa: F403
from .base import Csv, decouple_config, env_bool

DEBUG = env_bool("DJANGO_DEBUG", default=False)

if SECRET_KEY.startswith("django-insecure"):  # noqa: F405
    sys.stderr.write(
        "WARNING: DJANGO_SECRET_KEY is still the insecure default. "
        "Set a strong secret before deploying to production.\n"
    )

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = decouple_config(
    "CORS_ALLOWED_ORIGINS",
    default="",
    cast=Csv(),  # noqa: F405
)
CORS_ALLOW_CREDENTIALS = True

SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", default=True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "same-origin"
SECURE_HSTS_SECONDS = int(decouple_config("SECURE_HSTS_SECONDS", default="31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
