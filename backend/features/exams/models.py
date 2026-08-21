from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth import get_user_model

User = get_user_model()


class Department(models.Model):
    """Institutional department used for exam code generation."""

    name = models.CharField(max_length=255, unique=True)
    abbreviation = models.CharField(
        max_length=16,
        unique=True,
        help_text="Short code used in exam identifiers (e.g. ENT, IIT)",
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "exams_department"
        ordering = ["sort_order", "name"]

    def __str__(self):
        return f"{self.name} ({self.abbreviation})"


class ExamCategory(models.Model):
    """Guidance-content classification, independent of academic department.

    Directive Area 03 ("Guidance-specific scope"): the panel asked the team
    to re-examine whether department should be a primary exam attribute at
    all, since Guidance's process (psychological/behavioral assessment)
    is broader than one academic department. Category is the discovery axis
    built for that: seeded with Guidance content types, not subjects.
    """

    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=64, unique=True)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "exams_category"
        verbose_name = "Exam category"
        verbose_name_plural = "Exam categories"
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name


def _question_attachment_path(instance: "QuestionAttachment", filename: str) -> str:
    return f"questions/{instance.question.exam_id}/{instance.question_id}/{filename}"


class Exam(models.Model):
    """
    Exam model representing an examination.
    Admins can create and manage exams.
    """

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        ACTIVE = 'active', 'Active'
        ARCHIVED = 'archived', 'Archived'

    class ApprovalStatus(models.TextChoices):
        """Level 0/1 approval chain (Directive A1 - "Administrator responsibilities").

        Creators (faculty/guidance_staff/program_head) submit a draft for
        review; a program head or admin approves or rejects it. Only an
        APPROVED exam may be published (see services.publish_exam), so the
        administrator is no longer the sole path from draft to live.
        """

        NOT_SUBMITTED = 'not_submitted', 'Not submitted'
        PENDING = 'pending', 'Pending review'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

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
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="exams",
        help_text="Home department that owns this exam (used for auto-generated codes)",
    )
    departments = models.ManyToManyField(
        Department,
        blank=True,
        related_name="shared_exams",
        help_text=(
            "Every department this exam is assigned to, including the home department. "
            "Lets shared/general-ed exams be discovered from more than one department "
            "without giving up the single home department the exam code is generated from."
        ),
    )
    category = models.ForeignKey(
        ExamCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="exams",
        help_text="Guidance content classification (psychological, behavioral, ...), independent of department",
    )
    exam_code = models.CharField(
        max_length=32,
        blank=True,
        null=True,
        unique=True,
        help_text='Institutional exam code (e.g. ENT-2026-A)',
    )
    available_from = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When examinees may start the exam (null = immediately when active)',
    )
    available_until = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Last moment examinees may start the exam',
    )
    max_attempts = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text='Maximum completed attempts per examinee',
    )
    monitoring_enabled = models.BooleanField(
        default=True,
        help_text='When enabled, examinees complete proctoring setup and webcam monitoring during the exam',
    )
    shuffle_questions = models.BooleanField(
        default=False,
        help_text='When enabled, each examinee receives questions in a randomized order',
    )
    shuffle_options = models.BooleanField(
        default=False,
        help_text='When enabled, multiple-choice options are shuffled per attempt',
    )
    unanswered_counts_as_wrong = models.BooleanField(
        default=True,
        help_text='When true, unanswered questions score zero toward the total',
    )
    requires_assignment = models.BooleanField(
        default=False,
        help_text='When true, only assigned candidates may start this exam',
    )
    results_release_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When examinees may view results (null = immediate on submit)',
    )
    class ShowCorrectAnswers(models.TextChoices):
        NEVER = 'never', 'Never'
        AFTER_RELEASE = 'after_release', 'After results release'
        IMMEDIATELY = 'immediately', 'Immediately after submit'

    show_correct_answers = models.CharField(
        max_length=20,
        choices=ShowCorrectAnswers.choices,
        default=ShowCorrectAnswers.NEVER,
        help_text='When examinees may see correct answers',
    )
    is_practice = models.BooleanField(
        default=False,
        help_text='Practice exams allow unlimited attempts and optional answer reveal',
    )
    class PresentationMode(models.TextChoices):
        ONE_PER_PAGE = 'one_per_page', 'One question per page'
        SECTION_PER_PAGE = 'section_per_page', 'One section per page'
        SCROLL_ALL = 'scroll_all', 'All questions on one page'

    presentation_mode = models.CharField(
        max_length=20,
        choices=PresentationMode.choices,
        default=PresentationMode.ONE_PER_PAGE,
    )
    max_tab_switches = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Optional limit on tab switches before flagging (null = no limit)',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        help_text='Exam status'
    )
    approval_status = models.CharField(
        max_length=20,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.NOT_SUBMITTED,
        help_text='Level 0/1 approval chain state - must be APPROVED before publish',
    )
    submitted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='submitted_exams',
        help_text='User who last submitted this exam for approval',
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_exams',
        help_text='Program head / admin who last approved or rejected this exam',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_note = models.TextField(
        blank=True,
        default='',
        help_text='Reviewer feedback when approval_status is REJECTED',
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_exams',
        help_text='User who created this exam'
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
            models.Index(fields=['exam_code']),
            models.Index(fields=['available_from', 'available_until']),
            models.Index(fields=['approval_status']),
            models.Index(fields=['category']),
        ]

    def __str__(self):
        return self.title

    def update_question_count(self):
        """Update total_questions count based on actual questions."""
        self.total_questions = self.questions.count()
        self.save(update_fields=['total_questions'])


class ExamSection(models.Model):
    """Logical section within an exam (title, instructions, paging)."""

    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name='sections',
    )
    title = models.CharField(max_length=255)
    instructions = models.TextField(blank=True, default='')
    order = models.PositiveIntegerField(default=0)
    questions_per_page = models.PositiveIntegerField(
        default=1,
        help_text='1 = one question per page; 0 = show all questions in section',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'exams_section'
        ordering = ['exam', 'order']
        unique_together = [['exam', 'order']]

    def __str__(self):
        return f"{self.exam.title} — {self.title}"


class QuestionPool(models.Model):
    """Random draw pool: N questions selected from linked questions per attempt."""

    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name='question_pools',
    )
    name = models.CharField(max_length=255)
    draw_count = models.PositiveIntegerField(
        default=1,
        help_text='Number of questions drawn from this pool per attempt',
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'exams_question_pool'
        ordering = ['exam', 'order']

    def __str__(self):
        return f"{self.exam.title} — pool {self.name}"


class ExamAssignment(models.Model):
    """Roster entry: which examinee may take an exam."""

    class Status(models.TextChoices):
        INVITED = 'invited', 'Invited'
        ELIGIBLE = 'eligible', 'Eligible'
        BLOCKED = 'blocked', 'Blocked'

    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name='assignments',
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='exam_assignments',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ELIGIBLE,
    )
    access_code = models.CharField(max_length=64, blank=True, default='')
    attempts_override = models.PositiveIntegerField(null=True, blank=True)
    extra_time_minutes = models.PositiveIntegerField(default=0)
    seat_label = models.CharField(
        max_length=32,
        blank=True,
        default='',
        help_text=(
            "Physical seat/room/station identifier, so a proctor can find a flagged "
            "examinee in person rather than only in a list row (Directive Area 04 - "
            "'proctor locator')."
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'exams_assignment'
        unique_together = [['exam', 'user']]
        indexes = [
            models.Index(fields=['exam', 'status']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"{self.user.username} → {self.exam.title}"


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
    section = models.ForeignKey(
        ExamSection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='questions',
    )
    pool = models.ForeignKey(
        QuestionPool,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='questions',
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
        help_text=(
            'JSON array of answer options for multiple choice. Each item is '
            '{"text": str, "image": str | null} - image is a media URL, set '
            'via the option-image upload endpoint, for abstract/psychological '
            'items that need image-based options rather than plain text.'
        ),
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
    shuffle_options_override = models.BooleanField(
        null=True,
        blank=True,
        help_text='Override exam-level option shuffle (null = inherit)',
    )
    acceptable_answers = models.JSONField(
        default=list,
        blank=True,
        help_text='Additional acceptable answers for short-answer auto-grade',
    )
    case_sensitive = models.BooleanField(default=False)
    trim_whitespace = models.BooleanField(default=True)
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


class QuestionAttachment(models.Model):
    """Media file attached to an exam question."""

    class Kind(models.TextChoices):
        IMAGE = "image", "Image"
        PDF = "pdf", "PDF"
        AUDIO = "audio", "Audio"

    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    file = models.FileField(upload_to=_question_attachment_path)
    kind = models.CharField(max_length=16, choices=Kind.choices)
    caption = models.CharField(max_length=255, blank=True, default="")
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "exams_question_attachment"
        ordering = ["order", "id"]

    def __str__(self):
        return f"Attachment {self.kind} for Q{self.question.order}"


class ExamApprovalEvent(models.Model):
    """Audit trail for the exam submit -> review -> approve/reject chain.

    Mirrors the shape of ``authentication.PermissionChange`` - one immutable
    row per transition, so the approval history for an exam (and the "who
    approved this and when" answer the panel asked for) is always
    reconstructable, per the Directive's Area 01 "Administrator
    responsibilities" hierarchy requirement.
    """

    class Action(models.TextChoices):
        SUBMIT = "submit", "Submitted for review"
        APPROVE = "approve", "Approved"
        REJECT = "reject", "Rejected"

    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name="approval_events",
    )
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="exam_approval_events",
    )
    action = models.CharField(max_length=10, choices=Action.choices)
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "exams_approval_event"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.exam_id} - {self.action} by {self.actor_id}"

