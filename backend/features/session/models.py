from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
import uuid

from features.exams.models import Exam

User = get_user_model()


class ExamSession(models.Model):
    """
    Tracks individual exam taking sessions.
    Each session represents one attempt by a user to take an exam.
    """

    class Status(models.TextChoices):
        SETUP = 'setup', 'Setup'
        IN_PROGRESS = 'in_progress', 'In Progress'
        PENDING_REVIEW = 'pending_review', 'Pending Review'
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
        help_text='When the session record was created'
    )
    exam_started_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the examinee began the timed exam portion',
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
        default=Status.SETUP,
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
    question_order = models.JSONField(
        null=True,
        blank=True,
        help_text='Question IDs in the order presented to this examinee (set when the exam begins)',
    )
    option_order = models.JSONField(
        null=True,
        blank=True,
        help_text='Per-question shuffled option order: {question_id: [option, ...]}',
    )
    deadline_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Server-computed deadline when the timed exam ends',
    )
    accommodation_extra_minutes = models.PositiveIntegerField(
        default=0,
        help_text='Extra time granted for this attempt (minutes)',
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
            # One active (setup / in-progress) session per examinee across all exams.
            models.UniqueConstraint(
                fields=['user'],
                condition=models.Q(status__in=['in_progress', 'setup']),
                name='unique_active_session_per_user',
            ),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.exam.title} ({self.get_status_display()})"

    @property
    def timed_end_at(self):
        """Authoritative end time for the timed exam portion."""
        if self.exam_started_at:
            return self.exam_started_at + timedelta(seconds=self.duration_seconds)
        return self.deadline_at

    @property
    def duration_seconds(self):
        """Total duration of the exam in seconds (includes accommodations)."""
        base = self.exam.duration_minutes * 60
        return base + (self.accommodation_extra_minutes * 60)

    @property
    def time_elapsed(self):
        """Time elapsed since the timed exam began (or since record creation in setup)."""
        anchor = self.exam_started_at or self.started_at
        if self.submitted_at:
            return (self.submitted_at - anchor).total_seconds()
        if self.status == self.Status.SETUP:
            return 0.0
        return (timezone.now() - anchor).total_seconds()

    @property
    def time_remaining_seconds(self):
        """Calculate remaining time in seconds."""
        if self.status in (self.Status.COMPLETED, self.Status.PENDING_REVIEW):
            return self.time_remaining
        if self.status == self.Status.SETUP:
            return self.duration_seconds
        end_at = self.timed_end_at
        if end_at:
            remaining = (end_at - timezone.now()).total_seconds()
            return max(0, int(remaining))
        elapsed = self.time_elapsed
        total = self.duration_seconds
        return max(0, int(total - elapsed))

    def is_expired(self):
        """Check if the timed exam portion has expired."""
        if self.status != self.Status.IN_PROGRESS:
            return False
        return self.time_remaining_seconds <= 0

    def can_submit(self):
        """Check if the session can be submitted."""
        return self.status == self.Status.IN_PROGRESS

    def can_begin_exam(self):
        return self.status == self.Status.SETUP

    def submit_session(self, time_remaining=None):
        """Mark session as completed (or pending review) and calculate final score."""
        if not self.can_submit():
            return False

        self.submitted_at = timezone.now()
        if time_remaining is not None:
            self.time_remaining = time_remaining

        self.calculate_score()

        if self.responses.filter(flagged_for_review=True, points_awarded__isnull=True).exists():
            self.status = self.Status.PENDING_REVIEW
        else:
            self.status = self.Status.COMPLETED

        self.save()
        return True

    def presented_question_ids(self) -> list[int]:
        """Question IDs included in this attempt (pools + shuffle applied)."""
        if self.question_order:
            return list(self.question_order)
        return list(
            self.exam.questions.order_by('order').values_list('id', flat=True)
        )

    def calculate_score(self):
        """Calculate total score and percentage from all presented questions.

        ``exam.unanswered_counts_as_wrong`` (default True) controls whether a
        question the examinee never answered still counts toward the total:
        True (default) - it does, at zero points, same as answering wrong.
        False - it's excluded from both earned and total points entirely, so
        the percentage reflects only what was actually attempted.
        """
        presented_ids = self.presented_question_ids()
        if not presented_ids:
            self.total_score = 0
            self.percentage_score = 0
            self.passed = False
            return

        questions_by_id = {
            q.id: q
            for q in self.exam.questions.filter(id__in=presented_ids)
        }
        responses_by_q = {r.question_id: r for r in self.responses.all()}
        count_unanswered = self.exam.unanswered_counts_as_wrong

        total_points = 0
        earned_points = 0

        for qid in presented_ids:
            question = questions_by_id.get(qid)
            if not question:
                continue
            response = responses_by_q.get(qid)
            # A manually-awarded grade always counts, even over a blank
            # answer_text, so a grader's override is never silently dropped.
            answered = bool(
                response
                and ((response.answer_text or '').strip() or response.points_awarded is not None)
            )
            if not answered and not count_unanswered:
                continue
            total_points += question.points
            if response:
                if response.points_awarded is not None:
                    earned_points += response.points_awarded
                elif response.is_correct:
                    earned_points += question.points

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
        help_text='Whether this response was flagged for manual review',
    )
    points_awarded = models.IntegerField(
        null=True,
        blank=True,
        help_text='Manual override points (null = use auto-grade)',
    )
    grader_comment = models.TextField(blank=True, default='')
    graded_at = models.DateTimeField(null=True, blank=True)
    graded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='graded_responses',
    )
    autosaved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Last autosave timestamp during in-progress attempt',
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
        """Auto-check correctness on save when not manually graded."""
        if not self.pk:
            self.check_correctness()
        elif self.points_awarded is None and not self.flagged_for_review:
            self.check_correctness()
        super().save(*args, **kwargs)

    def check_correctness(self):
        """Check if the answer is correct based on question type."""
        question = self.question
        answer = self.answer_text or ''

        if not answer.strip():
            self.is_correct = False
            if question.question_type in ('short_answer', 'essay'):
                self.flagged_for_review = False
            return

        if question.question_type == 'multiple_choice':
            self.is_correct = self._normalize(answer) == self._normalize(question.correct_answer)

        elif question.question_type == 'true_false':
            self.is_correct = self._normalize(answer) == self._normalize(question.correct_answer)

        elif question.question_type == 'short_answer':
            if self._matches_short_answer(question, answer):
                self.is_correct = True
                self.flagged_for_review = False
            else:
                self.is_correct = False
                self.flagged_for_review = True

        elif question.question_type == 'essay':
            self.is_correct = False
            self.flagged_for_review = True

        else:
            self.is_correct = False
            self.flagged_for_review = True

    def _normalize(self, text: str) -> str:
        value = text or ''
        if getattr(self.question, 'trim_whitespace', True):
            value = value.strip()
        if not getattr(self.question, 'case_sensitive', False):
            value = value.lower()
        return value

    def _matches_short_answer(self, question, answer: str) -> bool:
        candidates = [question.correct_answer] + list(question.acceptable_answers or [])
        normalized_answer = self._normalize(answer)
        for candidate in candidates:
            if not candidate:
                continue
            norm = candidate.strip()
            if not question.case_sensitive:
                norm = norm.lower()
            if normalized_answer == norm:
                return True
        return False


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
        EXAM_BEGAN = 'exam_began', 'Exam Began'
        TAB_HIDDEN = 'tab_hidden', 'Tab Hidden'
        TAB_VISIBLE = 'tab_visible', 'Tab Visible'
        FULLSCREEN_EXIT = 'fullscreen_exit', 'Fullscreen Exit'

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

