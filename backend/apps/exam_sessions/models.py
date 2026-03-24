from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid

from exams.models import Exam

User = get_user_model()


class ExamSession(models.Model):
    """
    Tracks individual exam taking sessions.
    Each session represents one attempt by a user to take an exam.
    """

    class Status(models.TextChoices):
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        TERMINATED = 'terminated', 'Terminated'
        EXPIRED = 'expired', 'Expired'

    id = models.UUIDField(primary_key=True, editable=False, default=uuid.uuid4)
    exam = models.ForeignKey(
        Exam,
        on_delete=models.PROTECT,
        related_name='sessions',
        help_text='The exam being taken'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='exam_sessions',
        help_text='The examinee taking the exam'
    )
    started_at = models.DateTimeField(
        auto_now_add=True,
        help_text='When the session started'
    )
    submitted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the exam was submitted'
    )
    time_remaining = models.IntegerField(
        default=0,
        help_text='Seconds remaining when submitted (for partial submissions)'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.IN_PROGRESS,
        help_text='Current session status'
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text='Client IP address for security tracking'
    )
    user_agent = models.TextField(
        null=True,
        blank=True,
        help_text='Browser/client information'
    )
    total_score = models.IntegerField(
        null=True,
        blank=True,
        help_text='Total score achieved (calculated on submission)'
    )
    percentage_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Percentage score (0-100)'
    )
    passed = models.BooleanField(
        null=True,
        blank=True,
        help_text='Whether the examinee passed the exam'
    )

    class Meta:
        db_table = 'user_sessions_exam_session'
        verbose_name = 'Exam Session'
        verbose_name_plural = 'Exam Sessions'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['exam', 'user']),
            models.Index(fields=['status', 'started_at']),
            models.Index(fields=['user', 'started_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['exam', 'user'],
                condition=models.Q(status__in=['in_progress']),
                name='unique_active_session_per_exam_user'
            )
        ]

    def __str__(self):
        return f"{self.user.username} - {self.exam.title} ({self.get_status_display()})"

    @property
    def duration_seconds(self):
        """Total duration of the exam in seconds."""
        return self.exam.duration_minutes * 60

    @property
    def time_elapsed(self):
        """Time elapsed since session started."""
        if self.submitted_at:
            return (self.submitted_at - self.started_at).total_seconds()
        return (timezone.now() - self.started_at).total_seconds()

    @property
    def time_remaining_seconds(self):
        """Calculate remaining time in seconds."""
        if self.status == self.Status.COMPLETED:
            return self.time_remaining
        elapsed = self.time_elapsed
        total = self.duration_seconds
        return max(0, total - elapsed)

    def is_expired(self):
        """Check if the session has expired."""
        return self.time_remaining_seconds <= 0 and self.status == self.Status.IN_PROGRESS

    def can_submit(self):
        """Check if the session can be submitted."""
        return self.status == self.Status.IN_PROGRESS

    def submit_session(self, time_remaining=None):
        """Mark session as completed and calculate final score."""
        if not self.can_submit():
            return False

        self.submitted_at = timezone.now()
        self.status = self.Status.COMPLETED
        if time_remaining is not None:
            self.time_remaining = time_remaining

        # Calculate final score
        self.calculate_score()
        self.save()
        return True

    def calculate_score(self):
        """Calculate total score and percentage from responses."""
        responses = self.responses.all()
        total_points = 0
        earned_points = 0

        for response in responses:
            total_points += response.question.points
            if response.is_correct:
                earned_points += response.question.points

        self.total_score = earned_points
        if total_points > 0:
            self.percentage_score = (earned_points / total_points) * 100
            self.passed = self.percentage_score >= self.exam.passing_score
        else:
            self.percentage_score = 0
            self.passed = False


class Response(models.Model):
    """
    Stores individual question responses from exam sessions.
    Each response represents one answer to one question.
    """

    session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name='responses',
        help_text='The exam session this response belongs to'
    )
    question = models.ForeignKey(
        'exams.Question',
        on_delete=models.PROTECT,
        related_name='responses',
        help_text='The question being answered'
    )
    answer_text = models.TextField(
        help_text='The answer provided by the examinee'
    )
    is_correct = models.BooleanField(
        default=False,
        help_text='Whether the answer matches the correct answer'
    )
    time_spent = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text='Time spent on this question in seconds'
    )
    answered_at = models.DateTimeField(
        auto_now_add=True,
        help_text='When this answer was submitted'
    )
    flagged_for_review = models.BooleanField(
        default=False,
        help_text='Whether this response was flagged for manual review'
    )

    class Meta:
        db_table = 'user_sessions_response'
        verbose_name = 'Response'
        verbose_name_plural = 'Responses'
        ordering = ['session', 'question__order']
        unique_together = [['session', 'question']]
        indexes = [
            models.Index(fields=['session', 'question']),
            models.Index(fields=['is_correct']),
            models.Index(fields=['flagged_for_review']),
        ]

    def __str__(self):
        return f"{self.session.user.username} - Q{self.question.order}: {self.is_correct}"

    def save(self, *args, **kwargs):
        """Auto-check correctness on save."""
        if not self.pk:  # Only on creation
            self.check_correctness()
        super().save(*args, **kwargs)

    def check_correctness(self):
        """Check if the answer is correct based on question type."""
        question = self.question

        if question.question_type == 'multiple_choice':
            # For multiple choice, check if answer matches correct_answer
            self.is_correct = self.answer_text.strip().lower() == question.correct_answer.strip().lower()

        elif question.question_type == 'true_false':
            # For true/false, direct comparison
            self.is_correct = self.answer_text.strip().lower() == question.correct_answer.strip().lower()

        elif question.question_type in ['short_answer', 'essay']:
            # For short answer and essay, flag for manual review
            self.is_correct = False  # Default to false, requires manual grading
            self.flagged_for_review = True

        else:
            # Unknown question type
            self.is_correct = False
            self.flagged_for_review = True


class SessionLog(models.Model):
    """
    Logs session events and activities for audit purposes.
    """

    class EventType(models.TextChoices):
        STARTED = 'started', 'Session Started'
        SUBMITTED = 'submitted', 'Session Submitted'
        TERMINATED = 'terminated', 'Session Terminated'
        EXPIRED = 'expired', 'Session Expired'
        RESUMED = 'resumed', 'Session Resumed'
        PAUSED = 'paused', 'Session Paused'

    session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name='logs',
        help_text='The session this log entry belongs to'
    )
    event_type = models.CharField(
        max_length=20,
        choices=EventType.choices,
        help_text='Type of session event'
    )
    timestamp = models.DateTimeField(
        auto_now_add=True,
        help_text='When the event occurred'
    )
    details = models.JSONField(
        default=dict,
        blank=True,
        help_text='Additional event details (JSON)'
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text='IP address at time of event'
    )

    class Meta:
        db_table = 'user_sessions_session_log'
        verbose_name = 'Session Log'
        verbose_name_plural = 'Session Logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['session', 'timestamp']),
            models.Index(fields=['event_type', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.session} - {self.get_event_type_display()} ({self.timestamp})"

