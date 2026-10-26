"""Tell open browsers (and server caches) when exam data changes."""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from core.realtime.events import STAFF_GROUP, Topic, notify

from .models import (
    Department,
    Exam,
    ExamApprovalEvent,
    ExamAssignment,
    ExamCategory,
    ExamSection,
    Question,
    QuestionAttachment,
    QuestionPool,
)


@receiver([post_save, post_delete], sender=Department)
@receiver([post_save, post_delete], sender=ExamCategory)
def reference_data_changed(sender, **kwargs):
    # Also drops the cached department/category lists (``reference-data``).
    notify(Topic.REFERENCE)


@receiver([post_save, post_delete], sender=Exam)
def exam_changed(sender, instance, **kwargs):
    notify(Topic.EXAMS, exam_id=instance.pk)


@receiver([post_save, post_delete], sender=ExamSection)
@receiver([post_save, post_delete], sender=QuestionPool)
@receiver([post_save, post_delete], sender=Question)
@receiver([post_save, post_delete], sender=ExamApprovalEvent)
def exam_part_changed(sender, instance, **kwargs):
    # Examinees see an exam's content only inside an attempt, which is frozen
    # when it starts, so only staff screens need to follow these.
    notify(Topic.EXAMS, exam_id=instance.exam_id, audience=STAFF_GROUP)


@receiver([post_save, post_delete], sender=QuestionAttachment)
def attachment_changed(sender, instance, **kwargs):
    question = Question.objects.filter(pk=instance.question_id).values("exam_id").first()
    notify(Topic.EXAMS, exam_id=question["exam_id"] if question else None, audience=STAFF_GROUP)


@receiver([post_save, post_delete], sender=ExamAssignment)
def assignment_changed(sender, instance, **kwargs):
    # The candidate list is staff-only, but whether the exam is offered to
    # this examinee changed too.
    notify(Topic.EXAMS, exam_id=instance.exam_id, audience=STAFF_GROUP, user_id=instance.user_id)
