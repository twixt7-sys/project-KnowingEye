from django.shortcuts import render

from rest_framework.exceptions import ValidationError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response as APIResponse
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db import transaction

from core.security import service as security

from .models import ExamSession, Response as AnswerResponse, SessionLog
from .serializers import (
    ExamSessionListSerializer,
    ExamSessionDetailSerializer,
    ExamSessionStartSerializer,
    ExamSessionSubmitSerializer,
    ResponseSerializer,
    ResponseUpsertSerializer,
    ResponseGradeSerializer,
    SessionLogSerializer,
)
from .submission import submit_session_with_responses, upsert_response
from .services import (
    begin_exam_session,
    ensure_active_session,
    finalize_grading_if_complete,
    get_or_create_setup_session,
)


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
        if security.has_module(self.request.user, "sessions"):
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
        if session.user != request.user and not security.has_module(request.user, "sessions"):
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
                'message': 'Exam started - timer is now running.',
                'session': detail_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='cancel-setup')
    def cancel_setup(self, request, pk=None):
        """Let an examinee abandon their own not-yet-started proctoring setup.

        Without this, a student who backs out of camera/identity setup has
        to wait out SETUP_MAX_MINUTES (30 min) before assert_no_other_active_exam
        stops treating it as blocking - which reads as "stuck" during testing
        or when someone just changes their mind about which exam to start.
        """
        session = self.get_object()
        if session.user != request.user:
            return APIResponse({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        if session.status != ExamSession.Status.SETUP:
            return APIResponse(
                {'error': f'Cannot cancel session with status: {session.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session.status = ExamSession.Status.EXPIRED
        session.submitted_at = timezone.now()
        session.save(update_fields=['status', 'submitted_at'])

        SessionLog.objects.create(
            session=session,
            event_type=SessionLog.EventType.EXPIRED,
            ip_address=self._get_client_ip(request),
            details={'reason': 'cancelled_by_examinee'},
        )
        return APIResponse({'message': 'Setup cancelled.'}, status=status.HTTP_200_OK)

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
        if session.user != request.user and not security.has_module(request.user, "sessions"):
            return APIResponse(
                {'error': 'You can only submit your own exam sessions'},
                status=status.HTTP_403_FORBIDDEN
            )

        ensure_active_session(session, ip_address=self._get_client_ip(request))
        session.refresh_from_db()

        # Check if session can be submitted
        if not session.can_submit():
            if session.status in (
                ExamSession.Status.EXPIRED,
                ExamSession.Status.COMPLETED,
                ExamSession.Status.PENDING_REVIEW,
            ):
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

        with transaction.atomic():
            responses_data = serializer.validated_data['responses']
            time_remaining = serializer.validated_data['time_remaining']
            submit_session_with_responses(
                session,
                responses_data=responses_data,
                time_remaining=time_remaining,
                ip_address=self._get_client_ip(request),
                source='manual',
            )

        detail_serializer = ExamSessionDetailSerializer(session)
        return APIResponse(
            {
                'message': 'Exam submitted successfully',
                'session': detail_serializer.data,
                'results': {
                    'total_score': session.total_score,
                    'percentage_score': float(session.percentage_score) if session.percentage_score else 0,
                    'passed': session.passed,
                    'responses_count': session.responses.count(),
                    'status': session.status,
                }
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['patch'], url_path='responses')
    def save_responses(self, request, pk=None):
        """Autosave responses during an in-progress attempt."""
        session = self.get_object()
        if session.user != request.user and not security.has_module(request.user, "sessions"):
            return APIResponse({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        ensure_active_session(session, ip_address=self._get_client_ip(request))
        session.refresh_from_db()
        if session.status != ExamSession.Status.IN_PROGRESS:
            return APIResponse(
                {'error': 'Session is not in progress.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ResponseUpsertSerializer(
            data=request.data,
            context={'session': session},
        )
        serializer.is_valid(raise_exception=True)

        saved = []
        with transaction.atomic():
            for item in serializer.validated_data['responses']:
                response = upsert_response(
                    session,
                    question=item['question'],
                    answer_text=item['answer_text'],
                    time_spent=item['time_spent'],
                    flagged_for_review=item['flagged_for_review'],
                    autosave=True,
                )
                saved.append(response)

        return APIResponse(
            {
                'saved': len(saved),
                'responses': ResponseSerializer(saved, many=True).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def heartbeat(self, request, pk=None):
        """Return authoritative timer state for client sync."""
        session = self.get_object()
        if session.user != request.user and not security.has_module(request.user, "sessions"):
            return APIResponse({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        ensure_active_session(session, ip_address=self._get_client_ip(request))
        session.refresh_from_db()

        return APIResponse(
            {
                'server_now': timezone.now().isoformat(),
                'deadline_at': (
                    session.timed_end_at.isoformat() if session.timed_end_at else None
                ),
                'time_remaining_seconds': session.time_remaining_seconds,
                'status': session.status,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='log-event')
    def log_event(self, request, pk=None):
        """Record browser integrity events (tab switch, fullscreen)."""
        session = self.get_object()
        if session.user != request.user:
            return APIResponse({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        event_type = request.data.get('event_type')
        allowed = {
            'tab_hidden': SessionLog.EventType.TAB_HIDDEN,
            'tab_visible': SessionLog.EventType.TAB_VISIBLE,
            'fullscreen_exit': SessionLog.EventType.FULLSCREEN_EXIT,
        }
        if event_type not in allowed:
            return APIResponse(
                {'error': f'Invalid event_type. Use one of: {list(allowed.keys())}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        SessionLog.objects.create(
            session=session,
            event_type=allowed[event_type],
            ip_address=self._get_client_ip(request),
            details=request.data.get('details') or {},
        )
        return APIResponse({'logged': True}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def recalculate(self, request, pk=None):
        """Recalculate session score after manual grading."""
        if not security.can(request.user, "sessions.grade"):
            return APIResponse({'error': 'You do not have permission to grade sessions.'}, status=status.HTTP_403_FORBIDDEN)

        session = self.get_object()
        session.calculate_score()
        pending = session.responses.filter(
            flagged_for_review=True,
            points_awarded__isnull=True,
        ).exists()
        if pending:
            session.status = ExamSession.Status.PENDING_REVIEW
        else:
            session.status = ExamSession.Status.COMPLETED
        session.save()

        return APIResponse(
            ExamSessionDetailSerializer(session, context={'request': request}).data,
            status=status.HTTP_200_OK,
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
        if session.user != request.user and not security.has_module(request.user, "sessions"):
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
        Terminate an active session.
        POST /api/sessions/{id}/terminate/
        """
        if not security.can(request.user, "sessions.terminate"):
            return APIResponse(
                {'error': 'You do not have permission to terminate sessions.'},
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
    Read-only ViewSet for responses with admin grading.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ResponseSerializer

    def get_queryset(self):
        """Filter responses based on user role."""
        if security.has_module(self.request.user, "sessions"):
            return AnswerResponse.objects.select_related('question', 'session')
        return AnswerResponse.objects.filter(session__user=self.request.user).select_related(
            'question', 'session'
        )

    @action(detail=True, methods=['patch'], url_path='grade')
    def grade(self, request, pk=None):
        """Manually grade a response."""
        if not security.can(request.user, "sessions.grade"):
            return APIResponse({'error': 'You do not have permission to grade responses.'}, status=status.HTTP_403_FORBIDDEN)

        response = self.get_object()
        serializer = ResponseGradeSerializer(
            response,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(
            graded_at=timezone.now(),
            graded_by=request.user,
        )
        if instance.points_awarded is not None:
            instance.is_correct = instance.points_awarded >= instance.question.points
            instance.flagged_for_review = False
            instance.save(update_fields=['is_correct', 'flagged_for_review'])
            finalize_grading_if_complete(instance.session)

        return APIResponse(ResponseSerializer(instance).data, status=status.HTTP_200_OK)

