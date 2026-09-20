"""Top-level URL configuration for Knowing Eye."""

from __future__ import annotations

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def _root(_request):
    return JsonResponse(
        {
            "service": "knowing-eye-api",
            "version": "1.0.0",
            "docs": "/api/monitoring/health/",
        }
    )


urlpatterns = [
    path("", _root),
    path("admin/", admin.site.urls),

    path("api/auth/", include("features.authentication.urls")),
    path("api/", include("features.exams.urls")),
    path("api/", include("features.session.urls")),
    path("api/monitoring/", include("features.monitoring.urls")),
    path("api/behavior/", include("features.behavior.urls")),
    path("api/reports/", include("features.reports.urls")),
]


if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# No S3/CDN is configured for user-uploaded media (avatars); WhiteNoise only
# covers STATIC_URL, so serve MEDIA_URL directly regardless of DEBUG.
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
