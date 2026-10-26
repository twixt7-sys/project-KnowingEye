from django.apps import AppConfig


class ExamSessionsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'features.session'
    label = 'exam_sessions'

    def ready(self):
        from . import signals  # noqa: F401
