from rest_framework import serializers
from django.utils import timezone

from features.exams.serializers import ExamDetailSerializer

from .models import ExamSession, Response, SessionLog


class ResponseSerializer(serializers.ModelSerializer):
    """Serializer for Response model."""

    question_text = serializers.CharField(source='question.question_text', read_only=True)
    question_type = serializers.CharField(source='question.question_type', read_only=True)
    points = serializers.IntegerField(source='question.points', read_only=True)

    class Meta:
        model = Response
        fields = [
            'id', 'question', 'question_text', 'question_type', 'answer_text',
            'is_correct', 'time_spent', 'points', 'answered_at', 'flagged_for_review'
        ]
        read_only_fields = ['id', 'is_correct', 'answered_at']


class ResponseCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating responses."""

    class Meta:
        model = Response
        fields = ['question', 'answer_text', 'time_spent']

    def validate_question(self, value):
        """Ensure question belongs to the session's exam."""
        session = self.context.get('session')
        if session and value.exam != session.exam:
            raise serializers.ValidationError("Question does not belong to this exam.")
        return value


class ExamSessionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for session lists."""

    exam_title = serializers.CharField(source='exam.title', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    time_remaining_seconds = serializers.SerializerMethodField()

    class Meta:
        model = ExamSession
        fields = [
            'id', 'exam_title', 'user_name', 'started_at', 'status',
            'time_remaining_seconds', 'total_score', 'percentage_score', 'passed'
        ]
        read_only_fields = ['id', 'started_at']

    def get_time_remaining_seconds(self, obj):
        return obj.time_remaining_seconds


class ExamSessionDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for exam sessions."""

    exam = ExamDetailSerializer(read_only=True)
    exam_title = serializers.CharField(source='exam.title', read_only=True)
    exam_duration_minutes = serializers.IntegerField(source='exam.duration_minutes', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    responses = ResponseSerializer(many=True, read_only=True)
    time_elapsed_seconds = serializers.SerializerMethodField()
    time_remaining_seconds = serializers.SerializerMethodField()

    class Meta:
        model = ExamSession
        fields = [
            'id', 'exam', 'exam_title', 'exam_duration_minutes', 'user', 'user_name', 'user_email',
            'started_at', 'submitted_at', 'time_remaining', 'status', 'ip_address', 'user_agent',
            'total_score', 'percentage_score', 'passed', 'responses',
            'time_elapsed_seconds', 'time_remaining_seconds'
        ]
        read_only_fields = [
            'id', 'started_at', 'submitted_at', 'total_score', 'percentage_score', 'passed'
        ]

    def get_time_elapsed_seconds(self, obj):
        return int(obj.time_elapsed)

    def get_time_remaining_seconds(self, obj):
        return int(obj.time_remaining_seconds)


class ExamSessionStartSerializer(serializers.ModelSerializer):
    """Serializer for starting a new exam session."""

    class Meta:
        model = ExamSession
        fields = ['exam']

    def validate_exam(self, value):
        """Validate that exam is active and user can take it."""
        user = self.context['request'].user

        # Check if exam is active
        if value.status != 'active':
            raise serializers.ValidationError("Exam is not available for taking.")

        # Check if user already has an active session for this exam
        active_session = ExamSession.objects.filter(
            exam=value,
            user=user,
            status='in_progress'
        ).first()

        if active_session:
            raise serializers.ValidationError(
                f"You already have an active session for this exam (ID: {active_session.id})"
            )

        return value

    def create(self, validated_data):
        """Create a new exam session."""
        request = self.context['request']
        exam = validated_data['exam']

        session = ExamSession.objects.create(
            exam=exam,
            user=request.user,
            ip_address=self._get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            status=ExamSession.Status.IN_PROGRESS
        )

        # Log session start
        SessionLog.objects.create(
            session=session,
            event_type=SessionLog.EventType.STARTED,
            ip_address=session.ip_address,
            details={'exam_title': exam.title, 'duration_minutes': exam.duration_minutes}
        )

        return session

    def _get_client_ip(self, request):
        """Get client IP address."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class ExamSessionSubmitSerializer(serializers.Serializer):
    """Serializer for submitting exam responses."""

    responses = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False,
        help_text='List of responses with question_id, answer_text, and time_spent'
    )
    time_remaining = serializers.IntegerField(
        min_value=0,
        help_text='Time remaining in seconds when submitted'
    )

    def validate_responses(self, value):
        """Validate response format."""
        session = self.context.get('session')
        if not session:
            raise serializers.ValidationError("Session context is required.")

        required_fields = ['question_id', 'answer_text', 'time_spent']
        validated_responses = []

        for i, response_data in enumerate(value):
            missing_fields = [field for field in required_fields if field not in response_data]
            if missing_fields:
                raise serializers.ValidationError(
                    f"Response {i+1} is missing required fields: {missing_fields}"
                )

            # Validate question exists and belongs to exam
            question_id = response_data['question_id']
            try:
                question = session.exam.questions.get(id=question_id)
            except session.exam.questions.model.DoesNotExist:
                raise serializers.ValidationError(
                    f"Question {question_id} does not exist in this exam."
                )

            validated_responses.append({
                'question': question,
                'answer_text': response_data['answer_text'],
                'time_spent': response_data['time_spent']
            })

        return validated_responses


class SessionLogSerializer(serializers.ModelSerializer):
    """Serializer for session logs."""

    event_display = serializers.CharField(source='get_event_type_display', read_only=True)

    class Meta:
        model = SessionLog
        fields = ['id', 'event_type', 'event_display', 'timestamp', 'details', 'ip_address']
        read_only_fields = ['id', 'timestamp']
