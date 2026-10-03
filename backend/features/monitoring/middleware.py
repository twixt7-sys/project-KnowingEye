"""JWT-based authentication middleware for Channels WebSockets.

Accepts the access token from either:
    * the ``Authorization: Bearer <token>`` header, or
    * the ``?token=<token>`` query string (browsers can't set WS headers).
"""

from __future__ import annotations

from urllib.parse import parse_qs

from channels.auth import AuthMiddlewareStack
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser


User = get_user_model()


@database_sync_to_async
def _get_user(user_id):
    try:
        return User.objects.get(pk=user_id, is_active=True)
    except User.DoesNotExist:
        return AnonymousUser()


def _extract_token(scope) -> str | None:
    headers = dict(scope.get("headers") or [])
    auth = headers.get(b"authorization", b"").decode("latin-1")
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()

    query_string = scope.get("query_string", b"").decode("latin-1")
    params = parse_qs(query_string)
    token = params.get("token") or params.get("access")
    if token:
        return token[0]
    return None


class JWTAuthMiddleware:
    """Channels middleware that resolves a JWT into ``scope['user']``."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        scope["user"] = AnonymousUser()
        token = _extract_token(scope)
        if token:
            try:
                from rest_framework_simplejwt.tokens import UntypedToken
                from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

                try:
                    validated = UntypedToken(token)
                    user_id = validated.get("user_id")
                    if user_id is not None:
                        scope["user"] = await _get_user(user_id)
                except (InvalidToken, TokenError):
                    scope["user"] = AnonymousUser()
            except Exception:  # pragma: no cover - missing optional dep
                scope["user"] = AnonymousUser()
        return await self.inner(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    """Compose JWT auth with the standard Channels auth stack as a fallback."""
    return JWTAuthMiddleware(AuthMiddlewareStack(inner))


def websocket_allowed_origins() -> list[str]:
    """Origins allowed to open a WebSocket: the API's own hosts plus the CORS origins.

    Channels' ``AllowedHostsOriginValidator`` only checks ``ALLOWED_HOSTS``,
    which lists the API's hostnames. When the SPA is served from another
    domain (Vercel frontend + Railway API) the browser sends the frontend's
    Origin, so every socket was refused even though REST calls from that same
    origin pass CORS. Trust the same origins for both.
    """
    from django.conf import settings

    origins = list(settings.ALLOWED_HOSTS)
    if settings.DEBUG and not origins:
        origins = ["localhost", "127.0.0.1", "[::1]"]
    if getattr(settings, "CORS_ALLOW_ALL_ORIGINS", False):
        origins.append("*")
    origins.extend(getattr(settings, "CORS_ALLOWED_ORIGINS", []))
    return origins


def WebsocketOriginValidator(inner):
    from channels.security.websocket import OriginValidator

    return OriginValidator(inner, websocket_allowed_origins())
