"""Channels URL routing for live data-change notifications."""

from __future__ import annotations

from django.urls import re_path

from core.realtime.consumers import DataChangesConsumer


websocket_urlpatterns = [
    re_path(r"^ws/updates/?$", DataChangesConsumer.as_asgi()),
]
