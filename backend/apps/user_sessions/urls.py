from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ExamSessionViewSet, ResponseViewSet

# Create router
router = DefaultRouter()
router.register(r'sessions', ExamSessionViewSet, basename='examsession')
router.register(r'responses', ResponseViewSet, basename='response')

# URL patterns
urlpatterns = [
    path('', include(router.urls)),
]