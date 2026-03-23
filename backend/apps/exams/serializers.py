from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models import Exam, Question

User = get_user_model()


class QuestionSerializer(serializers.ModelSerializer):
    """Serializer for Question model."""

    class Meta:
        model = Question
        fields = ['id', 'exam', 'question_text', 'question_type', 'options', 'correct_answer', 'points', 'order', 'created_at']
        read_only_fields = ['id', 'created_at']


class QuestionDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for Question with all fields."""

    exam_title = serializers.CharField(source='exam.title', read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'exam', 'exam_title', 'question_text', 'question_type', 'options', 'correct_answer', 'points', 'order', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class QuestionCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating questions."""

    class Meta:
        model = Question
        fields = ['question_text', 'question_type', 'options', 'correct_answer', 'points', 'order']

    def validate_options(self, value):
        """Validate that options is a list."""
        if value and not isinstance(value, list):
            raise serializers.ValidationError("Options must be a list.")
        return value


class ExamListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for exam lists."""

    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = ['id', 'title', 'duration_minutes', 'total_questions', 'passing_score', 'status', 'created_by_name', 'created_at', 'question_count']
        read_only_fields = ['id', 'created_at', 'total_questions', 'created_by_name', 'question_count']

    def get_question_count(self, obj):
        """Get the actual question count."""
        return obj.questions.count()


class ExamDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for exam with questions."""

    questions = QuestionSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)

    class Meta:
        model = Exam
        fields = ['id', 'title', 'description', 'instructions', 'duration_minutes', 'total_questions', 'passing_score', 'status', 'created_by', 'created_by_name', 'created_by_email', 'questions', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'total_questions', 'created_by_name', 'created_by_email']


class ExamCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating exams."""

    class Meta:
        model = Exam
        fields = ['title', 'description', 'instructions', 'duration_minutes', 'passing_score', 'status']

    def validate_duration_minutes(self, value):
        """Validate exam duration."""
        if value < 1:
            raise serializers.ValidationError("Duration must be at least 1 minute.")
        return value

    def validate_passing_score(self, value):
        """Validate passing score."""
        if not 0 <= value <= 100:
            raise serializers.ValidationError("Passing score must be between 0 and 100.")
        return value
