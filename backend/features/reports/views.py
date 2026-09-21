"""Reporting endpoints - dashboard summary, session reports, CSV export."""

from __future__ import annotations

import csv
from io import BytesIO, StringIO

from django.db.models import Avg, Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.utils.constants import MAX_REPORT_EXPORT_ROWS

from core.pagination import StandardResultsPagination
from features.behavior.models import Alert, BehaviorLog
from features.exams.models import ExamAssignment
from features.session.models import ExamSession
from features.session.serializers import ExamSessionDetailSerializer


def _session_queryset(user):
    from core.security import service as security

    qs = ExamSession.objects.select_related("exam", "exam__department", "user")
    if security.has_module(user, "reports"):
        return qs
    return qs.filter(user=user)


def _annotate_sessions(qs):
    return qs.annotate(
        _alert_count=Count("alerts", distinct=True),
        _behavior_count=Count("behavior_logs", distinct=True),
        _unresolved=Count("alerts", filter=Q(alerts__resolved=False), distinct=True),
    )


def _department_analytics(sessions):
    """Aggregate completed-session KPIs grouped by exam department.

    Run as two separate GROUP BY queries rather than one combined
    ``.annotate()``: mixing the plain per-session ``Count("id")``/``Avg(...)``
    with a to-many join on ``alerts`` in a single query fans the join out
    (a completed session with N alerts contributes N duplicate rows), which
    silently inflates ``completed_sessions``/``passed_count`` and skews both
    averages toward sessions with more alerts. Keeping the alert count in
    its own query avoids that join entirely for the session-level query.
    """
    completed = sessions.filter(status=ExamSession.Status.COMPLETED)

    stats_rows = (
        completed.values(
            "exam__department_id",
            "exam__department__name",
            "exam__department__abbreviation",
        )
        .annotate(
            completed_sessions=Count("id"),
            average_score=Avg("percentage_score"),
            passed_count=Count("id", filter=Q(passed=True)),
            average_ebi=Avg("ebi_average", filter=Q(ebi_average__isnull=False)),
        )
        .order_by("exam__department__name")
    )

    alert_counts = {
        row["exam__department_id"]: row["alert_count"]
        for row in completed.values("exam__department_id").annotate(
            alert_count=Count("alerts", distinct=True)
        )
    }

    result = []
    for row in stats_rows:
        completed_count = row["completed_sessions"] or 0
        dept_id = row["exam__department_id"]
        result.append(
            {
                "department_id": dept_id,
                "department_name": row["exam__department__name"] or "Unassigned",
                "department_abbreviation": row["exam__department__abbreviation"] or "—",
                "completed_sessions": completed_count,
                "average_score": (
                    float(row["average_score"]) if row["average_score"] is not None else None
                ),
                "pass_rate": (
                    row["passed_count"] / completed_count * 100.0 if completed_count else None
                ),
                "alert_count": alert_counts.get(dept_id, 0),
                "average_ebi": (
                    round(float(row["average_ebi"]), 2)
                    if row["average_ebi"] is not None
                    else None
                ),
            }
        )
    return result


def _seat_labels_for(sessions: list) -> dict[tuple[int, int], str]:
    """Exam+user -> seat_label lookup (Directive Area 04 - "proctor locator").

    A flagged examinee needs to be findable physically, not just as a list
    row - see ExamAssignment.seat_label and its CSV-roster-import column.
    """
    pairs = {(s.exam_id, s.user_id) for s in sessions}
    if not pairs:
        return {}
    assignments = ExamAssignment.objects.filter(
        exam_id__in={p[0] for p in pairs},
        user_id__in={p[1] for p in pairs},
    ).exclude(seat_label="")
    return {(a.exam_id, a.user_id): a.seat_label for a in assignments}


def _serialize_session_rows(sessions):
    sessions = list(sessions)
    seat_labels = _seat_labels_for(sessions)
    return [
        {
            "id": str(s.id),
            "exam_id": s.exam_id,
            "exam_title": s.exam.title,
            "department_id": s.exam.department_id,
            "department_name": (
                s.exam.department.name if s.exam.department_id else None
            ),
            "department_abbreviation": (
                s.exam.department.abbreviation if s.exam.department_id else None
            ),
            "user": s.user.username,
            "user_full_name": f"{s.user.first_name} {s.user.last_name}".strip(),
            "seat_label": seat_labels.get((s.exam_id, s.user_id)),
            "status": s.status,
            "started_at": s.started_at,
            "submitted_at": s.submitted_at,
            "percentage_score": (
                float(s.percentage_score) if s.percentage_score is not None else None
            ),
            "passed": s.passed,
            "alert_count": s._alert_count,
            "unresolved_alert_count": s._unresolved,
            "behavior_event_count": s._behavior_count,
            "ebi_average": (
                round(float(s.ebi_average), 2) if s.ebi_average is not None else None
            ),
            "ebi_sample_count": s.ebi_sample_count,
        }
        for s in sessions
    ]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def report_summary(request):
    """GET /api/reports/summary/ - dashboard KPIs for admins/examinees."""
    sessions = _session_queryset(request.user)
    completed = sessions.filter(status=ExamSession.Status.COMPLETED)
    active = sessions.filter(status=ExamSession.Status.IN_PROGRESS)
    terminated = sessions.filter(status=ExamSession.Status.TERMINATED)

    alert_qs = Alert.objects.filter(session__in=sessions)
    behavior_qs = BehaviorLog.objects.filter(session__in=sessions)

    by_severity = list(
        alert_qs.values("severity").annotate(count=Count("id")).order_by("severity")
    )
    by_event = list(
        behavior_qs.values("event_type").annotate(count=Count("id")).order_by("-count")
    )

    completed_count = completed.count()
    monitored = sessions.filter(ebi_average__isnull=False)
    ebi_stats = monitored.aggregate(avg=Avg("ebi_average"), n=Count("id"))
    return Response(
        {
            "total_sessions": sessions.count(),
            "active_sessions": active.count(),
            "completed_sessions": completed_count,
            "terminated_sessions": terminated.count(),
            "unresolved_alerts": alert_qs.filter(resolved=False).count(),
            "resolved_alerts": alert_qs.filter(resolved=True).count(),
            "behavior_events": behavior_qs.count(),
            "average_ebi": (
                round(float(ebi_stats["avg"]), 2) if ebi_stats["avg"] is not None else None
            ),
            "ebi_session_count": ebi_stats["n"] or 0,
            "average_score": completed.aggregate(avg=Avg("percentage_score"))["avg"],
            "pass_rate": completed.filter(passed=True).count() / completed_count * 100.0
            if completed_count
            else None,
            "alerts_by_severity": by_severity,
            "events_by_type": by_event,
            "by_department": _department_analytics(sessions),
            "generated_at": timezone.now().isoformat(),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def session_report(request, session_id):
    """GET /api/reports/sessions/<uuid>/ - exhaustive session report."""
    try:
        session = _session_queryset(request.user).get(pk=session_id)
    except ExamSession.DoesNotExist:
        return Response({"detail": "Session not found."}, status=404)

    behavior_summary = (
        BehaviorLog.objects.filter(session=session)
        .values("event_type")
        .annotate(count=Count("id"), avg_score=Avg("score"))
        .order_by("-count")
    )

    exam = session.exam
    department = exam.department
    exam_completed = ExamSession.objects.filter(
        exam=exam,
        status=ExamSession.Status.COMPLETED,
        percentage_score__isnull=False,
    )
    exam_stats = exam_completed.aggregate(
        average_score=Avg("percentage_score"),
        completed_sessions=Count("id"),
        passed_count=Count("id", filter=Q(passed=True)),
    )
    exam_completed_count = exam_stats["completed_sessions"] or 0

    department_analytics = None
    if department is not None:
        dept_completed = ExamSession.objects.filter(
            exam__department=department,
            status=ExamSession.Status.COMPLETED,
            percentage_score__isnull=False,
        )
        dept_stats = dept_completed.aggregate(
            average_score=Avg("percentage_score"),
            completed_sessions=Count("id"),
            passed_count=Count("id", filter=Q(passed=True)),
        )
        dept_completed_count = dept_stats["completed_sessions"] or 0
        your_score = (
            float(session.percentage_score) if session.percentage_score is not None else None
        )
        below_you = (
            dept_completed.filter(percentage_score__lt=your_score).count()
            if your_score is not None
            else 0
        )
        department_analytics = {
            "department_id": department.id,
            "department_name": department.name,
            "department_abbreviation": department.abbreviation,
            "exam_average_score": (
                float(exam_stats["average_score"])
                if exam_stats["average_score"] is not None
                else None
            ),
            "exam_pass_rate": (
                exam_stats["passed_count"] / exam_completed_count * 100.0
                if exam_completed_count
                else None
            ),
            "exam_completed_sessions": exam_completed_count,
            "department_average_score": (
                float(dept_stats["average_score"])
                if dept_stats["average_score"] is not None
                else None
            ),
            "department_pass_rate": (
                dept_stats["passed_count"] / dept_completed_count * 100.0
                if dept_completed_count
                else None
            ),
            "department_completed_sessions": dept_completed_count,
            "score_vs_department_avg": (
                your_score - float(dept_stats["average_score"])
                if your_score is not None and dept_stats["average_score"] is not None
                else None
            ),
            "percentile_in_department": (
                round(below_you / dept_completed_count * 100.0, 1)
                if your_score is not None and dept_completed_count
                else None
            ),
        }

    exam_behavior_index = {
        "average": (
            round(float(session.ebi_average), 2) if session.ebi_average is not None else None
        ),
        "sample_count": session.ebi_sample_count,
        "indicator_count": 4 if session.ebi_identity_sample_count else 3,
        "components": {
            "face_presence": session.ebi_face_presence_avg,
            "face_identity": session.ebi_face_identity_avg,
            "upper_body_presence": session.ebi_upper_body_avg,
            "looking_away_compliance": session.ebi_looking_away_avg,
        },
        "identity_sample_count": session.ebi_identity_sample_count,
        "formula": "EBI = (Fp + Fi + Up + Gc) / N",
    }

    return Response(
        {
            "session": ExamSessionDetailSerializer(
                session, context={"request": request}
            ).data,
            "exam_behavior_index": exam_behavior_index,
            "behavior_summary": list(behavior_summary),
            "behavior_logs": list(
                BehaviorLog.objects.filter(session=session)
                .order_by("-timestamp")[:200]
                .values("id", "event_type", "score", "confidence", "metadata", "timestamp")
            ),
            "alerts": list(
                Alert.objects.filter(session=session)
                .order_by("-created_at")
                .values(
                    "id",
                    "alert_type",
                    "severity",
                    "message",
                    "metric_pct",
                    "resolved",
                    "created_at",
                )
            ),
            "department_analytics": department_analytics,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_session_reports(request):
    """GET /api/reports/sessions/ - paginated list with KPI per session."""
    qs = _session_queryset(request.user).order_by("-started_at")

    status_filter = request.query_params.get("status")
    if status_filter:
        qs = qs.filter(status=status_filter)

    exam_id = request.query_params.get("exam")
    if exam_id:
        qs = qs.filter(exam_id=exam_id)

    department_id = request.query_params.get("department")
    if department_id:
        qs = qs.filter(exam__department_id=department_id)

    search = (request.query_params.get("search") or "").strip()
    if search:
        qs = qs.filter(
            Q(user__username__icontains=search)
            | Q(user__first_name__icontains=search)
            | Q(user__last_name__icontains=search)
            | Q(exam__title__icontains=search)
        )

    qs = _annotate_sessions(qs)

    paginator = StandardResultsPagination()
    page = paginator.paginate_queryset(qs, request)
    rows = _serialize_session_rows(page or [])
    return paginator.get_paginated_response(rows)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def export_sessions_csv(request):
    """GET /api/reports/export/csv/ - downloadable CSV of session reports."""
    qs = (
        _annotate_sessions(_session_queryset(request.user))
        .select_related("exam", "user")
        .order_by("-started_at")[:MAX_REPORT_EXPORT_ROWS]
    )

    seat_labels = _seat_labels_for(list(qs))

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "session_id",
            "exam_id",
            "exam_title",
            "username",
            "seat_label",
            "status",
            "started_at",
            "submitted_at",
            "percentage_score",
            "passed",
            "exam_behavior_index",
            "ebi_sample_count",
            "alert_count",
            "unresolved_alerts",
            "behavior_event_count",
        ]
    )

    for s in qs:
        writer.writerow(
            [
                s.id,
                s.exam_id,
                s.exam.title,
                s.user.username,
                seat_labels.get((s.exam_id, s.user_id), ""),
                s.status,
                s.started_at.isoformat() if s.started_at else "",
                s.submitted_at.isoformat() if s.submitted_at else "",
                float(s.percentage_score) if s.percentage_score is not None else "",
                s.passed if s.passed is not None else "",
                round(float(s.ebi_average), 2) if s.ebi_average is not None else "",
                s.ebi_sample_count,
                s._alert_count,
                s._unresolved,
                s._behavior_count,
            ]
        )

    response = HttpResponse(buffer.getvalue(), content_type="text/csv")
    filename = f"knowing-eye-sessions-{timezone.now():%Y%m%d-%H%M%S}.csv"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def export_sessions_pdf(request):
    """GET /api/reports/export/pdf/ - downloadable PDF summary of session reports."""
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    qs = (
        _annotate_sessions(_session_queryset(request.user))
        .select_related("exam", "user")
        .order_by("-started_at")[:MAX_REPORT_EXPORT_ROWS]
    )

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    y = height - 50

    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(50, y, "Knowing Eye - Session Report Export")
    y -= 24
    pdf.setFont("Helvetica", 10)
    pdf.drawString(50, y, f"Generated: {timezone.now():%Y-%m-%d %H:%M UTC}")
    y -= 30

    pdf.setFont("Helvetica-Bold", 9)
    headers = ["Session", "Exam", "User", "Status", "Score", "EBI", "Alerts"]
    col_x = [50, 125, 235, 315, 390, 445, 500]
    for x, label in zip(col_x, headers):
        pdf.drawString(x, y, label)
    y -= 16
    pdf.setFont("Helvetica", 8)

    for session in qs:
        if y < 60:
            pdf.showPage()
            y = height - 50
            pdf.setFont("Helvetica", 8)

        score = (
            f"{float(session.percentage_score):.1f}%"
            if session.percentage_score is not None
            else "-"
        )
        ebi = (
            f"{float(session.ebi_average):.0f}"
            if session.ebi_average is not None
            else "-"
        )
        row = [
            str(session.id)[:8],
            (session.exam.title or "")[:16],
            session.user.username[:12],
            session.status[:11],
            score,
            ebi,
            str(session._alert_count),
        ]
        for x, value in zip(col_x, row):
            pdf.drawString(x, y, value)
        y -= 14

    pdf.save()
    buffer.seek(0)

    response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
    filename = f"knowing-eye-sessions-{timezone.now():%Y%m%d-%H%M%S}.pdf"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_timeseries(request):
    """GET /api/reports/timeseries/ - behaviors and alerts per day (last 30 days)."""
    from django.db.models.functions import TruncDate

    sessions = _session_queryset(request.user)

    sessions_per_day = (
        sessions.annotate(day=TruncDate("started_at"))
        .values("day")
        .annotate(count=Count("id"))
        .order_by("day")
    )

    alerts_per_day = (
        Alert.objects.filter(session__in=sessions)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(count=Count("id"))
        .order_by("day")
    )

    behaviors_per_day = (
        BehaviorLog.objects.filter(session__in=sessions)
        .annotate(day=TruncDate("timestamp"))
        .values("day")
        .annotate(count=Count("id"))
        .order_by("day")
    )

    return Response(
        {
            "sessions": list(sessions_per_day),
            "alerts": list(alerts_per_day),
            "behaviors": list(behaviors_per_day),
        }
    )
