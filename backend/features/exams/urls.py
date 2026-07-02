from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import DepartmentViewSet, ExamViewSet, QuestionViewSet

router = DefaultRouter()
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'exams', ExamViewSet, basename='exam')

# Nested routers for questions within exams
exams_router = DefaultRouter()
exams_router.register(r'questions', QuestionViewSet, basename='question')

urlpatterns = [
    path('', include(router.urls)),
    path('exams/<int:exam_id>/', include(exams_router.urls)),
]
