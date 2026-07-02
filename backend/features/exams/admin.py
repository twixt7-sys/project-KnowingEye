from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from .models import Department, Exam, Question


class QuestionInline(admin.TabularInline):
    """Inline admin for questions within exams."""
    model = Question
    extra = 0
    fields = ['order', 'question_text', 'question_type', 'points']
    ordering = ['order']


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "abbreviation", "is_active", "sort_order", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "abbreviation")
    ordering = ("sort_order", "name")


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    """Admin interface for Exam model."""
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'description', 'instructions', 'department', 'exam_code')
        }),
        ('Configuration', {
            'fields': ('duration_minutes', 'passing_score', 'status')
        }),
        ('Questions', {
            'fields': ('total_questions',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [QuestionInline]
    readonly_fields = ('total_questions', 'created_at', 'updated_at')
    list_display = ('title', 'status', 'duration_minutes', 'total_questions', 'passing_score', 'created_by', 'created_at', 'action_links')
    list_filter = ('status', 'created_at', 'created_by')
    search_fields = ('title', 'description')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    
    def get_readonly_fields(self, request, obj=None):
        """Make created_by readonly and add timestamps."""
        readonly = list(self.readonly_fields)
        if obj:  # Editing existing
            readonly.append('created_by')
        return readonly
    
    def save_model(self, request, obj, form, change):
        """Set created_by on creation."""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
    
    def action_links(self, obj):
        """Display action links."""
        html = f'<a class="button" href="{reverse("admin:exams_exam_change", args=[obj.pk])}">Edit</a>'
        return format_html(html)
    action_links.short_description = 'Actions'


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    """Admin interface for Question model."""
    fieldsets = (
        ('Question Details', {
            'fields': ('exam', 'question_text', 'question_type')
        }),
        ('Content', {
            'fields': ('options', 'correct_answer')
        }),
        ('Scoring', {
            'fields': ('points', 'order')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ('created_at', 'updated_at')
    list_display = ('exam', 'order', 'question_text_short', 'question_type', 'points', 'created_at')
    list_filter = ('exam', 'question_type', 'created_at')
    search_fields = ('question_text', 'exam__title')
    ordering = ('exam', 'order')
    date_hierarchy = 'created_at'
    
    def question_text_short(self, obj):
        """Display shortened question text."""
        return obj.question_text[:50] + '...' if len(obj.question_text) > 50 else obj.question_text
    question_text_short.short_description = 'Question'

