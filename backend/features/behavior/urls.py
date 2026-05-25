from django.urls import path, include
from rest_framework.routers import DefaultRouter

from features.behavior.views import AlertViewSet, BehaviorLogViewSet

router = DefaultRouter()
router.register(r"logs", BehaviorLogViewSet, basename="behavior-log")
router.register(r"alerts", AlertViewSet, basename="behavior-alert")

urlpatterns = [
    path("", include(router.urls)),
]
