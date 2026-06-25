from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models import Exam, Question, QuestionAttachment

User = get_user_model()


class QuestionAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = QuestionAttachment
        fields = ["id", "kind", "url", "caption", "order", "created_at"]
        read_only_fields = fields

    def get_url(self, obj) -> str | None:
        if not obj.file:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url


class QuestionTakeSerializer(serializers.ModelSerializer):
    """Examinee-safe question payload — no answer key."""

    attachments = QuestionAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = [
            "id",
            "question_text",
            "question_type",
            "options",
            "points",
            "order",
            "attachments",
        ]
        read_only_fields = fields


class QuestionSerializer(serializers.ModelSerializer):
    """Serializer for Question model (admin — includes answer key)."""

    attachments = QuestionAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = [
            "id",
            "exam",
            "question_text",
            "question_type",
            "options",
            "correct_answer",
            "points",
            "order",
            "attachments",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class QuestionDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for Question with all fields."""

    exam_title = serializers.CharField(source="exam.title", read_only=True)
    attachments = QuestionAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = [
            "id",
            "exam",
            "exam_title",
            "question_text",
            "question_type",
            "options",
            "correct_answer",
            "points",
            "order",
            "attachments",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class QuestionCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating questions."""

    class Meta:
        model = Question
        fields = [
            "question_text",
            "question_type",
            "options",
            "correct_answer",
            "points",
            "order",
        ]

    def validate_options(self, value):
        if value and not isinstance(value, list):
            raise serializers.ValidationError("Options must be a list.")
        return value

    def validate(self, attrs):
        qtype = attrs.get(
            "question_type",
            getattr(self.instance, "question_type", Question.QuestionType.MULTIPLE_CHOICE),
        )
        options = attrs.get("options", getattr(self.instance, "options", []) or [])
        correct = attrs.get(
            "correct_answer", getattr(self.instance, "correct_answer", "")
        )
        correct = (correct or "").strip()
        question_text = attrs.get(
            "question_text", getattr(self.instance, "question_text", "")
        )

        if not (question_text or "").strip():
            raise serializers.ValidationError(
                {"question_text": "Question text is required."}
            )

        if qtype == Question.QuestionType.MULTIPLE_CHOICE:
            if len(options) < 2:
                raise serializers.ValidationError(
                    {"options": "Multiple choice needs at least two options."}
                )
            if not correct:
                raise serializers.ValidationError(
                    {"correct_answer": "Select the correct option."}
                )
            if correct not in options:
                raise serializers.ValidationError(
                    {"correct_answer": "Correct answer must match one of the options."}
                )
        elif qtype == Question.QuestionType.TRUE_FALSE:
            normalized = correct.lower()
            if normalized not in ("true", "false"):
                raise serializers.ValidationError(
                    {"correct_answer": "Use 'true' or 'false' for true/false questions."}
                )
            attrs["correct_answer"] = normalized
        elif not correct:
            raise serializers.ValidationError(
                {"correct_answer": "An answer key is required for this question type."}
            )

        return attrs


class ExamListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for exam lists."""

    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    question_count = serializers.SerializerMethodField()
    is_open = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = [
            "id",
            "title",
            "exam_code",
            "duration_minutes",
            "total_questions",
            "passing_score",
            "status",
            "available_from",
            "available_until",
            "max_attempts",
            "is_open",
            "created_by_name",
            "created_at",
            "question_count",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "total_questions",
            "created_by_name",
            "question_count",
            "is_open",
        ]

    def get_question_count(self, obj):
        return obj.questions.count()

    def get_is_open(self, obj):
        from . import services

        return services.exam_is_open_for_taking(obj)


class ExamTakeSerializer(serializers.ModelSerializer):
    """Examinee-safe exam detail — questions without answer keys."""

    questions = QuestionTakeSerializer(many=True, read_only=True)
    is_open = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = [
            "id",
            "title",
            "description",
            "instructions",
            "exam_code",
            "duration_minutes",
            "total_questions",
            "passing_score",
            "status",
            "available_from",
            "available_until",
            "max_attempts",
            "is_open",
            "questions",
        ]
        read_only_fields = fields

    def get_is_open(self, obj):
        from . import services

        return services.exam_is_open_for_taking(obj)


class ExamDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for exam with questions (admin)."""

    questions = QuestionSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    created_by_email = serializers.CharField(source="created_by.email", read_only=True)
    publish_readiness = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = [
            "id",
            "title",
            "description",
            "instructions",
            "exam_code",
            "duration_minutes",
            "total_questions",
            "passing_score",
            "status",
            "available_from",
            "available_until",
            "max_attempts",
            "created_by",
            "created_by_name",
            "created_by_email",
            "questions",
            "publish_readiness",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "total_questions",
            "created_by_name",
            "created_by_email",
            "publish_readiness",
        ]

    def get_publish_readiness(self, obj):
        from . import services

        return services.exam_publish_readiness(obj)


class ExamCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating exams."""

    max_attempts = serializers.IntegerField(required=False, default=1, min_value=1)

    class Meta:
        model = Exam
        fields = [
            "id",
            "title",
            "description",
            "instructions",
            "exam_code",
            "duration_minutes",
            "passing_score",
            "available_from",
            "available_until",
            "max_attempts",
            "status",
        ]
        read_only_fields = ["id"]

    def validate_duration_minutes(self, value):
        if value < 1:
            raise serializers.ValidationError("Duration must be at least 1 minute.")
        return value

    def validate_passing_score(self, value):
        if not 0 <= value <= 100:
            raise serializers.ValidationError("Passing score must be between 0 and 100.")
        return value

    def validate(self, attrs):
        start = attrs.get(
            "available_from",
            getattr(self.instance, "available_from", None),
        )
        end = attrs.get(
            "available_until",
            getattr(self.instance, "available_until", None),
        )
        if start and end and end <= start:
            raise serializers.ValidationError(
                {"available_until": "End time must be after the start time."}
            )
        code = attrs.get("exam_code")
        if code == "":
            attrs["exam_code"] = None
        if attrs.get("max_attempts") in (None, ""):
            attrs["max_attempts"] = 1
        return attrs

    def create(self, validated_data):
        validated_data.setdefault("max_attempts", 1)
        validated_data.setdefault("description", "")
        validated_data.setdefault("instructions", "")
        return super().create(validated_data)


class QuestionImportSerializer(serializers.Serializer):
    """Bulk import questions from a CSV string or JSON list."""

    csv = serializers.CharField(required=False, allow_blank=True)
    questions = serializers.ListField(child=serializers.DictField(), required=False)

    def validate(self, attrs):
        if not attrs.get("csv") and not attrs.get("questions"):
            raise serializers.ValidationError(
                "Provide either 'csv' or 'questions' for import."
            )
        return attrs


class QuestionReorderSerializer(serializers.Serializer):
    question_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )
