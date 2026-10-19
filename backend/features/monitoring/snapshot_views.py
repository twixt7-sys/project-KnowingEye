"""Review endpoints for persisted proctoring snapshots.

Read-only and staff-only: an examinee must never be able to read, replace or
delete the evidence collected about their own session, so there is no
owner-scoped fallback here (unlike alerts and behavior logs) and no write verb.
Images are served only through the permission-checked ``image`` action; they
are deliberately not stored under the publicly served ``MEDIA_ROOT``.

    GET /api/monitoring/snapshots/?session=<uuid>&kind=warning|termination&alert=<uuid>
    GET /api/monitoring/snapshots/<uuid>/
    GET /api/monitoring/snapshots/<uuid>/image/   (image/jpeg)
"""

from __future__ import annotations

from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated

from core.pagination import StandardResultsPagination
from core.security import service as security
from features.monitoring.models import SessionSnapshot
from features.reports.negotiation import IgnoreClientContentNegotiation


class CanReviewEvidence(BasePermission):
    """Staff who can live-monitor or read reports may review evidence."""

    message = "You do not have permission to review session snapshots."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (security.has_module(user, "monitoring") or security.has_module(user, "reports"))
        )


class SnapshotPagination(StandardResultsPagination):
    page_size = 60


class SessionSnapshotSerializer(serializers.ModelSerializer):
    student = serializers.CharField(source="user.username", read_only=True)
    exam_title = serializers.CharField(source="exam.title", read_only=True)
    alert_type = serializers.CharField(source="alert.alert_type", read_only=True, default=None)
    alert_severity = serializers.CharField(source="alert.severity", read_only=True, default=None)
    alert_message = serializers.CharField(source="alert.message", read_only=True, default=None)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = SessionSnapshot
        fields = [
            "id",
            "session",
            "user",
            "student",
            "exam",
            "exam_title",
            "kind",
            "alert",
            "alert_type",
            "alert_severity",
            "alert_message",
            "session_log",
            "label",
            "flags",
            "width",
            "height",
            "captured_at",
            "image_url",
        ]
        read_only_fields = fields

    def get_image_url(self, obj) -> str:
        return f"/api/monitoring/snapshots/{obj.pk}/image/"


class SessionSnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SessionSnapshotSerializer
    permission_classes = [IsAuthenticated, CanReviewEvidence]
    pagination_class = SnapshotPagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["session", "kind", "alert", "exam", "user"]

    def get_queryset(self):
        qs = SessionSnapshot.objects.select_related("user", "exam", "alert")
        if self.action != "image":
            # Listings never need the JPEG bytes.
            qs = qs.defer("image")
        return qs

    @action(detail=True, methods=["get"], content_negotiation_class=IgnoreClientContentNegotiation)
    def image(self, request, pk=None):
        snapshot = self.get_object()
        response = HttpResponse(bytes(snapshot.image), content_type="image/jpeg")
        response["Cache-Control"] = "private, no-store"
        return response
