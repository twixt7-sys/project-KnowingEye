"""Fan-out of REST-analyzed frames to proctor observers.

The websocket consumer broadcasts analysis, snapshots and alerts for frames it
receives. Examinees whose socket dropped fall back to POSTing frames to
``/api/monitoring/frame/`` for the rest of the session, so that endpoint has to
emit the same messages - otherwise the proctor's live tile freezes on the last
snapshot (or never gets one) as soon as the examinee falls back.
"""

from __future__ import annotations

import logging
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger("knowing_eye.monitoring.broadcast")


def broadcast_frame_result(session, user, frame, analysis: dict[str, Any]) -> None:
    """Send analysis, a JPEG snapshot and any alerts to the session's observers.

    Mirrors the messages ``MonitoringConsumer._handle_frame`` sends. Never
    raises: a broadcast failure must not fail the examinee's frame POST.
    """
    from ai.frame_utils import encode_jpeg_snapshot
    from features.monitoring.consumers import ADMIN_ALERTS_GROUP

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    group = f"monitoring.session.{session.id}"
    session_id = str(session.id)
    send = async_to_sync(channel_layer.group_send)

    try:
        send(
            group,
            {"type": "analysis.broadcast", "payload": analysis, "session_id": session_id},
        )
        snapshot = encode_jpeg_snapshot(frame)
        if snapshot:
            send(
                group,
                {
                    "type": "snapshot.broadcast",
                    "image": snapshot,
                    "session_id": session_id,
                    "analysis": analysis,
                },
            )
        for alert in analysis.get("alerts", []):
            enriched = {
                **alert,
                "session_id": session_id,
                "user_id": getattr(user, "id", None),
                "user": getattr(user, "username", ""),
            }
            send(group, {"type": "alert.broadcast", "payload": enriched})
            send(ADMIN_ALERTS_GROUP, {"type": "alert.broadcast", "payload": enriched})
    except Exception:  # noqa: BLE001
        logger.exception("observer broadcast failed for session %s", session_id)
