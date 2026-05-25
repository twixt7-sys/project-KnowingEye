from django.urls import path

from .views import monitoring_health, receive_frame

urlpatterns = [
    path("health/", monitoring_health, name="monitoring-health"),
    path("frame/", receive_frame, name="monitoring-frame"),
]
