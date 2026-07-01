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
from .attachment_utils import validate_attachment_file
from .models import Exam, Question, QuestionAttachment
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
    QuestionAttachmentSerializer,
    QuestionReorderSerializer,
    QuestionSerializer,
)

User = get_user_model()


class ExamViewSet(viewsets.ModelViewSet):
    """CRUD and lifecycle endpoints for exams.

    Exposes the standard model actions plus custom actions for publish
    readiness, publishing, archiving, and bulk question import/reorder.
    Business rules are delegated to :mod:`features.exams.services`.
    """

    permission_classes = [IsAuthenticated, IsAdminOrReadOnly, IsExamOwnerOrAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "created_by"]
    search_fields = ["title", "description", "exam_code"]
    ordering_fields = ["created_at", "title"]
    ordering = ["-created_at"]
    exam_service = ExamService()

    def get_queryset(self):
        """Return exams visible to the requester, prefetching for detail views."""
        qs = self.exam_service.visible_to(self.request.user)
        if self.action == "retrieve":
            qs = qs.prefetch_related("questions__attachments")
        return qs

    def get_serializer_class(self):
        """Pick the serializer appropriate to the action and the user's role."""
        if self.action == "retrieve":
            if getattr(self.request.user, "is_admin", lambda: False)():
                return ExamDetailSerializer
            return ExamTakeSerializer
        if self.action in {"create", "update", "partial_update"}:
            return ExamCreateUpdateSerializer
        return ExamListSerializer

    def perform_create(self, serializer):
        """Create an exam, recording the requester as its creator."""
        services.assert_can_create_exam(self.request.user)
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        """Update an exam after confirming the requester may modify it."""
        services.assert_can_modify_exam(self.get_object(), self.request.user)
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        """Delete an exam and return ``204 No Content``."""
        services.delete_exam(self.get_object(), request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"])
    def readiness(self, request, pk=None):
        """Return the publish-readiness report for an exam."""
        exam = self.get_object()
        services.assert_can_modify_exam(exam, request.user)
        return Response(services.exam_publish_readiness(exam))

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """Publish a draft exam and return the updated detail payload."""
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
        """Archive an exam and return the updated detail payload."""
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
        """Bulk-import questions for an exam from CSV text or structured items."""
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
        """Reorder an exam's questions to match the supplied id sequence."""
        exam = self.get_object()
        ser = QuestionReorderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ordered = services.reorder_questions(
            exam, request.user, ser.validated_data["question_ids"]
        )
        return Response(QuestionDetailSerializer(ordered, many=True).data)


class QuestionViewSet(viewsets.ModelViewSet):
    """CRUD endpoints for the questions belonging to a single exam.

    Questions are always scoped to their parent exam via the ``exam_id`` URL
    kwarg. Admins receive full question detail (including answer keys) while
    examinees receive a redacted "take" representation.
    """

    permission_classes = [IsAuthenticated, IsAdminOrReadOnly, IsExamOwnerOrAdmin]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    question_repo = QuestionRepository()

    def get_queryset(self):
        """Return the parent exam's questions with attachments prefetched."""
        exam_id = self.kwargs.get("exam_id")
        return self.question_repo.for_exam(exam_id).prefetch_related("attachments")

    def get_serializer_class(self):
        """Pick the serializer appropriate to the current action."""
        if self.action == "retrieve":
            return QuestionDetailSerializer
        if self.action in {"create", "update", "partial_update"}:
            return QuestionCreateUpdateSerializer
        return QuestionSerializer

    def _exam(self) -> Exam:
        """Return the parent exam from the URL, or raise ``404``."""
        return get_object_or_404(Exam, pk=self.kwargs.get("exam_id"))

    def get_permissions(self):
        """Relax permissions to read-only access for list/retrieve actions."""
        if self.action in {"list", "retrieve"}:
            return [IsAuthenticated()]
        return super().get_permissions()

    def list(self, request, *args, **kwargs):
        """List questions, redacting answer keys for non-admin users."""
        qs = self.filter_queryset(self.get_queryset())
        if getattr(request.user, "is_admin", lambda: False)():
            serializer = QuestionDetailSerializer(qs, many=True)
        else:
            from .serializers import QuestionTakeSerializer

            serializer = QuestionTakeSerializer(qs, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        """Create a question scoped to the parent exam."""
        services.create_question_for_exam(
            exam=self._exam(), user=self.request.user, serializer=serializer
        )

    def perform_update(self, serializer):
        """Update a question after confirming modify permission."""
        services.update_question(self.get_object(), self.request.user, serializer)

    def destroy(self, request, *args, **kwargs):
        """Delete a question and return ``204 No Content``."""
        services.delete_question(self.get_object(), request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="attachments")
    def upload_attachment(self, request, exam_id=None, pk=None):
        """Attach an uploaded media file to a question after validation."""
        question = self.get_object()
        services.assert_can_modify_exam(question.exam, request.user)
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"file": ["No file provided."]}, status=status.HTTP_400_BAD_REQUEST)
        kind = validate_attachment_file(uploaded)
        order = question.attachments.count()
        attachment = QuestionAttachment.objects.create(
            question=question,
            file=uploaded,
            kind=kind,
            caption=(request.data.get("caption") or "")[:255],
            order=order,
        )
        ser = QuestionAttachmentSerializer(attachment, context={"request": request})
        return Response(ser.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"attachments/(?P<attachment_id>[^/.]+)",
    )
    def delete_attachment(self, request, exam_id=None, pk=None, attachment_id=None):
        """Delete a question attachment and its underlying stored file."""
        question = self.get_object()
        services.assert_can_modify_exam(question.exam, request.user)
        attachment = get_object_or_404(question.attachments, pk=attachment_id)
        attachment.file.delete(save=False)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
