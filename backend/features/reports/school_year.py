"""School-year grouping for reports.

There is no school-year column anywhere in the data model: a session belongs
to the academic year its ``submitted_at`` falls in. The year starts on
``settings.SCHOOL_YEAR_START_MONTH`` (default June), so with the default a
session submitted on 2026-03-02 is in school year 2025-2026 and one submitted
on 2026-06-01 is in 2026-2027. ``start_year`` (2025 for "2025-2026") is the
identifier used on the wire.
"""

from __future__ import annotations

from datetime import date

from django.conf import settings
from django.db.models import Case, F, IntegerField, Q, Value, When
from django.db.models.functions import ExtractMonth, ExtractYear


def start_month() -> int:
    """Configured first month of the school year, clamped to 1-12."""
    try:
        month = int(getattr(settings, "SCHOOL_YEAR_START_MONTH", 6))
    except (TypeError, ValueError):
        return 6
    return min(max(month, 1), 12)


def school_year_label(year_start: int, month: int | None = None) -> str:
    """"2025-2026" for a year that begins in 2025 (just "2025" when it starts in January)."""
    month = month or start_month()
    return str(year_start) if month == 1 else f"{year_start}-{year_start + 1}"


def school_year_period(year_start: int, month: int | None = None) -> tuple[date, date]:
    """First and last calendar day of the school year starting in ``year_start``."""
    month = month or start_month()
    first = date(year_start, month, 1)
    next_first = date(year_start + 1, month, 1)
    return first, date.fromordinal(next_first.toordinal() - 1)


def school_year_of(moment, month: int | None = None) -> int:
    """Start year of the school year containing ``moment`` (a date or datetime)."""
    month = month or start_month()
    return moment.year - (1 if moment.month < month else 0)


def annotate_school_year(qs, *, field: str = "submitted_at", month: int | None = None):
    """Annotate ``school_year`` (the start year, int) from a datetime ``field``.

    Rows whose field is NULL (e.g. a session still running) get NULL, so
    callers can drop them with ``school_year__isnull=False``.
    """
    month = month or start_month()
    return qs.annotate(
        _sy_year=ExtractYear(field),
        _sy_month=ExtractMonth(field),
    ).annotate(
        school_year=Case(
            When(**{f"{field}__isnull": True}, then=Value(None)),
            When(_sy_month__lt=month, then=F("_sy_year") - 1),
            default=F("_sy_year"),
            output_field=IntegerField(),
        )
    )


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

# Sessions that reached the end of their life (submitted/graded or terminated)
# and so carry a submitted_at to place them in a school year.
_FINISHED = ("completed", "pending_review", "terminated")


def _metric_aggregates():
    """Aggregates shared by the per-year and per-exam/department breakdowns."""
    from django.db.models import Avg, Count

    from features.reports.integrity import FLAGGED

    completed = Q(status="completed")
    return {
        "sessions": Count("id"),
        "completed_sessions": Count("id", filter=completed),
        "passed_count": Count("id", filter=completed & Q(passed=True)),
        "average_score": Avg("percentage_score", filter=completed),
        "average_ebi": Avg("ebi_average", filter=Q(ebi_average__isnull=False)),
        "examinees": Count("user_id", distinct=True),
        "flagged_sessions": Count("id", filter=FLAGGED),
        "flagged_candidates": Count("user_id", distinct=True, filter=FLAGGED),
    }


def _shape(row: dict) -> dict:
    done = row["completed_sessions"] or 0
    return {
        "sessions": row["sessions"],
        "completed_sessions": done,
        "examinees": row["examinees"],
        "pass_rate": round(row["passed_count"] / done * 100.0, 1) if done else None,
        "average_score": (
            round(float(row["average_score"]), 1) if row["average_score"] is not None else None
        ),
        "average_ebi": (
            round(float(row["average_ebi"]), 2) if row["average_ebi"] is not None else None
        ),
        "flagged_sessions": row["flagged_sessions"],
        "flagged_candidates": row["flagged_candidates"],
        "flagged_rate": (
            round(row["flagged_sessions"] / row["sessions"] * 100.0, 1)
            if row["sessions"]
            else None
        ),
    }


def _population(sessions):
    from features.reports.integrity import with_flag

    return with_flag(
        annotate_school_year(sessions.filter(status__in=_FINISHED, submitted_at__isnull=False))
    )


def school_year_metrics(sessions) -> dict:
    """Per-school-year pass rate, average score, EBI and flagged rate.

    Only years with at least one completed session are returned (a year of
    nothing but terminated sessions has no pass data to review). Oldest first.
    ``flagged_rate`` is flagged sessions / finished sessions in the year.
    """
    from django.db.models import Count

    month = start_month()
    pop = _population(sessions)
    rows = (
        pop.values("school_year")
        .annotate(**_metric_aggregates(), exams=Count("exam_id", distinct=True))
        .order_by("school_year")
    )
    years = []
    for row in rows:
        if not row["completed_sessions"]:
            continue
        first, last = school_year_period(row["school_year"], month)
        years.append(
            {
                "school_year": school_year_label(row["school_year"], month),
                "start_year": row["school_year"],
                "period_start": first.isoformat(),
                "period_end": last.isoformat(),
                "exams": row["exams"],
                **_shape(row),
            }
        )
    return {"start_month": month, "years": years}


def school_year_breakdown(sessions, start_year: int) -> dict:
    """Drill-down for one school year: the same metrics per exam and per department."""
    month = start_month()
    pop = _population(sessions).filter(school_year=start_year)

    by_exam = [
        {
            "exam_id": r["exam_id"],
            "exam_title": r["exam__title"],
            "department_abbreviation": r["exam__department__abbreviation"],
            **_shape(r),
        }
        for r in pop.values("exam_id", "exam__title", "exam__department__abbreviation")
        .annotate(**_metric_aggregates())
        .order_by("exam__title")
        if r["completed_sessions"]
    ]
    by_department = [
        {
            "department_id": r["exam__department_id"],
            "department_name": r["exam__department__name"] or "Unassigned",
            "department_abbreviation": r["exam__department__abbreviation"] or "—",
            **_shape(r),
        }
        for r in pop.values(
            "exam__department_id", "exam__department__name", "exam__department__abbreviation"
        )
        .annotate(**_metric_aggregates())
        .order_by("exam__department__name")
        if r["completed_sessions"]
    ]
    return {
        "school_year": school_year_label(start_year, month),
        "start_year": start_year,
        "by_exam": by_exam,
        "by_department": by_department,
    }
