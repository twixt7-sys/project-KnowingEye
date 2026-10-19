"""Exam-integrity report: who was flagged, on which exam, and why.

A session is *flagged* when monitoring raised at least one alert on it or a
proctor terminated it. A candidate is flagged when any of their sessions is,
and is counted once per scope (overall, or per exam) however many attempts
they flagged on. This is the same definition ``report_summary`` uses for its
headline tiles, so the numbers agree.
"""

from __future__ import annotations

from collections import defaultdict

from django.db.models import Count, Exists, OuterRef, Q

from features.behavior.models import Alert
from features.session.models import ExamSession

FLAGGED = Q(status=ExamSession.Status.TERMINATED) | Q(_has_alert=True)

# Session rows listed in the drill-down before it is cut off.
DRILLDOWN_LIMIT = 500


def with_flag(sessions):
    """Annotate each session with ``_has_alert`` (the flag test needs it)."""
    return sessions.annotate(
        _has_alert=Exists(Alert.objects.filter(session=OuterRef("pk")))
    )


def _scoped(sessions, *, exam_id=None, department_id=None, school_year=None):
    """Sessions that actually ran (not SETUP), narrowed by the optional filters."""
    from features.reports.school_year import annotate_school_year

    qs = sessions.exclude(status=ExamSession.Status.SETUP)
    if exam_id:
        qs = qs.filter(exam_id=exam_id)
    if department_id:
        qs = qs.filter(exam__department_id=department_id)
    if school_year is not None:
        qs = annotate_school_year(qs).filter(school_year=school_year)
    return qs


def _alert_rollup(alerts):
    """Total / unresolved / by-type / by-severity for an Alert queryset."""
    by_type = {
        r["alert_type"]: r["n"]
        for r in alerts.values("alert_type").annotate(n=Count("id")).order_by("-n")
    }
    by_severity = {
        r["severity"]: r["n"] for r in alerts.values("severity").annotate(n=Count("id"))
    }
    return {
        "alert_count": sum(by_type.values()),
        "unresolved_alerts": alerts.filter(resolved=False).count(),
        "alerts_by_type": by_type,
        "alerts_by_severity": by_severity,
    }


def _rate(part: int, whole: int) -> float | None:
    return round(part / whole * 100.0, 1) if whole else None


def integrity_report(sessions, **filters) -> dict:
    """Overall integrity totals plus a per-exam breakdown."""
    qs = with_flag(_scoped(sessions, **filters))

    totals_row = qs.aggregate(
        sessions=Count("id"),
        candidates=Count("user_id", distinct=True),
        flagged_sessions=Count("id", filter=FLAGGED),
        flagged_candidates=Count("user_id", distinct=True, filter=FLAGGED),
        terminated_sessions=Count("id", filter=Q(status=ExamSession.Status.TERMINATED)),
    )
    session_ids = qs.values("pk")
    alerts = Alert.objects.filter(session_id__in=session_ids)
    totals = {
        **totals_row,
        "candidate_flag_rate": _rate(
            totals_row["flagged_candidates"], totals_row["candidates"]
        ),
        **_alert_rollup(alerts),
    }

    exam_rows = list(
        qs.values(
            "exam_id",
            "exam__title",
            "exam__department_id",
            "exam__department__name",
            "exam__department__abbreviation",
        )
        .annotate(
            sessions=Count("id"),
            candidates=Count("user_id", distinct=True),
            flagged_sessions=Count("id", filter=FLAGGED),
            flagged_candidates=Count("user_id", distinct=True, filter=FLAGGED),
            terminated_sessions=Count(
                "id", filter=Q(status=ExamSession.Status.TERMINATED)
            ),
        )
        .order_by("-flagged_candidates", "exam__title")
    )

    # One grouped query for every exam's alerts rather than one per exam.
    per_exam: dict[int, dict] = defaultdict(
        lambda: {
            "alert_count": 0,
            "unresolved_alerts": 0,
            "alerts_by_type": {},
            "alerts_by_severity": {},
        }
    )
    grouped = alerts.values(
        "session__exam_id", "alert_type", "severity", "resolved"
    ).annotate(n=Count("id"))
    for r in grouped:
        bucket = per_exam[r["session__exam_id"]]
        bucket["alert_count"] += r["n"]
        if not r["resolved"]:
            bucket["unresolved_alerts"] += r["n"]
        types = bucket["alerts_by_type"]
        types[r["alert_type"]] = types.get(r["alert_type"], 0) + r["n"]
        sev = bucket["alerts_by_severity"]
        sev[r["severity"]] = sev.get(r["severity"], 0) + r["n"]

    by_exam = [
        {
            "exam_id": r["exam_id"],
            "exam_title": r["exam__title"],
            "department_id": r["exam__department_id"],
            "department_name": r["exam__department__name"],
            "department_abbreviation": r["exam__department__abbreviation"],
            "sessions": r["sessions"],
            "candidates": r["candidates"],
            "flagged_sessions": r["flagged_sessions"],
            "flagged_candidates": r["flagged_candidates"],
            "candidate_flag_rate": _rate(r["flagged_candidates"], r["candidates"]),
            "terminated_sessions": r["terminated_sessions"],
            **per_exam[r["exam_id"]],
        }
        for r in exam_rows
    ]
    return {"totals": totals, "by_exam": by_exam}


def flagged_session_rows(
    sessions, *, limit: int = DRILLDOWN_LIMIT, **filters
) -> tuple[list[dict], bool]:
    """Flagged sessions (newest first) with their alerts attached.

    Returns ``(rows, truncated)``. Each row is a plain dict ready for JSON, CSV
    or PDF; ``alerts`` is oldest-first so it reads as a timeline.
    """
    from features.reports.views import _seat_labels_for

    qs = (
        with_flag(_scoped(sessions, **filters))
        .filter(FLAGGED)
        .select_related("exam", "exam__department", "user")
        .order_by("-started_at", "id")
    )
    page = list(qs[: limit + 1])
    truncated = len(page) > limit
    page = page[:limit]

    alerts_by_session: dict = defaultdict(list)
    alert_qs = Alert.objects.filter(session_id__in=[s.pk for s in page]).order_by(
        "created_at"
    )
    for a in alert_qs:
        alerts_by_session[a.session_id].append(
            {
                "id": str(a.id),
                "alert_type": a.alert_type,
                "severity": a.severity,
                "message": a.message,
                "metric_pct": a.metric_pct,
                "resolved": a.resolved,
                "created_at": a.created_at,
            }
        )

    seats = _seat_labels_for(page)
    rows = []
    for s in page:
        alerts = alerts_by_session.get(s.pk, [])
        rows.append(
            {
                "session_id": str(s.id),
                "exam_id": s.exam_id,
                "exam_title": s.exam.title,
                "department_abbreviation": (
                    s.exam.department.abbreviation if s.exam.department_id else None
                ),
                "user_id": s.user_id,
                "username": s.user.username,
                "full_name": f"{s.user.first_name} {s.user.last_name}".strip(),
                "seat_label": seats.get((s.exam_id, s.user_id)),
                "status": s.status,
                "terminated": s.status == ExamSession.Status.TERMINATED,
                "started_at": s.started_at,
                "submitted_at": s.submitted_at,
                "percentage_score": (
                    float(s.percentage_score) if s.percentage_score is not None else None
                ),
                "ebi_average": (
                    round(float(s.ebi_average), 2) if s.ebi_average is not None else None
                ),
                "alert_count": len(alerts),
                "unresolved_alerts": sum(1 for a in alerts if not a["resolved"]),
                "alerts": alerts,
            }
        )
    return rows, truncated
