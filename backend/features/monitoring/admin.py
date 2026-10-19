from django.contrib import admin

from features.monitoring.models import SessionSnapshot


@admin.register(SessionSnapshot)
class SessionSnapshotAdmin(admin.ModelAdmin):
    """Evidence is append-only: browse it, never edit or delete it by hand."""

    list_display = ("session", "user", "exam", "kind", "label", "captured_at")
    list_filter = ("kind",)
    search_fields = ("session__id", "user__username")
    exclude = ("image",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
