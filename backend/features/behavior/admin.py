from django.contrib import admin

from features.behavior.models import Alert, BehaviorLog


@admin.register(BehaviorLog)
class BehaviorLogAdmin(admin.ModelAdmin):
    list_display = ("session", "event_type", "score", "confidence", "timestamp")
    list_filter = ("event_type",)
    search_fields = ("session__id",)


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ("session", "alert_type", "severity", "resolved", "created_at")
    list_filter = ("severity", "resolved")
