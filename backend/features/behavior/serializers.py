from rest_framework import serializers

from features.behavior.models import Alert, BehaviorLog


class BehaviorLogSerializer(serializers.ModelSerializer):
    session_user = serializers.CharField(source="session.user.username", read_only=True)
    exam_title = serializers.CharField(source="session.exam.title", read_only=True)

    class Meta:
        model = BehaviorLog
        fields = [
            "id",
            "session",
            "session_user",
            "exam_title",
            "event_type",
            "score",
            "confidence",
            "metadata",
            "timestamp",
        ]
        read_only_fields = fields


class AlertSerializer(serializers.ModelSerializer):
    session_user = serializers.CharField(source="session.user.username", read_only=True)
    exam_title = serializers.CharField(source="session.exam.title", read_only=True)

    class Meta:
        model = Alert
        fields = [
            "id",
            "session",
            "session_user",
            "exam_title",
            "alert_type",
            "severity",
            "message",
            "metric_pct",
            "resolved",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "session",
            "session_user",
            "exam_title",
            "alert_type",
            "severity",
            "message",
            "metric_pct",
            "created_at",
        ]
