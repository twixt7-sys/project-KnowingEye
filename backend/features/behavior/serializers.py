from rest_framework import serializers

from features.behavior.models import Alert, BehaviorLog


class BehaviorLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = BehaviorLog
        fields = [
            "id",
            "session",
            "event_type",
            "score",
            "confidence",
            "metadata",
            "timestamp",
        ]
        read_only_fields = fields


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = [
            "id",
            "session",
            "alert_type",
            "severity",
            "message",
            "metric_pct",
            "resolved",
            "created_at",
        ]
        read_only_fields = fields
