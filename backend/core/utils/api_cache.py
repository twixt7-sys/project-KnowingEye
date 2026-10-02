"""Server-side response caching for read-only API endpoints.

Responses are cached as plain data (not rendered ``Response`` objects) under a
key built from the caller-supplied *scope* (who may see the data) plus the
request path and query string. Entries can be dropped in bulk with
``bump_namespace`` - used by model signals for reference data - or simply
expire after their TTL for aggregates that change constantly.
"""

from __future__ import annotations

import hashlib
from functools import wraps
from typing import Callable

from django.conf import settings
from django.core.cache import cache
from rest_framework.response import Response

_NS_KEY = "api_cache_ns:{name}"


def _namespace_version(name: str) -> int:
    key = _NS_KEY.format(name=name)
    version = cache.get(key)
    if version is None:
        cache.add(key, 1, timeout=None)
        version = cache.get(key, 1)
    return version


def bump_namespace(name: str) -> None:
    """Invalidate every cached response stored under ``name``."""
    key = _NS_KEY.format(name=name)
    try:
        cache.incr(key)
    except ValueError:
        cache.add(key, 2, timeout=None)


def _build_key(namespace: str, scope: str, request) -> str:
    raw = f"{request.path}?{request.META.get('QUERY_STRING', '')}"
    digest = hashlib.sha1(raw.encode()).hexdigest()
    return f"api_cache:{namespace}:v{_namespace_version(namespace)}:{scope}:{digest}"


def cache_get_response(
    namespace: str,
    *,
    ttl_setting: str = "API_CACHE_TTL_SECONDS",
    scope: Callable[[object], str] = lambda request: "all",
):
    """Cache a successful (200) GET handler's data.

    ``scope(request)`` must return a string that is identical only for callers
    who are allowed to see identical data (e.g. a role bucket or a user id) -
    never cache per-user data under a shared scope.
    """

    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            request = args[-1] if not hasattr(args[0], "method") else args[0]
            ttl = getattr(settings, ttl_setting, 0)
            if ttl <= 0 or request.method != "GET":
                return view(*args, **kwargs)

            key = _build_key(namespace, scope(request), request)
            data = cache.get(key)
            if data is not None:
                response = Response(data)
                response["X-Cache"] = "HIT"
                return response

            response = view(*args, **kwargs)
            if response.status_code == 200:
                cache.set(key, response.data, timeout=ttl)
                response["X-Cache"] = "MISS"
            return response

        return wrapper

    return decorator
