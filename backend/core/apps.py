from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        from django.db.models.signals import post_migrate

        def _seed_registry_permissions(sender, **kwargs):
            from core.security.service import ensure_registry_permissions, ensure_role_defaults

            ensure_registry_permissions()
            # Fill in predefined permissions for any role/registry entry that
            # has no row yet; rows an admin has edited are left untouched.
            ensure_role_defaults()

        post_migrate.connect(_seed_registry_permissions, sender=self)
