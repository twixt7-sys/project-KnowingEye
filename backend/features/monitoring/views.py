"""HTTP endpoints for the monitoring feature.

The websocket consumer in ``consumers.py`` is the primary realtime path;
these endpoints exist for fallback browsers, health checks, and admin tooling.
"""

from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from ai.adapter import (
    analyze_frame_bgr,
    enroll_reference as _enroll_reference,
    get_pipeline_mode,
)
from ai.frame_utils import decode_base64_image
from features.behavior.services import persist_analysis
from features.session.models import ExamSession

logger = logging.getLogger("knowing_eye.monitoring.views")


def _resolve_session(request, session_id):
    try:
        session = ExamSession.objects.select_related("exam", "user").get(pk=session_id)
    except ExamSession.DoesNotExist:
        return None, Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

    if not request.user.is_admin() and session.user_id != request.user.id:
        return None, Response(
            {"error": "Not allowed for this session"}, status=status.HTTP_403_FORBIDDEN
        )

    return session, None


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def receive_frame(request):
    """POST /api/monitoring/frame/  - analyze a single base64 frame."""
    image_data = request.data.get("image")
    session_id = request.data.get("session_id")

    if not image_data:
        return Response({"error": "No image provided"}, status=status.HTTP_400_BAD_REQUEST)
    if not session_id:
        return Response({"error": "session_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    frame = decode_base64_image(image_data)
    if frame is None:
        return Response({"error": "Invalid image"}, status=status.HTTP_400_BAD_REQUEST)

    session, err = _resolve_session(request, session_id)
    if err:
        return err

    from features.session.services import ensure_active_session, touch_setup_activity

    if session.status == ExamSession.Status.SETUP:
        touch_setup_activity(session)

    if not ensure_active_session(session):
        session.refresh_from_db()
        return Response(
            {"error": "Session has expired due to time limit"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if session.status not in (
        ExamSession.Status.SETUP,
        ExamSession.Status.IN_PROGRESS,
    ):
        return Response(
            {"error": "Session is not active"}, status=status.HTTP_400_BAD_REQUEST
        )

    try:
        analysis = analyze_frame_bgr(frame, session_id=str(session_id))
    except Exception as exc:  # noqa: BLE001 - we never want the endpoint to 500 the UI
        logger.exception("analyze_frame_bgr failed: %s", exc)
        return Response(
            {"error": "Frame analysis failed", "detail": str(exc)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    persisted = persist_analysis(session, analysis)

    return Response(
        {
            "status": "ok",
            "session_id": str(session_id),
            "pipeline_mode": get_pipeline_mode(),
            "shape": list(frame.shape),
            "analysis": analysis,
            "persisted": persisted,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def enroll_reference_view(request):
    """POST /api/monitoring/enroll/  - store a reference face for a session."""
    image_data = request.data.get("image")
    session_id = request.data.get("session_id")

    if not image_data:
        return Response({"error": "image is required"}, status=status.HTTP_400_BAD_REQUEST)
    if not session_id:
        return Response({"error": "session_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    session, err = _resolve_session(request, session_id)
    if err:
        return err

    frame = decode_base64_image(image_data)
    if frame is None:
        return Response({"error": "invalid image"}, status=status.HTTP_400_BAD_REQUEST)

    from features.session.services import ensure_active_session, touch_setup_activity

    if session.status == ExamSession.Status.SETUP:
        touch_setup_activity(session)

    if not ensure_active_session(session):
        session.refresh_from_db()
        return Response(
            {"error": "Session has expired - return to the dashboard and start setup again."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    result = _enroll_reference(frame, session=session)
    logger.info(
        "enroll session=%s ok=%s backend=%s",
        session_id,
        result.get("ok"),
        result.get("backend"),
    )
    return Response({**result, "session_id": str(session_id)})


@api_view(["GET"])
@permission_classes([AllowAny])
def monitoring_health(request):
    """GET /api/monitoring/health/  - public health probe."""
    return Response(
        {
            "status": "ok",
            "service": "knowing-eye-monitoring",
            "pipeline_mode": get_pipeline_mode(),
        }
    )
