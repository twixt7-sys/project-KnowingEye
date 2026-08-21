"""HTTP controller layer for the exams feature."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Max
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.security.drf import IsAdminOrReadOnly

from . import services
from .attachment_utils import validate_attachment_file
from .models import (
    Department,
    Exam,
    ExamAssignment,
    ExamCategory,
    ExamSection,
    Question,
    QuestionAttachment,
    QuestionPool,
)
from .exam_service import ExamService
from .repositories import QuestionRepository
from .serializers import (
    DepartmentSerializer,
    ExamCategorySerializer,
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


class DepartmentViewSet(viewsets.ModelViewSet):
    """CRUD for institutional departments (admin write, authenticated read)."""

    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["sort_order", "name", "abbreviation"]
    ordering = ["sort_order", "name"]

    def get_queryset(self):
        qs = Department.objects.all()
        if self.action in {"list", "retrieve"}:
            active_only = self.request.query_params.get("active_only")
            if active_only in {"1", "true", "True"}:
                qs = qs.filter(is_active=True)
        return qs

    def destroy(self, request, *args, **kwargs):
        department = self.get_object()
        if department.exams.exists() or department.shared_exams.exists():
            return Response(
                {
                    "detail": "Cannot delete a department that has exams. Deactivate it instead."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class ExamCategoryViewSet(viewsets.ModelViewSet):
    """CRUD for Guidance content categories (admin write, authenticated read).

    Directive Area 03 ("Exam discovery"): the classification axis for
    filtering exams by content type - psychological, mental/abstract,
    behavioral/character - independent of academic department.
    """

    serializer_class = ExamCategorySerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["sort_order", "name"]
    ordering = ["sort_order", "name"]

    def get_queryset(self):
        qs = ExamCategory.objects.all()
        if self.action in {"list", "retrieve"}:
            active_only = self.request.query_params.get("active_only")
            if active_only in {"1", "true", "True"}:
                qs = qs.filter(is_active=True)
        return qs

    def destroy(self, request, *args, **kwargs):
        category = self.get_object()
        if category.exams.exists():
            return Response(
                {"detail": "Cannot delete a category that has exams. Deactivate it instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class ExamViewSet(viewsets.ModelViewSet):
    """CRUD and lifecycle endpoints for exams.

    Exposes the standard model actions plus custom actions for publish
    readiness, publishing, archiving, and bulk question import/reorder.
    Business rules - who can create/update/delete which exam - are fully
    delegated to :mod:`features.exams.services` (permission + ownership),
    not a DRF permission class, since faculty may create and edit their own
    exams while students may only read.
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "created_by", "approval_status", "category", "departments"]
    search_fields = ["title", "description", "exam_code"]
    ordering_fields = ["created_at", "title", "available_from", "available_until"]
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
            from core.security import service as security

            user = self.request.user
            if user.is_admin() or security.has_module(user, "exams"):
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
        exam = self.get_object()
        services.assert_can_modify_exam(exam, self.request.user)
        services.assert_exam_editable(exam)
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
    def submit(self, request, pk=None):
        """Submit a draft exam for program-head review."""
        result = services.submit_exam_for_approval(self.get_object(), request.user)
        return Response(
            {
                "message": result.message,
                "exam": ExamDetailSerializer(result.exam, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve a pending exam submission (program head / admin)."""
        result = services.approve_exam(self.get_object(), request.user)
        return Response(
            {
                "message": result.message,
                "exam": ExamDetailSerializer(result.exam, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Reject a pending exam submission, returning it to the creator for revision."""
        note = (request.data.get("note") or "").strip()
        result = services.reject_exam(self.get_object(), request.user, note=note)
        return Response(
            {
                "message": result.message,
                "exam": ExamDetailSerializer(result.exam, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="pending-review")
    def pending_review(self, request):
        """Exams awaiting Level 1 review, for the program head approvals queue."""
        services.assert_can_review_exam(request.user)
        qs = self.filter_queryset(self.get_queryset()).filter(
            approval_status=Exam.ApprovalStatus.PENDING
        )
        page = self.paginate_queryset(qs)
        serializer = ExamListSerializer(page or qs, many=True, context={"request": request})
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

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

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        """Clone exam as a new draft."""
        exam = self.get_object()
        new_exam = services.duplicate_exam(exam, request.user)
        return Response(
            {
                "message": "Exam duplicated successfully.",
                "exam": ExamDetailSerializer(new_exam, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="mine")
    def mine(self, request):
        """Exams available to the current examinee with attempt metadata."""
        from .serializers import ExamMineSerializer

        qs = self.exam_service.visible_to(request.user)
        serializer = ExamMineSerializer(
            qs,
            many=True,
            context={"request": request, "user": request.user},
        )
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def analytics(self, request, pk=None):
        """Per-question item analysis for an exam."""
        exam = self.get_object()
        services.assert_can_modify_exam(exam, request.user)
        return Response(services.exam_item_analytics(exam))

    @action(detail=True, methods=["post"], url_path="assignments/import")
    def import_assignments(self, request, pk=None):
        """Bulk import candidate roster from CSV."""
        exam = self.get_object()
        csv_text = request.data.get("csv", "")
        result = services.import_assignments(exam, request.user, csv_text=csv_text)
        return Response(result, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="assignments")
    def assignments(self, request, pk=None):
        """List or create exam assignments."""
        from .serializers import ExamAssignmentSerializer

        exam = self.get_object()
        services.assert_can_modify_exam(exam, request.user)

        if request.method == "GET":
            qs = exam.assignments.select_related("user").order_by("-created_at")
            return Response(ExamAssignmentSerializer(qs, many=True).data)

        serializer = ExamAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data.pop("user")
        assignment, created = ExamAssignment.objects.update_or_create(
            exam=exam,
            user=user,
            defaults=serializer.validated_data,
        )
        return Response(
            ExamAssignmentSerializer(assignment).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get", "post"], url_path="sections")
    def sections(self, request, pk=None):
        """List or create exam sections."""
        from .serializers import ExamSectionSerializer

        exam = self.get_object()
        if request.method == "GET":
            qs = exam.sections.order_by("order")
            return Response(ExamSectionSerializer(qs, many=True).data)

        services.assert_can_modify_exam(exam, request.user)
        services.assert_exam_editable(exam)
        serializer = ExamSectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.validated_data.get("order")
        if not order:
            max_order = exam.sections.aggregate(max_o=Max("order"))["max_o"] or 0
            serializer.validated_data["order"] = max_order + 1
        section = serializer.save(exam=exam)
        return Response(
            ExamSectionSerializer(section).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get", "post"], url_path="pools")
    def pools(self, request, pk=None):
        """List or create question pools."""
        from .serializers import QuestionPoolSerializer

        exam = self.get_object()
        if request.method == "GET":
            qs = exam.question_pools.order_by("order")
            return Response(QuestionPoolSerializer(qs, many=True).data)

        services.assert_can_modify_exam(exam, request.user)
        services.assert_exam_editable(exam)
        serializer = QuestionPoolSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.validated_data.get("order")
        if not order:
            max_order = exam.question_pools.aggregate(max_o=Max("order"))["max_o"] or 0
            serializer.validated_data["order"] = max_order + 1
        pool = serializer.save(exam=exam)
        return Response(
            QuestionPoolSerializer(pool).data,
            status=status.HTTP_201_CREATED,
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
    kwarg. Admins and faculty receive full question detail (including answer
    keys) while everyone else receives a redacted "take" representation.
    Mutation permission (create/update/delete) is delegated to
    :mod:`features.exams.services`, same as :class:`ExamViewSet`.
    """

    permission_classes = [IsAuthenticated]
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
        """List questions, redacting answer keys for users without exam-management access."""
        from core.security import service as security

        qs = self.filter_queryset(self.get_queryset())
        if request.user.is_admin() or security.has_module(request.user, "exams"):
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
        services.assert_exam_editable(question.exam)
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
        services.assert_exam_editable(question.exam)
        attachment = get_object_or_404(question.attachments, pk=attachment_id)
        attachment.file.delete(save=False)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="option-image")
    def upload_option_image(self, request, exam_id=None, pk=None):
        """Upload an image for one multiple-choice option and return its URL.

        Directive Area 03 ("Question management"): abstract/psychological
        items need image-based answer choices, not just image-based question
        bodies. The image is stored under media/ like other question
        attachments, but returned as a bare URL for the client to place into
        that option's ``image`` field - options don't have their own id to
        hang a QuestionAttachment row off of.
        """
        from django.core.files.storage import default_storage

        question = self.get_object()
        services.assert_can_modify_exam(question.exam, request.user)
        services.assert_exam_editable(question.exam)
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"file": ["No file provided."]}, status=status.HTTP_400_BAD_REQUEST)
        kind = validate_attachment_file(uploaded)
        if kind != "image":
            return Response(
                {"file": ["Option images must be an image file (JPEG, PNG, GIF, or WebP)."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        path = default_storage.save(
            f"questions/{question.exam_id}/{question.id}/options/{uploaded.name}",
            uploaded,
        )
        url = default_storage.url(path)
        if not url.startswith(("http://", "https://")):
            url = request.build_absolute_uri(url)
        return Response({"url": url}, status=status.HTTP_201_CREATED)
