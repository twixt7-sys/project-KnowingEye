"""HTTP controller layer for the exams feature."""

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
from .exam_service import ExamService
from .permissions import IsAdminOrReadOnly, IsExamOwnerOrAdmin
from .repositories import QuestionRepository
from .serializers import (
    ExamCreateUpdateSerializer,
    ExamDetailSerializer,
    ExamListSerializer,
    ExamTakeSerializer,
    QuestionCreateUpdateSerializer,
    QuestionDetailSerializer,
    QuestionImportSerializer,
    QuestionReorderSerializer,
    QuestionSerializer,
)

User = get_user_model()


class ExamViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly, IsExamOwnerOrAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "created_by"]
    search_fields = ["title", "description", "exam_code"]
    ordering_fields = ["created_at", "title"]
    ordering = ["-created_at"]
    exam_service = ExamService()
    question_repo = QuestionRepository()

    def get_queryset(self):
        return self.exam_service.visible_to(self.request.user)

    def get_serializer_class(self):
        if self.action == "retrieve":
            if getattr(self.request.user, "is_admin", lambda: False)():
                return ExamDetailSerializer
            return ExamTakeSerializer
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
        if getattr(request.user, "is_admin", lambda: False)():
            data = QuestionDetailSerializer(qs, many=True).data
        else:
            from .serializers import QuestionTakeSerializer

            data = QuestionTakeSerializer(qs, many=True).data
        return Response(data)

    @action(detail=True, methods=["get"])
    def readiness(self, request, pk=None):
        exam = self.get_object()
        services.assert_can_modify_exam(exam, request.user)
        return Response(services.exam_publish_readiness(exam))

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

    @action(detail=True, methods=["post"], url_path="questions/import")
    def import_questions(self, request, pk=None):
        exam = self.get_object()
        ser = QuestionImportSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        created = services.import_questions(
            exam,
            request.user,
            csv_text=ser.validated_data.get("csv"),
            items=ser.validated_data.get("questions"),
        )
        return Response(
            {
                "imported": len(created),
                "questions": QuestionDetailSerializer(created, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="questions/reorder")
    def reorder_questions(self, request, pk=None):
        exam = self.get_object()
        ser = QuestionReorderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ordered = services.reorder_questions(
            exam, request.user, ser.validated_data["question_ids"]
        )
        return Response(QuestionDetailSerializer(ordered, many=True).data)


class QuestionViewSet(viewsets.ModelViewSet):
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
