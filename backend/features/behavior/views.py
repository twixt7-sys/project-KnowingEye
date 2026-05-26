from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from features.behavior.models import Alert, BehaviorLog
from features.behavior.serializers import AlertSerializer, BehaviorLogSerializer


class BehaviorLogViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/behavior/logs/?session=<uuid>"""

    serializer_class = BehaviorLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["session", "event_type"]

    def get_queryset(self):
        qs = BehaviorLog.objects.select_related("session", "session__user", "session__exam")
        if self.request.user.is_admin():
            return qs
        return qs.filter(session__user=self.request.user)


class AlertViewSet(viewsets.ModelViewSet):
    """Admins can list/resolve all alerts; examinees see their own."""

    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["session", "severity", "resolved", "alert_type"]
    http_method_names = ["get", "patch", "post", "head", "options"]

    def get_queryset(self):
        qs = Alert.objects.select_related("session", "session__user", "session__exam")
        if self.request.user.is_admin():
            return qs
        return qs.filter(session__user=self.request.user)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        if not request.user.is_admin():
            return Response(
                {"error": "Only admins can resolve alerts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        alert = self.get_object()
        alert.resolved = True
        alert.save(update_fields=["resolved"])
        return Response(AlertSerializer(alert).data)

    @action(detail=False, methods=["post"])
    def resolve_all(self, request):
        if not request.user.is_admin():
            return Response(
                {"error": "Only admins can resolve alerts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        session = request.data.get("session")
        qs = Alert.objects.filter(resolved=False)
        if session:
            qs = qs.filter(session=session)
        updated = qs.update(resolved=True)
        return Response({"updated": updated})
