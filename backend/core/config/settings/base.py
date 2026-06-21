"""
Shared Django settings for Knowing Eye (development + production).

Environment-specific overrides live in ``development.py`` and ``production.py``.
Select via ``DJANGO_ENV=development|production`` (see ``__init__.py``).
"""

from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

try:
    from decouple import Csv, config as decouple_config  # type: ignore
except ImportError:  # pragma: no cover

    def decouple_config(key, default=None, cast=None):
        value = os.environ.get(key, default)
        if cast is None or value is None:
            return value
        if cast is bool:
            return str(value).lower() in {"1", "true", "yes", "on"}
        if callable(cast):
            return cast(value)
        return value

    def Csv():  # type: ignore[misc]
        return lambda v: [item.strip() for item in str(v).split(",") if item.strip()]


def env_bool(key: str, default: bool) -> bool:
    return decouple_config(key, default=default, cast=bool)


BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent  # backend/
REPO_ROOT = BASE_DIR.parent
AI_PIPELINE_CONFIG = BASE_DIR / "ai" / "config" / "pipeline.yaml"

SECRET_KEY = decouple_config(
    "DJANGO_SECRET_KEY",
    default="django-insecure-change-me-in-production-via-DJANGO_SECRET_KEY",
)
ALLOWED_HOSTS = decouple_config(
    "DJANGO_ALLOWED_HOSTS",
    default="localhost,127.0.0.1,0.0.0.0,testserver",
    cast=Csv(),
)

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "channels",
    "core",
    "features.authentication",
    "features.exams",
    "features.session",
    "features.monitoring",
    "features.behavior",
    "features.reports",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.config.wsgi.application"
ASGI_APPLICATION = "core.config.asgi.application"

DB_ENGINE = decouple_config("DB_ENGINE", default="django.db.backends.sqlite3")

if DB_ENGINE == "django.db.backends.postgresql":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": decouple_config("DB_NAME", default="knowing_eye"),
            "USER": decouple_config("DB_USER", default="postgres"),
            "PASSWORD": decouple_config("DB_PASSWORD", default="postgres"),
            "HOST": decouple_config("DB_HOST", default="localhost"),
            "PORT": decouple_config("DB_PORT", default="5432"),
            "CONN_MAX_AGE": int(decouple_config("DB_CONN_MAX_AGE", default="60")),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
            "OPTIONS": {"timeout": 30},
        }
    }

REDIS_URL = decouple_config("REDIS_URL", default="")
if REDIS_URL:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [REDIS_URL]},
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = decouple_config("DJANGO_TIME_ZONE", default="UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "authentication.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "core.pagination.StandardResultsPagination",
    "PAGE_SIZE": 10,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "EXCEPTION_HANDLER": "core.exceptions.handlers.custom_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "user": "1200/min",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(decouple_config("JWT_ACCESS_TTL_MIN", default="60"))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(decouple_config("JWT_REFRESH_TTL_DAYS", default="7"))
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
}

LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{asctime} [{levelname}] {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
            "level": "INFO",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(LOGS_DIR / "knowing_eye.log"),
            "maxBytes": 5 * 1024 * 1024,
            "backupCount": 5,
            "formatter": "verbose",
            "level": "INFO",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "knowing_eye": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
    },
    "root": {"handlers": ["console", "file"], "level": "INFO"},
}

KNOWING_EYE = {
    "PIPELINE_CONFIG": str(AI_PIPELINE_CONFIG),
    "ENABLE_PIPELINE": env_bool("KE_ENABLE_PIPELINE", default=True),
    "STORE_FRAMES": env_bool("KE_STORE_FRAMES", default=False),
    "ALERT_THRESHOLD": float(decouple_config("KE_ALERT_THRESHOLD", default="80")),
}
