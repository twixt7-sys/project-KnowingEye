from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from features.exams.models import Exam, Question
from features.session.models import ExamSession, Response


class Command(BaseCommand):
    help = 'Seed the database with sample users, exam data, and a sample exam session.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--flush',
            action='store_true',
            help='Remove seeded test data before exiting.',
        )
        parser.add_argument(
            '--noinput',
            action='store_true',
            help='Run without confirmation prompts.',
        )

    def handle(self, *args, **options):
        self.user_model = get_user_model()

        if options['flush']:
            self.flush_data()
            return

        if not options['noinput']:
            confirm = input(
                'This will create sample users, exam, questions, and a demo session. Continue? [y/N]: '
            ).strip().lower()
            if confirm not in ('y', 'yes'):
                self.stdout.write(self.style.WARNING('Seed aborted by user.'))
                return

        with transaction.atomic():
            admin = self.create_admin_user()
            student = self.create_student_user()
            exam = self.create_demo_exam(admin)
            self.create_questions(exam)
            session = self.create_demo_session(exam, student)
            self.create_demo_responses(session)
            session.submit_session(time_remaining=exam.duration_minutes * 60)

        self.stdout.write(self.style.SUCCESS('Database seeding complete.'))
        self.stdout.write('Admin user: admin@example.com / adminpass')
        self.stdout.write('Student user: student@example.com / studentpass')

    def create_admin_user(self):
        admin, created = self.user_model.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@example.com',
                'first_name': 'Admin',
                'last_name': 'User',
                'role': self.user_model.Role.ADMIN,
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
            },
        )
        if created:
            admin.set_password('adminpass')
            admin.save()
            self.stdout.write('Created admin user.')
        else:
            self.stdout.write('Admin user already exists.')
        return admin

    def create_student_user(self):
        student, created = self.user_model.objects.get_or_create(
            username='student',
            defaults={
                'email': 'student@example.com',
                'first_name': 'Test',
                'last_name': 'Student',
                'role': self.user_model.Role.EXAMINEE,
                'is_active': True,
            },
        )
        if created:
            student.set_password('studentpass')
            student.save()
            self.stdout.write('Created student user.')
        else:
            self.stdout.write('Student user already exists.')
        return student

    def create_demo_exam(self, admin):
        exam, created = Exam.objects.get_or_create(
            title='Demo Exam - Knowing Eye',
            defaults={
                'description': 'A sample exam for local testing.',
                'instructions': 'Answer all questions to the best of your ability.',
                'duration_minutes': 30,
                'passing_score': 50,
                'status': Exam.Status.ACTIVE,
                'created_by': admin,
            },
        )
        if created:
            self.stdout.write('Created demo exam.')
        else:
            self.stdout.write('Demo exam already exists.')
        return exam

    def create_questions(self, exam):
        sample_questions = [
            {
                'order': 1,
                'question_text': 'What color is the sky on a clear day?',
                'question_type': Question.QuestionType.MULTIPLE_CHOICE,
                'options': ['Blue', 'Green', 'Red', 'Yellow'],
                'correct_answer': 'Blue',
                'points': 1,
            },
            {
                'order': 2,
                'question_text': 'True or false: The sun rises in the west.',
                'question_type': Question.QuestionType.TRUE_FALSE,
                'options': [],
                'correct_answer': 'false',
                'points': 1,
            },
            {
                'order': 3,
                'question_text': 'Name one feature of the Knowing Eye test environment.',
                'question_type': Question.QuestionType.SHORT_ANSWER,
                'options': [],
                'correct_answer': 'monitoring',
                'points': 1,
            },
        ]

        for item in sample_questions:
            question, created = Question.objects.get_or_create(
                exam=exam,
                order=item['order'],
                defaults={
                    'question_text': item['question_text'],
                    'question_type': item['question_type'],
                    'options': item['options'],
                    'correct_answer': item['correct_answer'],
                    'points': item['points'],
                },
            )
            if created:
                self.stdout.write(f"Created question {item['order']}.")
            else:
                self.stdout.write(f"Question {item['order']} already exists.")

        exam.update_question_count()

    def create_demo_session(self, exam, student):
        session, created = ExamSession.objects.get_or_create(
            exam=exam,
            user=student,
            defaults={
                'started_at': timezone.now(),
                'status': ExamSession.Status.IN_PROGRESS,
                'time_remaining': exam.duration_minutes * 60,
            },
        )
        if created:
            self.stdout.write('Created demo exam session.')
        else:
            self.stdout.write('Demo exam session already exists.')
        return session

    def create_demo_responses(self, session):
        answers = {
            1: 'Blue',
            2: 'false',
            3: 'monitoring',
        }
        for question in session.exam.questions.all().order_by('order'):
            response, created = Response.objects.get_or_create(
                session=session,
                question=question,
                defaults={
                    'answer_text': answers.get(question.order, ''),
                    'time_spent': 15,
                },
            )
            if created:
                self.stdout.write(f'Created response for question {question.order}.')
            else:
                response.answer_text = answers.get(question.order, '')
                response.time_spent = 15
                response.save()
                self.stdout.write(f'Updated response for question {question.order}.')

    def flush_data(self):
        self.stdout.write('Removing seeded test data...')
        Response.objects.filter(session__exam__title='Demo Exam - Knowing Eye').delete()
        ExamSession.objects.filter(exam__title='Demo Exam - Knowing Eye').delete()
        Question.objects.filter(exam__title='Demo Exam - Knowing Eye').delete()
        Exam.objects.filter(title='Demo Exam - Knowing Eye').delete()
        self.user_model.objects.filter(username__in=['admin', 'student']).delete()
        self.stdout.write(self.style.SUCCESS('Seeded test data removed.'))
