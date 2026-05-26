"""
ASGI entrypoint for Knowing Eye.

Routes HTTP requests through Django and WebSocket requests through Channels,
with JWT-aware authentication for monitoring streams.
"""

from __future__ import annotations

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.config.settings")

django_asgi_app = get_asgi_application()

# Imported *after* Django is configured so that apps + models are loadable.
from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

from features.monitoring.routing import websocket_urlpatterns  # noqa: E402
from features.monitoring.middleware import JWTAuthMiddlewareStack  # noqa: E402


application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            JWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        ),
    }
)
