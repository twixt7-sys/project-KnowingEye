from rest_framework import serializers
from django.utils import timezone

from features.exams import services as exam_services
from features.exams.serializers import ExamDetailSerializer, ExamTakeSerializer

from .models import ExamSession, Response, SessionLog
from .services import get_or_create_setup_session


class ResponseSerializer(serializers.ModelSerializer):
    """Serializer for Response model."""

    question_text = serializers.CharField(source='question.question_text', read_only=True)
    question_type = serializers.CharField(source='question.question_type', read_only=True)
    points = serializers.IntegerField(source='question.points', read_only=True)
    correct_answer = serializers.SerializerMethodField()

    class Meta:
        model = Response
        fields = [
            'id', 'question', 'question_text', 'question_type', 'answer_text',
            'is_correct', 'time_spent', 'points', 'points_awarded', 'grader_comment',
            'answered_at', 'autosaved_at', 'flagged_for_review', 'correct_answer',
        ]
        read_only_fields = ['id', 'is_correct', 'answered_at', 'correct_answer']

    def get_correct_answer(self, obj):
        request = self.context.get('request')
        exam = obj.session.exam
        user = getattr(request, 'user', None) if request else None
        is_grader = user and (getattr(user, 'is_admin', lambda: False)() or getattr(user, 'is_faculty', lambda: False)())
        if not is_grader:
            from features.exams import services
            if not user or not services.results_visible_to_user(exam, user):
                return None
        return obj.question.correct_answer


class ResponseUpsertSerializer(serializers.Serializer):
    """Autosave a single or batch of responses during an attempt."""

    responses = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False,
    )

    def validate_responses(self, value):
        session = self.context.get('session')
        if not session:
            raise serializers.ValidationError('Session context is required.')

        validated = []
        for i, item in enumerate(value):
            question_id = item.get('question_id')
            if question_id is None:
                raise serializers.ValidationError(f'Response {i + 1}: question_id is required.')
            try:
                question = session.exam.questions.get(id=question_id)
            except session.exam.questions.model.DoesNotExist:
                raise serializers.ValidationError(
                    f'Question {question_id} does not exist in this exam.'
                )
            if session.question_order and question_id not in session.question_order:
                raise serializers.ValidationError(
                    f'Question {question_id} is not part of this attempt.'
                )
            validated.append({
                'question': question,
                'answer_text': item.get('answer_text', ''),
                'time_spent': int(item.get('time_spent', 0)),
                'flagged_for_review': bool(item.get('flagged_for_review', False)),
            })
        return validated


class ResponseGradeSerializer(serializers.ModelSerializer):
    """Manual grading for open-ended responses."""

    class Meta:
        model = Response
        fields = ['is_correct', 'points_awarded', 'grader_comment', 'flagged_for_review']

    def validate(self, attrs):
        response = self.instance
        points = attrs.get('points_awarded')
        if points is not None and points < 0:
            raise serializers.ValidationError({'points_awarded': 'Cannot be negative.'})
        if points is not None and response and points > response.question.points:
            raise serializers.ValidationError(
                {'points_awarded': f'Cannot exceed {response.question.points} points.'}
            )
        return attrs


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

    exam = serializers.SerializerMethodField()
    exam_title = serializers.CharField(source="exam.title", read_only=True)
    exam_duration_minutes = serializers.IntegerField(
        source="exam.duration_minutes", read_only=True
    )
    user_name = serializers.CharField(source="user.get_full_name", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    responses = ResponseSerializer(many=True, read_only=True)
    time_elapsed_seconds = serializers.SerializerMethodField()
    time_remaining_seconds = serializers.SerializerMethodField()

    class Meta:
        model = ExamSession
        fields = [
            "id",
            "exam",
            "exam_title",
            "exam_duration_minutes",
            "user",
            "user_name",
            "user_email",
            "started_at",
            "exam_started_at",
            "submitted_at",
            "time_remaining",
            "status",
            "ip_address",
            "user_agent",
            "total_score",
            "percentage_score",
            "passed",
            "responses",
            "time_elapsed_seconds",
            "time_remaining_seconds",
            "deadline_at",
            "option_order",
            "accommodation_extra_minutes",
        ]
        read_only_fields = [
            "id",
            "started_at",
            "exam_started_at",
            "submitted_at",
            "total_score",
            "percentage_score",
            "passed",
        ]

    def get_exam(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        is_grader = user and (getattr(user, "is_admin", lambda: False)() or getattr(user, "is_faculty", lambda: False)())
        if is_grader:
            data = ExamDetailSerializer(obj.exam, context=self.context).data
        else:
            data = ExamTakeSerializer(obj.exam, context=self.context).data
        data = self._apply_question_order(data, obj.question_order)
        return self._apply_option_order(data, obj.option_order)

    @staticmethod
    def _apply_option_order(exam_data, option_order):
        if not option_order or not exam_data.get('questions'):
            return exam_data
        questions = []
        for q in exam_data['questions']:
            qid = str(q['id'])
            if qid in option_order:
                q = {**q, 'options': option_order[qid]}
            questions.append(q)
        return {**exam_data, 'questions': questions}

    @staticmethod
    def _apply_question_order(exam_data, question_order):
        """Present questions in the per-session order (shuffled or canonical)."""
        questions = exam_data.get("questions")
        if not questions or not question_order:
            return exam_data
        by_id = {q["id"]: q for q in questions}
        ordered = [by_id[qid] for qid in question_order if qid in by_id]
        seen = set(question_order)
        ordered.extend(q for q in questions if q["id"] not in seen)
        exam_data = {**exam_data, "questions": ordered}
        return exam_data

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
        user = self.context["request"].user
        exam_services.assert_exam_available_for_user(value, user)
        return value

    def create(self, validated_data):
        """Create or resume a setup-phase session."""
        request = self.context['request']
        exam = validated_data['exam']
        session, _created = get_or_create_setup_session(
            request.user,
            exam,
            ip_address=self._get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
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
        allow_empty=True,
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

        required_fields = ['question_id']
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
                'answer_text': response_data.get('answer_text', ''),
                'time_spent': response_data.get('time_spent', 0),
                'flagged_for_review': bool(response_data.get('flagged_for_review', False)),
            })

        return validated_responses


class SessionLogSerializer(serializers.ModelSerializer):
    """Serializer for session logs."""

    event_display = serializers.CharField(source='get_event_type_display', read_only=True)

    class Meta:
        model = SessionLog
        fields = ['id', 'event_type', 'event_display', 'timestamp', 'details', 'ip_address']
        read_only_fields = ['id', 'timestamp']
