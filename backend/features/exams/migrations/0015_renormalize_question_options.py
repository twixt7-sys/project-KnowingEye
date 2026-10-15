"""Re-run the 0013 options normalization for rows written since.

0013 converted every `Question.options` row that existed at the time from a
flat list of strings to the canonical [{"text": str, "image": null}, ...]
shape. It only ran once, against whatever was in the table then - it can't
retroactively fix rows written afterwards.

seed_db.py's raw CSV loader (parse_json_field) wrote plain string lists
straight into the JSONField without that normalization until it was fixed
(see "Fix blank answer choices and unsaved answers on seeded exams"), so any
re-seed run between 0013 landing and that fix reintroduced the same
malformed shape the frontend's question-panel.tsx now tolerates at render
time, but the DB itself is still left holding the bad data.
"""

from django.db import migrations


def renormalize_options(apps, schema_editor):
    Question = apps.get_model("exams", "Question")

    for question in Question.objects.exclude(options=[]).iterator():
        options = question.options or []
        if options and all(isinstance(o, dict) for o in options):
            continue  # already canonical
        question.options = [
            {"text": str(o), "image": None} if not isinstance(o, dict) else o
            for o in options
        ]
        question.save(update_fields=["options"])


def noop_reverse(apps, schema_editor):
    # See 0013 - not meaningfully reversible, and the schema doesn't change.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("exams", "0014_assignment_seat_label"),
    ]

    operations = [
        migrations.RunPython(renormalize_options, noop_reverse),
    ]
