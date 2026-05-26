"""Reporting endpoints — dashboard summary, session reports, CSV export."""

from __future__ import annotations

import csv
from io import StringIO

from django.db.models import Avg, Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from features.behavior.models import Alert, BehaviorLog
from features.session.models import ExamSession
from features.session.serializers import ExamSessionDetailSerializer


def _session_queryset(user):
    qs = ExamSession.objects.select_related("exam", "user")
    if user.is_admin():
        return qs
    return qs.filter(user=user)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def report_summary(request):
    """GET /api/reports/summary/ — dashboard KPIs for admins/examinees."""
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

    return Response(
        {
            "total_sessions": sessions.count(),
            "active_sessions": active.count(),
            "completed_sessions": completed.count(),
            "terminated_sessions": terminated.count(),
            "unresolved_alerts": alert_qs.filter(resolved=False).count(),
            "resolved_alerts": alert_qs.filter(resolved=True).count(),
            "behavior_events": behavior_qs.count(),
            "average_score": completed.aggregate(avg=Avg("percentage_score"))["avg"],
            "pass_rate": completed.filter(passed=True).count()
            / completed.count() * 100.0 if completed.count() else None,
            "alerts_by_severity": by_severity,
            "events_by_type": by_event,
            "generated_at": timezone.now().isoformat(),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def session_report(request, session_id):
    """GET /api/reports/sessions/<uuid>/ — exhaustive session report."""
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

    return Response(
        {
            "session": ExamSessionDetailSerializer(session).data,
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
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_session_reports(request):
    """GET /api/reports/sessions/ — paginated list with KPI per session."""
    qs = _session_queryset(request.user).order_by("-started_at")

    status_filter = request.query_params.get("status")
    if status_filter:
        qs = qs.filter(status=status_filter)

    exam_id = request.query_params.get("exam")
    if exam_id:
        qs = qs.filter(exam_id=exam_id)

    qs = qs.annotate(
        _alert_count=Count("alerts", distinct=True),
        _behavior_count=Count("behavior_logs", distinct=True),
        _unresolved=Count("alerts", filter=Q(alerts__resolved=False), distinct=True),
    )

    rows = []
    for s in qs[:200]:
        rows.append(
            {
                "id": str(s.id),
                "exam_id": s.exam_id,
                "exam_title": s.exam.title,
                "user": s.user.username,
                "user_full_name": f"{s.user.first_name} {s.user.last_name}".strip(),
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
            }
        )
    return Response({"results": rows, "count": len(rows)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def export_sessions_csv(request):
    """GET /api/reports/export/csv/ — downloadable CSV of session reports."""
    qs = _session_queryset(request.user).order_by("-started_at")[:1000]

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "session_id",
            "exam_id",
            "exam_title",
            "username",
            "status",
            "started_at",
            "submitted_at",
            "percentage_score",
            "passed",
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
                s.status,
                s.started_at.isoformat() if s.started_at else "",
                s.submitted_at.isoformat() if s.submitted_at else "",
                float(s.percentage_score) if s.percentage_score is not None else "",
                s.passed if s.passed is not None else "",
                s.alerts.count(),
                s.alerts.filter(resolved=False).count(),
                s.behavior_logs.count(),
            ]
        )

    response = HttpResponse(buffer.getvalue(), content_type="text/csv")
    filename = f"knowing-eye-sessions-{timezone.now():%Y%m%d-%H%M%S}.csv"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_timeseries(request):
    """GET /api/reports/timeseries/ — behaviors and alerts per day (last 30 days)."""
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
