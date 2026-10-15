"""Seed 5 abstract-reasoning admission exams for the Guidance department.

Creates the Office of Guidance and Counseling (OGC) department and the
"Mental / Abstract Reasoning" category if they don't already exist, then builds
five published admission exams (Forms A-E). Every question is an abstract /
non-verbal reasoning item with a **real image stem** (a ``QuestionAttachment``)
and **real image answer choices** (each ``options`` entry carries an ``image``
media URL) - the picture-based item type the platform was built for
(see ``Question.options`` help text and the taking UI's option/attachment
rendering).

Images are generated procedurally with Pillow (see ``_abstract_figures.py``),
so no binary assets need to live in the repo and re-seeding reproduces the
same forms.

The exams are driven through the real service layer (create -> submit ->
approve -> publish), exactly like ``seed_demo``, so they exercise the same
code paths a real exam maker hits and land in the ACTIVE/available state
examinees can start.

Idempotent: re-running deletes any exams this command previously created
(matched by the ``SEED_TAG`` marker in their description) plus their generated
media, then rebuilds them. Safe to run against the CSV demo database.

Usage:
    python manage.py seed_guidance_abstract
    python manage.py seed_guidance_abstract --monitoring   # webcam-proctored
"""

from __future__ import annotations

import random
import shutil
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from features.exams import services as exam_services
from features.exams.models import (
    Department,
    Exam,
    ExamCategory,
    ExamSection,
    Question,
    QuestionAttachment,
)

from . import _abstract_figures as figs

User = get_user_model()

SEED_TAG = "[seed:guidance-abstract]"
OPTION_LETTERS = ["A", "B", "C", "D"]

DEPARTMENT = {
    "name": "Office of Guidance and Counseling",
    "abbreviation": "OGC",
    "sort_order": 4,
}
CATEGORY = {
    "name": "Mental / Abstract Reasoning",
    "slug": "mental-abstract-reasoning",
    "description": "Abstract reasoning, pattern recognition, and cognitive-ability items.",
    "sort_order": 2,
}

# Five forms; each names the generators (from _abstract_figures.GENERATORS) it
# draws its items from, so the forms feel distinct rather than identical.
FORMS = [
    ("Form A - Series & Patterns",
     ["rotation_series", "count_series", "polygon_sides_series", "size_series",
      "rotation_series", "count_series", "polygon_sides_series", "size_series"]),
    ("Form B - Figural Analogies",
     ["analogy", "polygon_sides_series", "analogy", "rotation_series",
      "analogy", "size_series", "analogy", "count_series"]),
    ("Form C - Odd One Out",
     ["odd_one_out", "odd_one_out", "polygon_sides_series", "odd_one_out",
      "rotation_series", "odd_one_out", "count_series", "odd_one_out"]),
    ("Form D - Mixed Reasoning",
     ["rotation_series", "analogy", "odd_one_out", "count_series",
      "size_series", "polygon_sides_series", "analogy", "rotation_series"]),
    ("Form E - Advanced Patterns",
     ["polygon_sides_series", "rotation_series", "analogy", "odd_one_out",
      "size_series", "count_series", "analogy", "rotation_series"]),
]

GEN_BY_NAME = {g.__name__: g for g in figs.GENERATORS}


class Command(BaseCommand):
    help = "Seed 5 image-based abstract-reasoning admission exams for the Guidance department."

    def add_arguments(self, parser):
        parser.add_argument(
            "--monitoring",
            action="store_true",
            help="Enable webcam monitoring on the seeded exams (default: off, so they "
                 "are immediately takeable without proctoring setup).",
        )
        parser.add_argument(
            "--questions",
            type=int,
            default=8,
            help="Questions per exam (default: 8).",
        )

    def handle(self, *args, **options):
        creator = self._pick_creator()
        monitoring = options["monitoring"]
        per_exam = max(5, options["questions"])  # readiness warns under 5

        with transaction.atomic():
            department = self._ensure_department()
            category = self._ensure_category()
            self._delete_previous(department)

            created = []
            for index, (form_title, gen_names) in enumerate(FORMS):
                exam = self._build_form(
                    creator=creator,
                    department=department,
                    category=category,
                    form_title=form_title,
                    gen_names=gen_names,
                    per_exam=per_exam,
                    monitoring=monitoring,
                    seed=1000 + index,
                )
                created.append(exam)

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {len(created)} Guidance abstract-reasoning admission exam(s):"
        ))
        for exam in created:
            self.stdout.write(
                f"  - {exam.title}  [{exam.exam_code}]  "
                f"{exam.total_questions} questions  status={exam.status}"
            )
        self.stdout.write(
            "All forms are published and open now. Monitoring is "
            f"{'ON' if monitoring else 'OFF'}."
        )

    # -- Reference data --------------------------------------------------------

    def _pick_creator(self) -> User:
        """An admin (or superuser) creator, so publish needs no separate approver."""
        creator = (
            User.objects.filter(is_superuser=True).order_by("id").first()
            or User.objects.filter(role=User.Role.ADMIN).order_by("id").first()
        )
        if creator is None:
            raise CommandError(
                "No admin or superuser found to own the exams. Seed users first "
                "(e.g. `python manage.py seed_db` or create a superuser)."
            )
        return creator

    def _ensure_department(self) -> Department:
        dept, created = Department.objects.get_or_create(
            abbreviation=DEPARTMENT["abbreviation"], defaults=DEPARTMENT
        )
        self.stdout.write(
            f"{'Created' if created else 'Reusing'} department {dept.abbreviation}."
        )
        return dept

    def _ensure_category(self) -> ExamCategory:
        cat, created = ExamCategory.objects.get_or_create(
            slug=CATEGORY["slug"], defaults=CATEGORY
        )
        self.stdout.write(
            f"{'Created' if created else 'Reusing'} category '{cat.name}'."
        )
        return cat

    def _delete_previous(self, department: Department) -> None:
        previous = Exam.objects.filter(
            department=department, description__contains=SEED_TAG
        )
        count = previous.count()
        if not count:
            return
        for exam in previous:
            self._purge_media(exam)
        previous.delete()
        self.stdout.write(f"Removed {count} previously seeded exam(s) before rebuild.")

    # -- Media -----------------------------------------------------------------

    def _option_dir(self, exam_code: str) -> str:
        return f"questions/options/{exam_code}"

    def _purge_media(self, exam: Exam) -> None:
        """Delete generated option images and attachment files for an exam."""
        media_root = Path(settings.MEDIA_ROOT)
        for rel in (self._option_dir(exam.exam_code or f"exam-{exam.id}"),
                    f"questions/{exam.id}"):
            target = media_root / rel
            if target.exists():
                shutil.rmtree(target, ignore_errors=True)

    def _save_option_image(self, exam_code: str, order: int, letter: str, png: bytes) -> str:
        name = f"{self._option_dir(exam_code)}/q{order:02d}_{letter}.png"
        saved = default_storage.save(name, ContentFile(png))
        return default_storage.url(saved)

    # -- Exam construction -----------------------------------------------------

    def _build_form(self, *, creator, department, category, form_title, gen_names,
                    per_exam, monitoring, seed) -> Exam:
        rng = random.Random(seed)
        title = f"Guidance Admission Test - Abstract Reasoning ({form_title})"

        exam = Exam.objects.create(
            title=title,
            description=(
                f"Non-verbal abstract-reasoning admission test administered by the "
                f"Office of Guidance and Counseling. Every item is image-based. {SEED_TAG}"
            ),
            instructions=(
                "Each question shows a series or set of figures. Study the pattern, "
                "then choose the image that best completes or answers it. All items are "
                "picture-based; there is no reading required."
            ),
            duration_minutes=30,
            passing_score=50,
            status=Exam.Status.DRAFT,
            department=department,
            category=category,
            monitoring_enabled=monitoring,
            is_practice=False,
            shuffle_questions=True,
            shuffle_options=False,  # options are letters bound to images; keep A-D stable
            requires_assignment=False,
            max_attempts=1,
            presentation_mode=Exam.PresentationMode.ONE_PER_PAGE,
            show_correct_answers=Exam.ShowCorrectAnswers.NEVER,
            created_by=creator,
            available_from=timezone.now() - timezone.timedelta(days=1),
            available_until=timezone.now() + timezone.timedelta(days=180),
        )
        exam.exam_code = exam_services.generate_exam_code(department)
        exam.save(update_fields=["exam_code"])
        exam.departments.add(department)

        section = ExamSection.objects.create(
            exam=exam, title="Abstract Reasoning", order=1, questions_per_page=1,
            instructions="Choose the image that completes the pattern.",
        )

        # Expand the generator list to the requested count, then draw each item.
        chosen = [gen_names[i % len(gen_names)] for i in range(per_exam)]
        for order, gen_name in enumerate(chosen, start=1):
            item = GEN_BY_NAME[gen_name](rng)
            self._create_question(exam, section, order, item)

        exam.update_question_count()
        self._publish(exam, creator)
        exam.refresh_from_db()
        return exam

    def _create_question(self, exam, section, order, item: figs.AbstractItem) -> None:
        options = []
        correct_letter = OPTION_LETTERS[item.correct_index]
        for i, png in enumerate(item.option_pngs):
            letter = OPTION_LETTERS[i]
            url = self._save_option_image(exam.exam_code, order, letter, png)
            options.append({"text": letter, "image": url})

        question = Question.objects.create(
            exam=exam,
            section=section,
            order=order,
            question_text=item.prompt,
            question_type=Question.QuestionType.MULTIPLE_CHOICE,
            options=options,
            correct_answer=correct_letter,
            points=1,
        )
        # Stem image as a real attachment (served at /media/... like any upload).
        # Some item types (odd-one-out) have no separate stem - the choices are
        # the figure set - so only attach when the generator produced one.
        if item.stem_png is not None:
            question.attachments.create(
                file=ContentFile(item.stem_png, name=f"q{order:02d}_stem.png"),
                kind=QuestionAttachment.Kind.IMAGE,
                caption="",
                order=0,
            )

    def _publish(self, exam: Exam, creator) -> None:
        exam_services.submit_exam_for_approval(exam, creator)
        # Creator is an admin/superuser, so they can approve their own submission.
        exam_services.approve_exam(exam, creator)
        exam_services.publish_exam(exam, creator)
