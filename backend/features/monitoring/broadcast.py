"""Fan-out of REST-analyzed frames to proctor observers.

The websocket consumer broadcasts analysis, snapshots and alerts for frames it
receives. Examinees whose socket dropped fall back to POSTing frames to
``/api/monitoring/frame/`` for the rest of the session, so that endpoint has to
emit the same messages - otherwise the proctor's live tile freezes on the last
snapshot (or never gets one) as soon as the examinee falls back.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger("knowing_eye.monitoring.broadcast")

# Same cadence as the websocket consumer's _SNAPSHOT_INTERVAL_S: the examinee
# POSTs ~5 frames/s, but a proctor's tile only needs about one picture a second.
_SNAPSHOT_INTERVAL_S = 1.0
_last_snapshot_at: dict[str, float] = {}


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
        snapshot = None
        now = time.monotonic()
        if now - _last_snapshot_at.get(session_id, float("-inf")) >= _SNAPSHOT_INTERVAL_S:
            _last_snapshot_at[session_id] = now
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


def session_state_event(session) -> dict[str, Any]:
    """The ``session.state`` group event describing a session's current state.

    One builder for every sender (the proctor actions here and the examinee's
    own socket when it finds the session over) so the payload can't drift.
    """
    return {
        "type": "session.state",
        "session_id": str(session.id),
        "status": session.status,
        "time_remaining_seconds": session.time_remaining_seconds,
        "pause_reason": session.pause_reason,
    }


def broadcast_session_state(session) -> None:
    """Tell the examinee's browser and any observers a session's state changed.

    Sent when a proctor pauses, resumes or terminates an attempt, so the
    examinee's screen reacts at once instead of waiting for its next heartbeat.
    The payload is only a nudge plus the fields the UI shows; the examinee's
    client re-reads the authoritative state from the server. Never raises: a
    broadcast failure must not fail the proctor's request.
    """
    try:
        from features.monitoring.consumers import ADMIN_ALERTS_GROUP

        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        event = session_state_event(session)
        send = async_to_sync(channel_layer.group_send)
        send(f"monitoring.session.{session.id}", event)
        send(ADMIN_ALERTS_GROUP, event)
    except Exception:  # noqa: BLE001
        logger.exception("session state broadcast failed for session %s", session.id)
