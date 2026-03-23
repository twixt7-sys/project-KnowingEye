from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth import get_user_model

User = get_user_model()


class Exam(models.Model):
    """
    Exam model representing an examination.
    Admins can create and manage exams.
    """

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        ACTIVE = 'active', 'Active'
        ARCHIVED = 'archived', 'Archived'

    title = models.CharField(
        max_length=255,
        help_text='Exam title'
    )
    description = models.TextField(
        blank=True,
        help_text='Detailed exam description'
    )
    instructions = models.TextField(
        blank=True,
        help_text='Exam instructions for examinees'
    )
    duration_minutes = models.IntegerField(
        default=120,
        validators=[MinValueValidator(1)],
        help_text='Exam duration in minutes'
    )
    total_questions = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text='Total number of questions (auto-calculated)'
    )
    passing_score = models.IntegerField(
        default=40,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Minimum passing percentage'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        help_text='Exam status'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_exams',
        help_text='Admin who created this exam'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'exams_exam'
        verbose_name = 'Exam'
        verbose_name_plural = 'Exams'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['created_by']),
        ]

    def __str__(self):
        return self.title

    def update_question_count(self):
        """Update total_questions count based on actual questions."""
        self.total_questions = self.questions.count()
        self.save(update_fields=['total_questions'])


class Question(models.Model):
    """
    Question model representing a single question in an exam.
    Supports multiple question types.
    """

    class QuestionType(models.TextChoices):
        MULTIPLE_CHOICE = 'multiple_choice', 'Multiple Choice'
        TRUE_FALSE = 'true_false', 'True/False'
        SHORT_ANSWER = 'short_answer', 'Short Answer'
        ESSAY = 'essay', 'Essay'

    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name='questions',
        help_text='Exam this question belongs to'
    )
    question_text = models.TextField(
        help_text='The question content'
    )
    question_type = models.CharField(
        max_length=20,
        choices=QuestionType.choices,
        default=QuestionType.MULTIPLE_CHOICE,
        help_text='Type of question'
    )
    options = models.JSONField(
        default=list,
        blank=True,
        help_text='JSON array of answer options for multiple choice'
    )
    correct_answer = models.TextField(
        help_text='The correct answer or answer key'
    )
    points = models.IntegerField(
        default=1,
        validators=[MinValueValidator(0)],
        help_text='Points awarded for correct answer'
    )
    order = models.IntegerField(
        default=0,
        help_text='Display order within exam'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'exams_question'
        verbose_name = 'Question'
        verbose_name_plural = 'Questions'
        ordering = ['exam', 'order']
        unique_together = [['exam', 'order']]
        indexes = [
            models.Index(fields=['exam', 'order']),
        ]

    def __str__(self):
        return f"{self.exam.title} - Q{self.order}: {self.question_text[:50]}"

    def save(self, *args, **kwargs):
        """Update parent exam question count when question is saved."""
        super().save(*args, **kwargs)
        self.exam.update_question_count()

