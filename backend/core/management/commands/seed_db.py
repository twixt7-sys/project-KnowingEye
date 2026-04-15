import ast
import csv
from datetime import datetime
from pathlib import Path
from uuid import UUID

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from features.exams.models import Exam, Question
from features.session.models import ExamSession, Response


class Command(BaseCommand):
    help = 'Seed the database from CSV files.'

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
        data_dir = self.get_data_dir()

        if options['flush']:
            self.flush_data()
            return

        if not options['noinput']:
            confirm = input(
                'This will seed the database from CSV files in backend/seed_data. Continue? [y/N]: '
            ).strip().lower()
            if confirm not in ('y', 'yes'):
                self.stdout.write(self.style.WARNING('Seed aborted by user.'))
                return

        with transaction.atomic():
            self.load_users(data_dir)
            self.load_exams(data_dir)
            self.load_questions(data_dir)
            self.load_sessions(data_dir)
            self.load_responses(data_dir)

        self.stdout.write(self.style.SUCCESS('CSV seeding complete.'))

    def get_data_dir(self):
        return Path(__file__).resolve().parents[3] / 'seed_data'

    def load_users(self, data_dir):
        path = data_dir / 'users.csv'
        with path.open(newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                user_id = int(row['id'])
                username = row['username']
                email = row['email']
                defaults = {
                    'username': username,
                    'email': email,
                    'first_name': row['first_name'],
                    'last_name': row['last_name'],
                    'role': row['role'],
                    'is_active': self.parse_bool(row['is_active']),
                }

                user = self.user_model.objects.filter(username=username).first()
                if user is None:
                    user = self.user_model.objects.filter(email=email).first()
                if user is None:
                    user = self.user_model.objects.filter(id=user_id).first()

                if user is None:
                    user = self.user_model(id=user_id, **defaults)
                    user.set_password(row.get('raw_password', 'password'))
                    user.save()
                    self.stdout.write(f'Created user {user.username}.')
                    continue

                updated = False
                for field, value in defaults.items():
                    if getattr(user, field) != value:
                        setattr(user, field, value)
                        updated = True

                if updated:
                    user.save(update_fields=list(defaults.keys()))
                    self.stdout.write(f'Updated user {user.username}.')

                if row.get('raw_password') and not user.has_usable_password():
                    user.set_password(row['raw_password'])
                    user.save(update_fields=['password'])
                    self.stdout.write(f'Set password for user {user.username}.')

    def load_exams(self, data_dir):
        path = data_dir / 'exams.csv'
        with path.open(newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                defaults = {
                    'title': row['title'],
                    'description': row['description'],
                    'instructions': row['instructions'],
                    'duration_minutes': self.parse_int(row['duration_minutes']),
                    'total_questions': self.parse_int(row['total_questions']),
                    'passing_score': self.parse_int(row['passing_score']),
                    'status': row['status'],
                    'created_by_id': self.parse_int(row['created_by_id']),
                }
                exam, created = Exam.objects.get_or_create(
                    id=self.parse_int(row['id']),
                    defaults=defaults,
                )
                if created:
                    exam.save()
                    self.stdout.write(f'Created exam {exam.title}.')
                else:
                    updated = False
                    for field, value in defaults.items():
                        if getattr(exam, field) != value:
                            setattr(exam, field, value)
                            updated = True
                    if updated:
                        exam.save(update_fields=list(defaults.keys()))
                        self.stdout.write(f'Updated exam {exam.title}.')

    def load_questions(self, data_dir):
        path = data_dir / 'questions.csv'
        with path.open(newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                defaults = {
                    'exam_id': self.parse_int(row['exam_id']),
                    'question_text': row['question_text'],
                    'question_type': row['question_type'],
                    'options': self.parse_json_field(row['options']),
                    'correct_answer': row['correct_answer'],
                    'points': self.parse_int(row['points']),
                    'order': self.parse_int(row['order']),
                }
                question, created = Question.objects.get_or_create(
                    id=self.parse_int(row['id']),
                    defaults=defaults,
                )
                if created:
                    question.save()
                    self.stdout.write(f'Created question {question.id}.')
                else:
                    updated = False
                    for field, value in defaults.items():
                        if getattr(question, field) != value:
                            setattr(question, field, value)
                            updated = True
                    if updated:
                        question.save(update_fields=list(defaults.keys()))
                        self.stdout.write(f'Updated question {question.id}.')

    def load_sessions(self, data_dir):
        path = data_dir / 'exam_sessions.csv'
        with path.open(newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                defaults = {
                    'exam_id': self.parse_int(row['exam_id']),
                    'user_id': self.parse_int(row['user_id']),
                    'started_at': self.parse_datetime(row['started_at']),
                    'submitted_at': self.parse_datetime(row['submitted_at']),
                    'time_remaining': self.parse_int(row['time_remaining']),
                    'status': row['status'],
                    'ip_address': row['ip_address'] or None,
                    'user_agent': row['user_agent'] or None,
                    'total_score': self.parse_int(row['total_score']),
                    'percentage_score': self.parse_decimal(row['percentage_score']),
                    'passed': self.parse_bool(row['passed']),
                }
                session_id = UUID(row['id'])
                session, created = ExamSession.objects.get_or_create(
                    id=session_id,
                    defaults=defaults,
                )
                if created:
                    session.save()
                    self.stdout.write(f'Created session {session.id}.')
                else:
                    updated = False
                    for field, value in defaults.items():
                        if getattr(session, field) != value:
                            setattr(session, field, value)
                            updated = True
                    if updated:
                        session.save(update_fields=list(defaults.keys()))
                        self.stdout.write(f'Updated session {session.id}.')

    def load_responses(self, data_dir):
        path = data_dir / 'responses.csv'
        with path.open(newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                defaults = {
                    'session_id': UUID(row['session_id']),
                    'question_id': self.parse_int(row['question_id']),
                    'answer_text': row['answer_text'],
                    'is_correct': self.parse_bool(row['is_correct']),
                    'time_spent': self.parse_int(row['time_spent']),
                    'answered_at': self.parse_datetime(row['answered_at']),
                    'flagged_for_review': self.parse_bool(row['flagged_for_review']),
                }
                response, created = Response.objects.get_or_create(
                    id=self.parse_int(row['id']),
                    defaults=defaults,
                )
                if created:
                    response.save()
                    self.stdout.write(f'Created response {response.id}.')
                else:
                    updated = False
                    for field, value in defaults.items():
                        if getattr(response, field) != value:
                            setattr(response, field, value)
                            updated = True
                    if updated:
                        response.save(update_fields=list(defaults.keys()))
                        self.stdout.write(f'Updated response {response.id}.')

    def flush_data(self):
        data_dir = self.get_data_dir()
        self.stdout.write('Removing seeded CSV test data...')

        response_ids = self.read_csv_ids(data_dir / 'responses.csv', id_field='id', cls=int)
        session_ids = self.read_csv_ids(data_dir / 'exam_sessions.csv', id_field='id', cls=UUID)
        question_ids = self.read_csv_ids(data_dir / 'questions.csv', id_field='id', cls=int)
        exam_ids = self.read_csv_ids(data_dir / 'exams.csv', id_field='id', cls=int)
        user_ids = self.read_csv_ids(data_dir / 'users.csv', id_field='id', cls=int)

        if response_ids:
            Response.objects.filter(id__in=response_ids).delete()
        if session_ids:
            ExamSession.objects.filter(id__in=session_ids).delete()
        if question_ids:
            Question.objects.filter(id__in=question_ids).delete()
        if exam_ids:
            Exam.objects.filter(id__in=exam_ids).delete()
        if user_ids:
            self.user_model.objects.filter(id__in=user_ids).delete()

        self.stdout.write(self.style.SUCCESS('Seeded CSV data removed.'))

    def read_csv_ids(self, csv_path, id_field='id', cls=int):
        ids = []
        with csv_path.open(newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                value = row.get(id_field)
                if value:
                    ids.append(cls(value))
        return ids

    def parse_bool(self, value):
        if value is None:
            return False
        return str(value).strip().lower() in ('1', 'true', 'yes', 'y', 't')

    def parse_int(self, value):
        if value is None or value == '':
            return None
        return int(value)

    def parse_decimal(self, value):
        if value is None or value == '':
            return None
        return float(value)

    def parse_datetime(self, value):
        if not value:
            return None
        dt = datetime.fromisoformat(value)
        if settings.USE_TZ and timezone.is_naive(dt):
            return timezone.make_aware(dt, timezone.get_current_timezone())
        return dt

    def parse_json_field(self, value):
        if not value:
            return []
        try:
            parsed = ast.literal_eval(value)
            return parsed if isinstance(parsed, list) else []
        except (ValueError, SyntaxError):
            return []
