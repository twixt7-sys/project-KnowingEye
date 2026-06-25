from django.shortcuts import render

from rest_framework.exceptions import ValidationError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response as APIResponse
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db import transaction

from .models import ExamSession, Response as AnswerResponse, SessionLog
from .serializers import (
    ExamSessionListSerializer,
    ExamSessionDetailSerializer,
    ExamSessionStartSerializer,
    ExamSessionSubmitSerializer,
    ResponseSerializer,
    SessionLogSerializer,
)
from .services import begin_exam_session, ensure_active_session, get_or_create_setup_session


class ExamSessionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing exam sessions.

    List sessions: GET /api/sessions/
    Start session: POST /api/sessions/start/
    Get session: GET /api/sessions/{id}/
    Submit session: POST /api/sessions/{id}/submit/
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'exam', 'user']

    def get_queryset(self):
        """Filter sessions based on user role."""
        if self.request.user.is_admin():
            return ExamSession.objects.all()
        return ExamSession.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        """Return appropriate serializer."""
        if self.action == 'start':
            return ExamSessionStartSerializer
        elif self.action == 'submit':
            return ExamSessionSubmitSerializer
        elif self.action == 'retrieve':
            return ExamSessionDetailSerializer
        elif self.action == 'begin':
            return ExamSessionDetailSerializer
        else:
            return ExamSessionListSerializer

    @action(detail=False, methods=['post'])
    def start(self, request):
        """
        Start a new exam session.
        POST /api/sessions/start/
        Body: { "exam": exam_id }
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = serializer.save()

        # Return session with exam details
        detail_serializer = ExamSessionDetailSerializer(session)
        return APIResponse(
            {
                'message': 'Exam session started successfully',
                'session': detail_serializer.data
            },
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def begin(self, request, pk=None):
        """Begin the timed exam after proctoring setup is complete."""
        session = self.get_object()
        if session.user != request.user and not request.user.is_admin():
            return APIResponse(
                {'error': 'You can only begin your own exam sessions'},
                status=status.HTTP_403_FORBIDDEN,
            )

        from .services import begin_exam_session, ensure_active_session, touch_setup_activity

        if session.status == ExamSession.Status.SETUP:
            touch_setup_activity(session)

        ensure_active_session(session, ip_address=self._get_client_ip(request))
        session.refresh_from_db()
        if session.status != ExamSession.Status.SETUP:
            return APIResponse(
                {
                    'error': f'Session cannot begin (status: {session.get_status_display()}). '
                    'Return to the dashboard and start setup again.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            begin_exam_session(session, ip_address=self._get_client_ip(request))
        except ValidationError as exc:
            raise exc

        detail_serializer = ExamSessionDetailSerializer(session)
        return APIResponse(
            {
                'message': 'Exam started — timer is now running.',
                'session': detail_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """
        Submit exam responses and complete the session.
        POST /api/sessions/{id}/submit/
        Body: {
            "responses": [
                {"question_id": 1, "answer_text": "Answer", "time_spent": 30},
                ...
            ],
            "time_remaining": 1200
        }
        """
        session = self.get_object()

        # Check permissions
        if session.user != request.user and not request.user.is_admin():
            return APIResponse(
                {'error': 'You can only submit your own exam sessions'},
                status=status.HTTP_403_FORBIDDEN
            )

        ensure_active_session(session, ip_address=self._get_client_ip(request))
        session.refresh_from_db()

        # Check if session can be submitted
        if not session.can_submit():
            if session.status == ExamSession.Status.EXPIRED:
                return APIResponse(
                    {'error': 'Session has expired due to time limit'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return APIResponse(
                {'error': f'Session cannot be submitted (status: {session.get_status_display()})'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(data=request.data)
        serializer.context['session'] = session
        serializer.is_valid(raise_exception=True)

        # Submit session with responses
        with transaction.atomic():
            # Create responses
            responses_data = serializer.validated_data['responses']
            time_remaining = serializer.validated_data['time_remaining']

            for response_data in responses_data:
                AnswerResponse.objects.create(
                    session=session,
                    **response_data
                )

            # Submit the session
            session.submit_session(time_remaining)

            # Log submission
            SessionLog.objects.create(
                session=session,
                event_type=SessionLog.EventType.SUBMITTED,
                ip_address=self._get_client_ip(request),
                details={
                    'responses_count': len(responses_data),
                    'time_remaining': time_remaining,
                    'total_score': session.total_score,
                    'percentage_score': float(session.percentage_score) if session.percentage_score else 0
                }
            )

        # Return final results
        detail_serializer = ExamSessionDetailSerializer(session)
        return APIResponse(
            {
                'message': 'Exam submitted successfully',
                'session': detail_serializer.data,
                'results': {
                    'total_score': session.total_score,
                    'percentage_score': float(session.percentage_score) if session.percentage_score else 0,
                    'passed': session.passed,
                    'responses_count': len(responses_data)
                }
            },
            status=status.HTTP_200_OK
        )

    def retrieve(self, request, *args, **kwargs):
        session = self.get_object()
        ensure_active_session(session, ip_address=self._get_client_ip(request))
        session.refresh_from_db()
        serializer = self.get_serializer(session)
        return APIResponse(serializer.data)

    @action(detail=True, methods=['get'])
    def logs(self, request, pk=None):
        """
        Get session logs.
        GET /api/sessions/{id}/logs/
        """
        session = self.get_object()

        # Check permissions
        if session.user != request.user and not request.user.is_admin():
            return APIResponse(
                {'error': 'You can only view logs for your own sessions'},
                status=status.HTTP_403_FORBIDDEN
            )

        logs = session.logs.all()
        serializer = SessionLogSerializer(logs, many=True)
        return APIResponse(serializer.data)

    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        """
        Terminate an active session (admin only).
        POST /api/sessions/{id}/terminate/
        """
        if not request.user.is_admin():
            return APIResponse(
                {'error': 'Only administrators can terminate sessions'},
                status=status.HTTP_403_FORBIDDEN
            )

        session = self.get_object()

        if session.status not in (
            ExamSession.Status.IN_PROGRESS,
            ExamSession.Status.SETUP,
        ):
            return APIResponse(
                {'error': f'Cannot terminate session with status: {session.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        session.status = ExamSession.Status.TERMINATED
        session.submitted_at = timezone.now()
        session.save()

        # Log termination
        SessionLog.objects.create(
            session=session,
            event_type=SessionLog.EventType.TERMINATED,
            ip_address=self._get_client_ip(request),
            details={'terminated_by': request.user.username}
        )

        return APIResponse(
            {'message': 'Session terminated successfully'},
            status=status.HTTP_200_OK
        )

    def _get_client_ip(self, request):
        """Get client IP address."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class ResponseViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for responses.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ResponseSerializer

    def get_queryset(self):
        """Filter responses based on user role."""
        if self.request.user.is_admin():
            return AnswerResponse.objects.all()
        return AnswerResponse.objects.filter(session__user=self.request.user)

