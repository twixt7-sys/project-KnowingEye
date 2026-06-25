"""Channels URL routing for the monitoring feature."""

from __future__ import annotations

from django.urls import re_path

from features.monitoring.consumers import AdminAlertsConsumer, MonitoringConsumer, SessionObserverConsumer


websocket_urlpatterns = [
    re_path(
        r"^ws/monitoring/alerts/?$",
        AdminAlertsConsumer.as_asgi(),
    ),
    re_path(
        r"^ws/monitoring/observe/(?P<session_id>[0-9a-fA-F-]{36})/?$",
        SessionObserverConsumer.as_asgi(),
    ),
    re_path(
        r"^ws/monitoring/(?P<session_id>[0-9a-fA-F-]{36})/?$",
        MonitoringConsumer.as_asgi(),
    ),
]
