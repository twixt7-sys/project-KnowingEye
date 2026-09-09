"""Seed a rich, system-accurate demo dataset.

Unlike ``seed_db`` (CSV-driven, minimal), this command drives the *real*
service layer - ``features.exams.services`` for the create -> submit ->
approve/reject -> publish -> archive lifecycle, and
``features.session.services``/``submission`` for the setup -> begin ->
answer -> submit flow - so the generated data exercises exactly the code
paths a real exam maker and a real examinee hit. Meant to run against a
freshly wiped database (see ``scripts/wipe-data.cmd`` / ``seed_db --flush``);
running it twice will create duplicate exams.

Creates:
* Users across all six roles (extra admins, guidance staff, program heads,
  faculty, proctors, and many students), all pre-verified.
* The three real ExamCategory rows (matching migration 0013) and four
  departments.
* Eight exams spanning the full lifecycle: draft, pending review, rejected,
  archived, and several published (one practice/monitoring-off, one with a
  question pool, one roster-gated via ExamAssignment) - each with sections
  and mixed question types (multiple choice, true/false, short answer,
  essay).
* A batch of completed (and a few pending-review) exam sessions built by
  actually starting, answering, and submitting through the session services,
  so reports/analytics have realistic data too.
"""

from __future__ import annotations

import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.security.service import apply_role_defaults
from features.exams import services as exam_services
from features.exams.models import Department, Exam, ExamAssignment, ExamCategory, ExamSection, Question, QuestionPool
from features.session import services as session_services
from features.session.models import ExamSession
from features.session.submission import submit_session_with_responses

User = get_user_model()

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

DEPARTMENTS = [
    {"name": "Institute of Information Technology", "abbreviation": "IIT", "sort_order": 1},
    {"name": "College of Engineering", "abbreviation": "COE", "sort_order": 2},
    {"name": "College of Business Administration", "abbreviation": "CBA", "sort_order": 3},
    {"name": "Office of Guidance and Counseling", "abbreviation": "OGC", "sort_order": 4},
]

STUDENT_FIRST_NAMES = [
    "Maria", "Juan", "Ana", "Jose", "Liza", "Mark", "Grace", "Paolo", "Ella", "Miguel",
    "Bea", "Carlo", "Nadia", "Enzo", "Kaye", "Rico", "Trisha", "Bryan", "Joy", "Nathan",
    "Camille", "Diego", "Faye", "Gabriel", "Hazel", "Ivan", "Jill", "Kevin", "Lara", "Marco",
    "Nina", "Oscar", "Pia", "Quinn", "Rosa", "Sam", "Tessa", "Uriel", "Vera", "Wes",
]
STUDENT_LAST_NAMES = [
    "Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Torres", "Flores", "Ramos", "Mendoza",
    "Castillo", "Villanueva", "Aquino", "Del Rosario", "Navarro", "Pascual",
]


class Command(BaseCommand):
    help = "Seed a rich, system-accurate demo dataset via the real exam/session services."

    def add_arguments(self, parser):
        parser.add_argument(
            "--students", type=int, default=40, help="Number of student accounts to create."
        )
        parser.add_argument(
            "--noinput", action="store_true", help="Run without confirmation prompts."
        )

    def handle(self, *args, **options):
        if not options["noinput"]:
            confirm = input(
                "This adds a large demo dataset (users, exams, sessions) to the current "
                "database. Run this against a freshly wiped database. Continue? [y/N]: "
            ).strip().lower()
            if confirm not in ("y", "yes"):
                self.stdout.write(self.style.WARNING("Seed aborted by user."))
                return

        self.rng = random.Random(1337)  # deterministic across runs, for reproducible demos

        with transaction.atomic():
            categories = self.create_categories()
            departments = self.create_departments()
            staff = self.create_staff()
            students = self.create_students(options["students"])
            exams = self.create_exams(departments, categories, staff)
            self.run_attempts(exams, students)

        self.stdout.write(self.style.SUCCESS(
            f"Demo seed complete: {len(students)} students, {sum(len(v) for v in staff.values())} "
            f"staff, {len(exams)} exams."
        ))

    # -- Reference data -----------------------------------------------------

    def create_categories(self) -> dict[str, ExamCategory]:
        out = {}
        for entry in CATEGORIES:
            cat, _ = ExamCategory.objects.get_or_create(slug=entry["slug"], defaults=entry)
            out[entry["slug"]] = cat
        return out

    def create_departments(self) -> dict[str, Department]:
        out = {}
        for entry in DEPARTMENTS:
            dept, _ = Department.objects.get_or_create(
                abbreviation=entry["abbreviation"], defaults=entry
            )
            out[entry["abbreviation"]] = dept
        return out

    # -- Users ----------------------------------------------------------------

    def _make_user(self, *, username, email, first_name, last_name, role, **extra):
        user = User.objects.create_user(
            username=username,
            email=email,
            password="DemoPass123!",
            first_name=first_name,
            last_name=last_name,
            role=role,
            email_verified=True,
            **extra,
        )
        apply_role_defaults(user)
        return user

    def create_staff(self) -> dict[str, list[User]]:
        staff = {"admin": [], "guidance_staff": [], "program_head": [], "faculty": [], "proctor": []}

        staff["admin"].append(
            self._make_user(
                username="demo_admin2", email="demo_admin2@knowingeye.test",
                first_name="Sofia", last_name="Ramirez", role=User.Role.ADMIN,
            )
        )

        guidance_names = [("Grace", "Villanueva"), ("Noel", "Fernandez")]
        for i, (fn, ln) in enumerate(guidance_names, start=1):
            staff["guidance_staff"].append(
                self._make_user(
                    username=f"guidance{i}", email=f"guidance{i}@knowingeye.test",
                    first_name=fn, last_name=ln, role=User.Role.GUIDANCE_STAFF,
                )
            )

        head_names = [("Ramon", "Castillo"), ("Divina", "Aquino")]
        for i, (fn, ln) in enumerate(head_names, start=1):
            staff["program_head"].append(
                self._make_user(
                    username=f"proghead{i}", email=f"proghead{i}@knowingeye.test",
                    first_name=fn, last_name=ln, role=User.Role.PROGRAM_HEAD,
                )
            )

        faculty_names = [
            ("Elena", "Mendoza"), ("Victor", "Santos"), ("Carmen", "Reyes"),
            ("Paolo", "Torres"), ("Isabel", "Cruz"),
        ]
        for i, (fn, ln) in enumerate(faculty_names, start=1):
            staff["faculty"].append(
                self._make_user(
                    username=f"faculty{i}", email=f"faculty{i}@knowingeye.test",
                    first_name=fn, last_name=ln, role=User.Role.FACULTY,
                )
            )

        proctor_names = [("Kevin", "Navarro"), ("Joy", "Pascual"), ("Ivan", "Bautista")]
        for i, (fn, ln) in enumerate(proctor_names, start=1):
            staff["proctor"].append(
                self._make_user(
                    username=f"proctor{i}", email=f"proctor{i}@knowingeye.test",
                    first_name=fn, last_name=ln, role=User.Role.PROCTOR,
                )
            )

        self.stdout.write(f"Created {sum(len(v) for v in staff.values())} staff account(s).")
        return staff

    def create_students(self, count: int) -> list[User]:
        students = []
        for i in range(1, count + 1):
            fn = self.rng.choice(STUDENT_FIRST_NAMES)
            ln = self.rng.choice(STUDENT_LAST_NAMES)
            students.append(
                self._make_user(
                    username=f"demo_student{i:03d}",
                    email=f"demo_student{i:03d}@knowingeye.test",
                    first_name=fn,
                    last_name=ln,
                    role=User.Role.STUDENT,
                    student_id=f"2026-{10000 + i}",
                    institution="Knowing Eye Institute",
                )
            )
        self.stdout.write(f"Created {len(students)} student account(s).")
        return students

    # -- Question bank helpers -------------------------------------------------

    def _mc(self, text, options, correct, points=1):
        opts = [{"text": o, "image": None} for o in options]
        return {
            "question_text": text, "question_type": Question.QuestionType.MULTIPLE_CHOICE,
            "options": opts, "correct_answer": correct, "points": points,
        }

    def _tf(self, text, correct, points=1):
        return {
            "question_text": text, "question_type": Question.QuestionType.TRUE_FALSE,
            "options": [], "correct_answer": "true" if correct else "false", "points": points,
        }

    def _sa(self, text, correct, acceptable=None, points=2):
        return {
            "question_text": text, "question_type": Question.QuestionType.SHORT_ANSWER,
            "options": [], "correct_answer": correct, "acceptable_answers": acceptable or [],
            "points": points,
        }

    def _essay(self, text, model_answer="", points=5):
        return {
            "question_text": text, "question_type": Question.QuestionType.ESSAY,
            "options": [], "correct_answer": model_answer, "points": points,
        }

    def _reasoning_questions(self):
        return [
            self._mc("Which shape completes the pattern: circle, square, circle, square, ?",
                      ["Circle", "Square", "Triangle", "Pentagon"], "Circle"),
            self._mc("2, 4, 8, 16, ? - what comes next?", ["18", "24", "32", "20"], "32"),
            self._tf("A cube has 6 faces.", True),
            self._tf("A hexagon has 5 sides.", False),
            self._sa("What is the next prime number after 7?", "11", ["eleven"]),
            self._sa("Spell the missing word: 'The opposite of hot is ___.'", "cold"),
            self._mc(
                "If all Bloops are Razzies and all Razzies are Lazzies, are all Bloops "
                "definitely Lazzies?",
                ["Yes", "No", "Cannot be determined", "Only sometimes"], "Yes",
            ),
            self._essay(
                "Describe your approach to solving an unfamiliar logic puzzle.",
                "Look for patterns, test hypotheses, eliminate impossible options.",
            ),
        ]

    def _psych_questions(self):
        return [
            self._mc(
                "When facing a group project, I usually:",
                ["Take the lead", "Support quietly", "Avoid conflict", "Question the plan"],
                "Take the lead",
            ),
            self._tf("I prefer detailed plans over spontaneous decisions.", True),
            self._tf("I feel energized after large social gatherings.", False),
            self._sa("In one word, how do you handle stress?", "calmly", ["calm", "patiently"]),
            self._essay(
                "Describe a time you had to adapt quickly to change.",
                "Look for a specific example, the action taken, and the outcome.",
            ),
            self._essay(
                "What motivates you most in your studies or work?",
                "Look for genuine, specific motivators rather than generic answers.",
            ),
        ]

    def _values_questions(self):
        return [
            self._mc(
                "If you found a lost wallet with cash inside, you would:",
                ["Return it with all contents", "Keep the cash, return the wallet",
                 "Keep everything", "Ignore it"],
                "Return it with all contents",
            ),
            self._tf("Honesty is more important than personal gain.", True),
            self._sa("What value do you consider most important in teamwork?", "respect",
                      ["trust", "communication", "honesty"]),
            self._essay(
                "Describe a situation where you had to choose between two values.",
                "Look for a genuine trade-off and a clear rationale for the choice made.",
            ),
        ]

    # -- Exams -----------------------------------------------------------------

    def _build_exam(
        self, *, title, department, category, creator, sections_spec,
        monitoring_enabled=True, is_practice=False, shuffle_options=False,
        requires_assignment=False, max_attempts=1,
    ) -> Exam:
        """Create a draft exam with sectioned questions (and an optional pool)."""
        exam = Exam.objects.create(
            title=title,
            description=f"Demo seed exam - {title}",
            instructions="Answer every question to the best of your ability.",
            duration_minutes=45,
            passing_score=60,
            status=Exam.Status.DRAFT,
            department=department,
            category=category,
            monitoring_enabled=monitoring_enabled,
            is_practice=is_practice,
            shuffle_options=shuffle_options,
            requires_assignment=requires_assignment,
            max_attempts=max_attempts,
            created_by=creator,
        )
        exam.exam_code = exam_services.generate_exam_code(department)
        exam.save(update_fields=["exam_code"])
        exam.departments.add(department)

        question_order = 1
        for section_order, (section_title, questions) in enumerate(sections_spec, start=1):
            section = ExamSection.objects.create(
                exam=exam, title=section_title, order=section_order
            )
            for q in questions:
                Question.objects.create(exam=exam, section=section, order=question_order, **q)
                question_order += 1
        exam.update_question_count()
        return exam

    def create_exams(self, departments, categories, staff) -> list[Exam]:
        iit, coe, cba, ogc = departments["IIT"], departments["COE"], departments["CBA"], departments["OGC"]
        psych, reasoning, values = (
            categories["psychological"], categories["mental-abstract-reasoning"],
            categories["behavioral-character"],
        )
        faculty = staff["faculty"]
        program_head = staff["program_head"][0]
        admin = staff["admin"][0]

        exams: list[Exam] = []

        # 1. Published, monitored, sectioned - the main "real" entrance exam.
        exam1 = self._build_exam(
            title="IIT Placement Exam 2026-A", department=iit, category=reasoning,
            creator=faculty[0], shuffle_options=True,
            sections_spec=[
                ("Part A - Pattern Recognition", self._reasoning_questions()[:4]),
                ("Part B - Verbal & Logic", self._reasoning_questions()[4:]),
            ],
        )
        exam_services.submit_exam_for_approval(exam1, faculty[0])
        exam_services.approve_exam(exam1, program_head)
        exam_services.publish_exam(exam1, faculty[0])
        exams.append(exam1)

        # 2. Practice exam, monitoring OFF - easy smoke-testing, unlimited attempts.
        exam2 = self._build_exam(
            title="IIT Practice Diagnostic", department=iit, category=reasoning,
            creator=faculty[0], monitoring_enabled=False, is_practice=True,
            max_attempts=999,
            sections_spec=[("Warm-up", self._reasoning_questions()[:5])],
        )
        exam2.show_correct_answers = Exam.ShowCorrectAnswers.IMMEDIATELY
        exam2.save(update_fields=["show_correct_answers"])
        exam_services.submit_exam_for_approval(exam2, faculty[0])
        exam_services.approve_exam(exam2, program_head)
        exam_services.publish_exam(exam2, faculty[0])
        exams.append(exam2)

        # 3. Published with a question pool (random draw) - monitoring off so the
        # smoke test can complete it without a webcam.
        exam3 = self._build_exam(
            title="COE Aptitude Exam 2026-A", department=coe, category=reasoning,
            creator=faculty[1], monitoring_enabled=False,
            sections_spec=[("Aptitude", self._reasoning_questions()[:6])],
        )
        pool = QuestionPool.objects.create(exam=exam3, name="Aptitude pool", draw_count=4, order=1)
        exam3.questions.update(pool=pool)
        exam_services.submit_exam_for_approval(exam3, faculty[1])
        exam_services.approve_exam(exam3, program_head)
        exam_services.publish_exam(exam3, faculty[1])
        exams.append(exam3)

        # 4. Draft - still being built, never submitted.
        exam4 = self._build_exam(
            title="CBA Entrance Exam 2026-A (Draft)", department=cba, category=reasoning,
            creator=faculty[2],
            sections_spec=[("Numeracy", self._reasoning_questions()[:3])],
        )
        exams.append(exam4)

        # 5. Pending review - submitted, awaiting a program head.
        exam5 = self._build_exam(
            title="CBA Values Assessment (Pending Review)", department=cba, category=values,
            creator=faculty[2],
            sections_spec=[("Values", self._values_questions())],
        )
        exam_services.submit_exam_for_approval(exam5, faculty[2])
        exams.append(exam5)

        # 6. Rejected - sent back with a note.
        exam6 = self._build_exam(
            title="IIT Personality Inventory (Rejected)", department=iit, category=psych,
            creator=faculty[3],
            sections_spec=[("Personality", self._psych_questions())],
        )
        exam_services.submit_exam_for_approval(exam6, faculty[3])
        exam_services.reject_exam(
            exam6, program_head, note="Add more items - six is too few for a full inventory."
        )
        exams.append(exam6)

        # 7. Archived - was live, now retired.
        exam7 = self._build_exam(
            title="COE Midyear Exam 2025 (Archived)", department=coe, category=reasoning,
            creator=faculty[1], monitoring_enabled=False,
            sections_spec=[("Midyear", self._reasoning_questions()[:5])],
        )
        exam_services.submit_exam_for_approval(exam7, faculty[1])
        exam_services.approve_exam(exam7, program_head)
        exam_services.publish_exam(exam7, faculty[1])
        exam_services.archive_exam(exam7, faculty[1])
        exams.append(exam7)

        # 8. Roster-gated (ExamAssignment) guidance survey, monitoring off.
        exam8 = self._build_exam(
            title="Guidance Career Interest Survey", department=ogc, category=values,
            creator=staff["guidance_staff"][0], monitoring_enabled=False,
            requires_assignment=True,
            sections_spec=[("Interests", self._values_questions())],
        )
        exam_services.submit_exam_for_approval(exam8, staff["guidance_staff"][0])
        exam_services.approve_exam(exam8, admin)
        exam_services.publish_exam(exam8, staff["guidance_staff"][0])
        exams.append(exam8)
        self._roster_exam = exam8  # attempts() needs to know who's assigned

        self.stdout.write(f"Created {len(exams)} exam(s) across the full lifecycle.")
        return exams

    # -- Attempts (drives the real session services) ---------------------------

    def _answer_for(self, question: Question, *, correct: bool) -> str:
        """A plausible answer_text for a question, correct or deliberately wrong."""
        if question.question_type == Question.QuestionType.MULTIPLE_CHOICE:
            texts = [o["text"] for o in question.options]
            if correct:
                return question.correct_answer
            wrong = [t for t in texts if t != question.correct_answer]
            return self.rng.choice(wrong) if wrong else question.correct_answer
        if question.question_type == Question.QuestionType.TRUE_FALSE:
            return question.correct_answer if correct else (
                "false" if question.correct_answer == "true" else "true"
            )
        if question.question_type == Question.QuestionType.SHORT_ANSWER:
            return question.correct_answer if correct else "not sure"
        # Essay: always a free-text answer, graded manually.
        return "This is my demo answer explaining my reasoning in detail."

    def _take_exam(self, exam: Exam, student: User, *, correct_rate: float) -> ExamSession | None:
        """Start, answer, and submit one attempt through the real session services."""
        try:
            session, _created = session_services.get_or_create_setup_session(
                student, exam, ip_address="127.0.0.1", user_agent="seed_demo",
            )
        except Exception as exc:
            self.stdout.write(
                self.style.WARNING(f"  Skipped {student.username} on '{exam.title}': {exc}")
            )
            return None

        if session.status == ExamSession.Status.SETUP:
            from ai.identity_store import store_reference

            store_reference(session, [self.rng.random() for _ in range(128)], "seed_demo")
            session_services.begin_exam_session(session, ip_address="127.0.0.1")
            session.refresh_from_db()

        responses = []
        for qid in session.question_order or []:
            question = exam.questions.get(id=qid)
            is_correct_attempt = self.rng.random() < correct_rate
            responses.append({
                "question": question,
                "answer_text": self._answer_for(question, correct=is_correct_attempt),
                "time_spent": self.rng.randint(15, 90),
            })

        submit_session_with_responses(
            session, responses_data=responses,
            time_remaining=self.rng.randint(0, 600),
            ip_address="127.0.0.1", source="seed_demo",
        )
        return session

    def _grade_pending_essays(self, session: ExamSession) -> None:
        """Manually grade flagged essay responses, mirroring the real grading endpoint."""
        from features.session.services import finalize_grading_if_complete

        pending = session.responses.filter(flagged_for_review=True, points_awarded__isnull=True)
        for response in pending:
            full_credit = self.rng.random() < 0.7
            response.points_awarded = response.question.points if full_credit else max(
                0, response.question.points - 1
            )
            response.is_correct = full_credit
            response.flagged_for_review = False
            response.graded_at = timezone.now()
            response.save(update_fields=["points_awarded", "is_correct", "flagged_for_review", "graded_at"])
        finalize_grading_if_complete(session)

    def run_attempts(self, exams: list[Exam], students: list[User]) -> None:
        by_title = {e.title: e for e in exams}
        student_pool = list(students)
        self.rng.shuffle(student_pool)
        sessions_created = 0
        graded = 0

        def take_batch(exam: Exam, count: int, correct_rate: float, grade_after: bool):
            nonlocal sessions_created, graded
            batch = student_pool[:count]
            for student in batch:
                session = self._take_exam(exam, student, correct_rate=correct_rate)
                if session is None:
                    continue
                sessions_created += 1
                if grade_after and session.status == ExamSession.Status.PENDING_REVIEW:
                    if self.rng.random() < 0.6:  # leave some genuinely pending for the demo
                        self._grade_pending_essays(session)
                        graded += 1

        take_batch(by_title["IIT Placement Exam 2026-A"], 15, correct_rate=0.65, grade_after=True)
        take_batch(by_title["IIT Practice Diagnostic"], 10, correct_rate=0.75, grade_after=False)
        take_batch(by_title["COE Aptitude Exam 2026-A"], 8, correct_rate=0.55, grade_after=False)

        roster_exam = by_title["Guidance Career Interest Survey"]
        assigned = student_pool[:5]
        for student in assigned:
            ExamAssignment.objects.get_or_create(
                exam=roster_exam, user=student,
                defaults={"status": ExamAssignment.Status.ELIGIBLE},
            )
        take_batch(roster_exam, 5, correct_rate=0.6, grade_after=False)

        self.stdout.write(
            f"Ran {sessions_created} exam attempt(s) through the real session services "
            f"({graded} pending-review session(s) graded to completion)."
        )
