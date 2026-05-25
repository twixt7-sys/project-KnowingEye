from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ai.adapter import analyze_frame_bgr, get_pipeline_mode
from ai.frame_utils import decode_base64_image
from features.behavior.services import persist_analysis
from features.session.models import ExamSession


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def receive_frame(request):
    """
    POST /api/monitoring/frame/
    Body: { "image": "<base64>", "session_id": "<uuid>" }
    """
    image_data = request.data.get("image")
    session_id = request.data.get("session_id")

    if not image_data:
        return Response({"error": "No image provided"}, status=status.HTTP_400_BAD_REQUEST)
    if not session_id:
        return Response({"error": "session_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    frame = decode_base64_image(image_data)
    if frame is None:
        return Response({"error": "Invalid image"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        session = ExamSession.objects.get(pk=session_id)
    except ExamSession.DoesNotExist:
        return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

    if not request.user.is_admin() and session.user_id != request.user.id:
        return Response({"error": "Not allowed for this session"}, status=status.HTTP_403_FORBIDDEN)

    if session.status != ExamSession.Status.IN_PROGRESS:
        return Response({"error": "Session is not active"}, status=status.HTTP_400_BAD_REQUEST)

    analysis = analyze_frame_bgr(frame, session_id=str(session_id))
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


@api_view(["GET"])
@permission_classes([])  # public health check for dev / load balancers
def monitoring_health(request):
    """GET /api/monitoring/health/"""
    return Response({"status": "ok", "pipeline_mode": get_pipeline_mode()})
