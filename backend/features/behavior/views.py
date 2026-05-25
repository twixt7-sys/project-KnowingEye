from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from features.behavior.models import Alert, BehaviorLog
from features.behavior.serializers import AlertSerializer, BehaviorLogSerializer


class BehaviorLogViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/behavior/logs/?session=<uuid>"""

    serializer_class = BehaviorLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["session", "event_type"]

    def get_queryset(self):
        qs = BehaviorLog.objects.select_related("session", "session__user")
        if self.request.user.is_admin():
            return qs
        return qs.filter(session__user=self.request.user)


class AlertViewSet(viewsets.ModelViewSet):
    """GET /api/behavior/alerts/?session=<uuid> — admins see all; examinees own sessions."""

    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["session", "severity", "resolved"]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        qs = Alert.objects.select_related("session", "session__user")
        if self.request.user.is_admin():
            return qs
        return qs.filter(session__user=self.request.user)
