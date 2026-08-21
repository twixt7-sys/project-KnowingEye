"""Data migration for Sprint 3 (Directive Area 03 - Exam Management & LMS Behavior).

Three things need backfilling once the schema from 0012 is in place:

1. Seed ExamCategory with the Guidance content types named in the Directive's
   "Guidance-specific scope" item - psychological, mental/abstract, and
   behavioral/character - not academic subjects.
2. Backfill the new `departments` M2M from the existing single `department`
   FK so every exam keeps its current visibility after the multi-department
   change lands.
3. Convert `Question.options` from a flat list of strings to a list of
   {"text": str, "image": null} objects, matching the new per-option-image
   shape, without touching `correct_answer` (which stays a plain string
   matched against each option's `text`).
"""

from django.db import migrations


CATEGORIES = [
    {
        "name": "Psychological",
        "slug": "psychological",
        "description": "Personality, temperament, and psychological-profile assessments.",
        "sort_order": 1,
    },
    {
        "name": "Mental / Abstract Reasoning",
        "slug": "mental-abstract-reasoning",
        "description": "Abstract reasoning, pattern recognition, and cognitive-ability items.",
        "sort_order": 2,
    },
    {
        "name": "Behavioral / Character",
        "slug": "behavioral-character",
        "description": "Behavioral tendencies, character, and values assessments.",
        "sort_order": 3,
    },
]


def seed_categories_and_backfill(apps, schema_editor):
    ExamCategory = apps.get_model("exams", "ExamCategory")
    Exam = apps.get_model("exams", "Exam")
    Question = apps.get_model("exams", "Question")

    for entry in CATEGORIES:
        ExamCategory.objects.get_or_create(slug=entry["slug"], defaults=entry)

    for exam in Exam.objects.filter(department__isnull=False).iterator():
        exam.departments.add(exam.department_id)

    for question in Question.objects.exclude(options=[]).iterator():
        options = question.options or []
        if options and all(isinstance(o, dict) for o in options):
            continue  # already migrated (e.g. re-run, or created after 0012)
        question.options = [
            {"text": str(o), "image": None} if not isinstance(o, dict) else o
            for o in options
        ]
        question.save(update_fields=["options"])


def noop_reverse(apps, schema_editor):
    # Data backfill is not meaningfully reversible (option string->dict is
    # lossy-safe forward but ambiguous in reverse); reversing the schema in
    # 0012 is sufficient, so this migration's reverse is a no-op.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("exams", "0012_exam_category_departments_options"),
    ]

    operations = [
        migrations.RunPython(seed_categories_and_backfill, noop_reverse),
    ]
