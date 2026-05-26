from django.urls import path

from .views import enroll_reference_view, monitoring_health, receive_frame

urlpatterns = [
    path("health/", monitoring_health, name="monitoring-health"),
    path("frame/", receive_frame, name="monitoring-frame"),
    path("enroll/", enroll_reference_view, name="monitoring-enroll"),
]
