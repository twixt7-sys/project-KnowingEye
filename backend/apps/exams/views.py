from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model

from .models import Exam, Question
from .serializers import (
    ExamListSerializer,
    ExamDetailSerializer,
    ExamCreateUpdateSerializer,
    QuestionSerializer,
    QuestionCreateUpdateSerializer,
    QuestionDetailSerializer
)

User = get_user_model()


class ExamViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing exams.
    
    List exams: GET /api/exams/
    Create exam: POST /api/exams/
    Retrieve exam: GET /api/exams/{id}/
    Update exam: PUT /api/exams/{id}/
    Delete exam: DELETE /api/exams/{id}/
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'created_by']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'title']
    ordering = ['-created_at']

    def get_queryset(self):
        """
        Admins see all exams.
        Examinees see only active exams.
        """
        if self.request.user.is_admin():
            return Exam.objects.all()
        return Exam.objects.filter(status=Exam.Status.ACTIVE)

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'retrieve':
            return ExamDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return ExamCreateUpdateSerializer
        else:
            return ExamListSerializer

    def perform_create(self, serializer):
        """Set the creator to the current user."""
        if not self.request.user.is_admin():
            return Response(
                {'error': 'Only admins can create exams'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        """Ensure only the creator can update."""
        exam = self.get_object()
        if exam.created_by != self.request.user and not self.request.user.is_superuser:
            return Response(
                {'error': 'You can only update exams you created'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        """Only allow deletion by creator or superuser."""
        exam = self.get_object()
        if exam.created_by != request.user and not request.user.is_superuser:
            return Response(
                {'error': 'You can only delete exams you created'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def questions(self, request, pk=None):
        """
        Get all questions for an exam.
        GET /api/exams/{id}/questions/
        """
        exam = self.get_object()
        questions = exam.questions.all().order_by('order')
        serializer = QuestionDetailSerializer(questions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """
        Publish an exam (change status from DRAFT to ACTIVE).
        POST /api/exams/{id}/publish/
        """
        exam = self.get_object()
        
        if exam.created_by != request.user and not request.user.is_superuser:
            return Response(
                {'error': 'You can only publish exams you created'},
                status=status.HTTP_403_FORBIDDEN
            )

        if exam.status != Exam.Status.DRAFT:
            return Response(
                {'error': f'Cannot publish exam with status {exam.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if exam.questions.count() == 0:
            return Response(
                {'error': 'Cannot publish exam with no questions'},
                status=status.HTTP_400_BAD_REQUEST
            )

        exam.status = Exam.Status.ACTIVE
        exam.save()
        return Response(
            {'message': 'Exam published successfully', 'exam': ExamDetailSerializer(exam).data},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """
        Archive an exam (change status to ARCHIVED).
        POST /api/exams/{id}/archive/
        """
        exam = self.get_object()
        
        if exam.created_by != request.user and not request.user.is_superuser:
            return Response(
                {'error': 'You can only archive exams you created'},
                status=status.HTTP_403_FORBIDDEN
            )

        if exam.status == Exam.Status.ARCHIVED:
            return Response(
                {'error': 'Exam is already archived'},
                status=status.HTTP_400_BAD_REQUEST
            )

        exam.status = Exam.Status.ARCHIVED
        exam.save()
        return Response(
            {'message': 'Exam archived successfully'},
            status=status.HTTP_200_OK
        )


class QuestionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing questions within exams.
    
    List questions: GET /api/exams/{exam_id}/questions/
    Create question: POST /api/exams/{exam_id}/questions/
    Retrieve question: GET /api/exams/{exam_id}/questions/{id}/
    Update question: PUT /api/exams/{exam_id}/questions/{id}/
    Delete question: DELETE /api/exams/{exam_id}/questions/{id}/
    """
    permission_classes = [IsAuthenticated]
    serializer_class = QuestionSerializer

    def get_queryset(self):
        """Get all questions for the specified exam."""
        exam_id = self.kwargs.get('exam_id')
        return Question.objects.filter(exam_id=exam_id).order_by('order')

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'retrieve':
            return QuestionDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return QuestionCreateUpdateSerializer
        else:
            return QuestionSerializer

    def perform_create(self, serializer):
        """Create a question for the specified exam."""
        exam_id = self.kwargs.get('exam_id')
        try:
            exam = Exam.objects.get(pk=exam_id)
        except Exam.DoesNotExist:
            return Response(
                {'error': 'Exam not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check permission
        if exam.created_by != self.request.user and not self.request.user.is_superuser:
            return Response(
                {'error': 'You can only add questions to exams you created'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer.save(exam=exam)

    def perform_update(self, serializer):
        """Update a question."""
        question = self.get_object()
        if question.exam.created_by != self.request.user and not self.request.user.is_superuser:
            return Response(
                {'error': 'You can only update questions in exams you created'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        """Delete a question."""
        question = self.get_object()
        if question.exam.created_by != request.user and not request.user.is_superuser:
            return Response(
                {'error': 'You can only delete questions from exams you created'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

