from django.db.models import Avg, Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from features.behavior.models import Alert, BehaviorLog
from features.session.models import ExamSession
from features.session.serializers import ExamSessionDetailSerializer


def _session_queryset(user):
    if user.is_admin():
        return ExamSession.objects.select_related("exam", "user")
    return ExamSession.objects.filter(user=user).select_related("exam", "user")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def report_summary(request):
    """
    GET /api/reports/summary/
    Dashboard aggregates for administrators and examinees.
    """
    sessions = _session_queryset(request.user)
    completed = sessions.filter(status=ExamSession.Status.COMPLETED)
    active = sessions.filter(status=ExamSession.Status.IN_PROGRESS)

    alert_qs = Alert.objects.filter(session__in=sessions)
    unresolved_alerts = alert_qs.filter(resolved=False).count()

    return Response(
        {
            "total_sessions": sessions.count(),
            "active_sessions": active.count(),
            "completed_sessions": completed.count(),
            "unresolved_alerts": unresolved_alerts,
            "behavior_events": BehaviorLog.objects.filter(session__in=sessions).count(),
            "average_score": completed.aggregate(avg=Avg("percentage_score"))["avg"],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def session_report(request, session_id):
    """
    GET /api/reports/sessions/<uuid>/
    Full session report with responses, logs, behavior, and alerts.
    """
    try:
        session = _session_queryset(request.user).get(pk=session_id)
    except ExamSession.DoesNotExist:
        return Response({"detail": "Session not found."}, status=404)

    behavior_summary = (
        BehaviorLog.objects.filter(session=session)
        .values("event_type")
        .annotate(count=Count("id"))
        .order_by("-count")
    )

    return Response(
        {
            "session": ExamSessionDetailSerializer(session).data,
            "behavior_summary": list(behavior_summary),
            "behavior_logs": list(
                BehaviorLog.objects.filter(session=session).order_by("-timestamp")[:50].values(
                    "id", "event_type", "score", "confidence", "metadata", "timestamp"
                )
            ),
            "alerts": list(
                Alert.objects.filter(session=session).order_by("-created_at").values(
                    "id", "alert_type", "severity", "message", "metric_pct", "resolved", "created_at"
                )
            ),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_session_reports(request):
    """
    GET /api/reports/sessions/
    Paginated list of sessions with lightweight report metadata.
    """
    sessions = _session_queryset(request.user).order_by("-started_at")[:100]
    rows = []
    for s in sessions:
        rows.append(
            {
                "id": str(s.id),
                "exam_title": s.exam.title,
                "user": s.user.username,
                "status": s.status,
                "started_at": s.started_at,
                "submitted_at": s.submitted_at,
                "percentage_score": s.percentage_score,
                "passed": s.passed,
                "alert_count": s.alerts.count(),
                "behavior_event_count": s.behavior_logs.count(),
            }
        )
    return Response({"results": rows, "count": len(rows)})
