from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        from django.db.models.signals import post_migrate

        def _seed_registry_permissions(sender, **kwargs):
            from core.security.service import ensure_registry_permissions

            ensure_registry_permissions()

        post_migrate.connect(_seed_registry_permissions, sender=self)
