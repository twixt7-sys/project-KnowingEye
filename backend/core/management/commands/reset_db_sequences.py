"""Reset PostgreSQL ID sequences after explicit-ID inserts (e.g. seed_db)."""

from django.apps import apps
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Reset PostgreSQL primary-key sequences to match current MAX(id) values."

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            self.stdout.write(self.style.WARNING("Skipped: only needed for PostgreSQL."))
            return

        models = [
            apps.get_model("authentication", "User"),
            apps.get_model("exams", "Exam"),
            apps.get_model("exams", "Question"),
            apps.get_model("exam_sessions", "Response"),
        ]

        with connection.cursor() as cursor:
            for model in models:
                table = model._meta.db_table
                pk_col = model._meta.pk.column
                cursor.execute(
                    f"""
                    SELECT setval(
                        pg_get_serial_sequence(%s, %s),
                        COALESCE((SELECT MAX({pk_col}) FROM {table}), 1),
                        true
                    )
                    """,
                    [table, pk_col],
                )
                seq_val = cursor.fetchone()[0]
                self.stdout.write(f"{table}.{pk_col} sequence -> {seq_val}")

        self.stdout.write(self.style.SUCCESS("Sequences reset."))
