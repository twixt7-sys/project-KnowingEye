from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse

from .models import ExamSession, Response, SessionLog


class ResponseInline(admin.TabularInline):
    """Inline admin for responses within exam sessions."""
    model = Response
    extra = 0
    readonly_fields = ['question', 'answer_text', 'is_correct', 'score', 'time_spent', 'submitted_at']
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class SessionLogInline(admin.TabularInline):
    """Inline admin for session logs."""
    model = SessionLog
    extra = 0
    readonly_fields = ['event_type', 'timestamp', 'ip_address', 'details']
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(ExamSession)
class ExamSessionAdmin(admin.ModelAdmin):
    """Admin interface for exam sessions."""
    list_display = [
        'id', 'user', 'exam', 'status', 'started_at', 'submitted_at',
        'total_score', 'percentage_score', 'passed', 'duration_display'
    ]
    list_filter = ['status', 'passed', 'started_at', 'submitted_at', 'exam']
    search_fields = ['user__username', 'user__email', 'exam__title', 'id']
    readonly_fields = [
        'id', 'started_at', 'submitted_at', 'total_score', 'percentage_score',
        'passed', 'duration', 'responses_count'
    ]
    inlines = [ResponseInline, SessionLogInline]

    fieldsets = (
        ('Session Info', {
            'fields': ('id', 'user', 'exam')
        }),
        ('Timing', {
            'fields': ('started_at', 'submitted_at', 'duration')
        }),
        ('Results', {
            'fields': ('total_score', 'percentage_score', 'passed', 'responses_count')
        }),
    )

    def duration_display(self, obj):
        """Display session duration in a readable format."""
        if obj.duration:
            minutes = obj.duration // 60
            seconds = obj.duration % 60
            return f"{minutes}m {seconds}s"
        return "-"
    duration_display.short_description = "Duration"

    def responses_count(self, obj):
        """Display number of responses."""
        return obj.responses.count()
    responses_count.short_description = "Responses"

    def has_add_permission(self, request):
        """Prevent manual creation of sessions."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Allow deletion only for terminated sessions."""
        if obj and obj.status == ExamSession.Status.TERMINATED:
            return True
        return False


@admin.register(Response)
class ResponseAdmin(admin.ModelAdmin):
    """Admin interface for responses."""
    list_display = [
        'id', 'session_link', 'question', 'answer_text', 'is_correct',
        'score', 'time_spent', 'submitted_at'
    ]
    list_filter = ['is_correct', 'submitted_at', 'session__exam']
    search_fields = ['session__user__username', 'question__text', 'answer_text']
    readonly_fields = ['id', 'session', 'question', 'answer_text', 'is_correct', 'score', 'time_spent', 'submitted_at']

    def session_link(self, obj):
        """Link to the exam session."""
        url = reverse('admin:user_sessions_examsession_change', args=[obj.session.id])
        return format_html('<a href="{}">{}</a>', url, obj.session.id)
    session_link.short_description = "Session"

    def has_add_permission(self, request):
        """Prevent manual creation of responses."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Prevent deletion of responses."""
        return False


@admin.register(SessionLog)
class SessionLogAdmin(admin.ModelAdmin):
    """Admin interface for session logs."""
    list_display = ['id', 'session_link', 'event_type', 'timestamp', 'ip_address']
    list_filter = ['event_type', 'timestamp']
    search_fields = ['session__user__username', 'ip_address', 'details']
    readonly_fields = ['id', 'session', 'event_type', 'timestamp', 'ip_address', 'details']

    def session_link(self, obj):
        """Link to the exam session."""
        url = reverse('admin:user_sessions_examsession_change', args=[obj.session.id])
        return format_html('<a href="{}">{}</a>', url, obj.session.id)
    session_link.short_description = "Session"

    def has_add_permission(self, request):
        """Prevent manual creation of logs."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Prevent deletion of logs."""
        return False
