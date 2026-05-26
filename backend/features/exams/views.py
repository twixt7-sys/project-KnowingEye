"""HTTP controller layer for the exams feature.

These viewsets translate REST requests into calls into the service/repository
layers. All non-trivial business logic (ownership checks, lifecycle
transitions, integrity constraints) lives in :mod:`services`.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import services
from .models import Exam, Question
from .permissions import IsAdminOrReadOnly, IsExamOwnerOrAdmin
from .repositories import ExamRepository, QuestionRepository
from .serializers import (
    ExamCreateUpdateSerializer,
    ExamDetailSerializer,
    ExamListSerializer,
    QuestionCreateUpdateSerializer,
    QuestionDetailSerializer,
    QuestionSerializer,
)

User = get_user_model()


class ExamViewSet(viewsets.ModelViewSet):
    """REST surface for exams.

    ============  ==========================================
    Endpoint      Description
    ============  ==========================================
    GET    /     List exams (admins see all, others active)
    POST   /     Create exam (admin only)
    GET    /:id   Detail
    PUT    /:id   Update (owner or superuser)
    DELETE /:id   Delete (owner or superuser)
    POST   /:id/publish   DRAFT -> ACTIVE
    POST   /:id/archive   * -> ARCHIVED
    GET    /:id/questions List questions
    ============  ==========================================
    """

    permission_classes = [IsAuthenticated, IsAdminOrReadOnly, IsExamOwnerOrAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "created_by"]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "title"]
    ordering = ["-created_at"]
    exam_repo = ExamRepository()
    question_repo = QuestionRepository()

    def get_queryset(self):
        return self.exam_repo.visible_to(self.request.user)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ExamDetailSerializer
        if self.action in {"create", "update", "partial_update"}:
            return ExamCreateUpdateSerializer
        return ExamListSerializer

    def perform_create(self, serializer):
        services.assert_can_create_exam(self.request.user)
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        services.assert_can_modify_exam(self.get_object(), self.request.user)
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        services.delete_exam(self.get_object(), request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"])
    def questions(self, request, pk=None):
        exam = self.get_object()
        qs = self.question_repo.for_exam(exam.id)
        return Response(QuestionDetailSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        result = services.publish_exam(self.get_object(), request.user)
        return Response(
            {
                "message": result.message,
                "exam": ExamDetailSerializer(result.exam).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        result = services.archive_exam(self.get_object(), request.user)
        return Response(
            {
                "message": result.message,
                "exam": ExamDetailSerializer(result.exam).data,
            },
            status=status.HTTP_200_OK,
        )


class QuestionViewSet(viewsets.ModelViewSet):
    """CRUD for questions nested under an exam (``/api/exams/<exam_id>/questions/``)."""

    permission_classes = [IsAuthenticated]
    question_repo = QuestionRepository()

    def get_queryset(self):
        exam_id = self.kwargs.get("exam_id")
        return self.question_repo.for_exam(exam_id)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return QuestionDetailSerializer
        if self.action in {"create", "update", "partial_update"}:
            return QuestionCreateUpdateSerializer
        return QuestionSerializer

    def _exam(self) -> Exam:
        return get_object_or_404(Exam, pk=self.kwargs.get("exam_id"))

    def perform_create(self, serializer):
        services.create_question_for_exam(
            exam=self._exam(), user=self.request.user, serializer=serializer
        )

    def perform_update(self, serializer):
        services.update_question(self.get_object(), self.request.user, serializer)

    def destroy(self, request, *args, **kwargs):
        services.delete_question(self.get_object(), request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
