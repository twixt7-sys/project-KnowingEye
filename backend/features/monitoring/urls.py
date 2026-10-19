from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .snapshot_views import SessionSnapshotViewSet
from .views import enroll_reference_view, monitoring_health, receive_frame

router = SimpleRouter()
router.register(r"snapshots", SessionSnapshotViewSet, basename="monitoring-snapshot")

urlpatterns = [
    path("health/", monitoring_health, name="monitoring-health"),
    path("frame/", receive_frame, name="monitoring-frame"),
    path("enroll/", enroll_reference_view, name="monitoring-enroll"),
    path("", include(router.urls)),
]
