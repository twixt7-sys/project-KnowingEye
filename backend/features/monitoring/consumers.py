"""WebSocket consumer for the real-time monitoring stream.

Client → server messages
    {"type": "frame", "image": "<data url or raw base64>"}
    {"type": "enroll", "image": "<base64>"}
    {"type": "ping"}

Server → client messages
    {"type": "analysis", "payload": {...}}
    {"type": "alert", "payload": {...}}
    {"type": "enroll_result", "ok": true/false}
    {"type": "pong"}
    {"type": "error", "message": "..."}
"""

from __future__ import annotations

import logging
import time
from typing import Any

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger("knowing_eye.monitoring.consumer")

ADMIN_ALERTS_GROUP = "monitoring.admin.alerts"

# The examinee streams frames as fast as the pipeline can answer them, so the
# per-frame side effects that don't affect the examinee's own reply are rate
# limited: the session's EBI running means are written back at most this often
# (still folded in memory every frame, so the averages stay exact), and the
# proctor's live snapshot is pushed at most this often.
_EBI_FLUSH_INTERVAL_SECONDS = 1.0
_SNAPSHOT_INTERVAL_SECONDS = 1.0


class MonitoringConsumer(AsyncJsonWebsocketConsumer):
    """Bridges a websocket client to ``backend.ai`` and persistence layer."""

    groups: list[str] = []

    async def connect(self) -> None:
        user = self.scope.get("user")
        if user is None or not getattr(user, "is_authenticated", False):
            await self.close(code=4401)
            return

        self.session_id = self.scope["url_route"]["kwargs"].get("session_id")
        if not self.session_id:
            await self.close(code=4400)
            return

        session = await self._get_session(self.session_id)
        if session is None:
            await self.close(code=4404)
            return

        from features.session.models import ExamSession
        from features.session.services import touch_setup_activity

        if session.status == ExamSession.Status.SETUP:
            await database_sync_to_async(touch_setup_activity)(session)

        if not await database_sync_to_async(self._user_can_access)(user, session):
            await self.close(code=4403)
            return

        self._session = session
        self._user = user
        self._ebi_dirty = False
        self._last_ebi_flush = 0.0
        self._last_snapshot = 0.0
        self._group_name = f"monitoring.session.{self.session_id}"
        await self.channel_layer.group_add(self._group_name, self.channel_name)
        await self.accept()

        from ai.adapter import get_pipeline_mode

        await self.send_json(
            {
                "type": "connected",
                "session_id": str(self.session_id),
                "pipeline_mode": get_pipeline_mode(),
            }
        )

    async def disconnect(self, close_code: int) -> None:
        if getattr(self, "_ebi_dirty", False):
            await self._flush_ebi()
        group = getattr(self, "_group_name", None)
        if group:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive_json(self, content: dict[str, Any], **kwargs) -> None:
        msg_type = content.get("type", "")

        if msg_type == "ping":
            await self.send_json({"type": "pong"})
            return

        if msg_type == "frame":
            await self._handle_frame(content)
            return

        if msg_type == "enroll":
            await self._handle_enroll(content)
            return

        await self.send_json({"type": "error", "message": f"unknown message type '{msg_type}'"})

    async def _handle_frame(self, content: dict[str, Any]) -> None:
        from ai.adapter import analyze_frame_bgr
        from ai.frame_utils import decode_base64_image
        from features.session.models import ExamSession
        from features.session.services import ensure_active_session, touch_setup_activity

        if self._session.status == ExamSession.Status.SETUP:
            await database_sync_to_async(touch_setup_activity)(self._session)

        still_active = await database_sync_to_async(ensure_active_session)(self._session)
        if not still_active:
            await self.send_json({"type": "error", "message": "session expired"})
            await self.close(code=4408)
            return

        image_data = content.get("image") or ""
        frame = await database_sync_to_async(decode_base64_image)(image_data)
        if frame is None:
            await self.send_json({"type": "error", "message": "invalid image"})
            return

        analysis = await database_sync_to_async(analyze_frame_bgr)(
            frame, session_id=str(self.session_id)
        )

        # Reply before persisting: the examinee's overlay and EBI readouts only
        # need the analysis, and the client won't send its next frame until
        # this arrives, so any DB work ahead of it directly slows the loop.
        await self.send_json({"type": "analysis", "payload": analysis})

        now = time.monotonic()
        flush_ebi = now - self._last_ebi_flush >= _EBI_FLUSH_INTERVAL_SECONDS
        await self._persist(analysis, save_metrics=flush_ebi)
        if flush_ebi:
            self._last_ebi_flush = now
            self._ebi_dirty = False
        else:
            self._ebi_dirty = True

        await self.channel_layer.group_send(
            self._group_name,
            {
                "type": "analysis.broadcast",
                "payload": analysis,
                "session_id": str(self.session_id),
            },
        )
        # Observers get a fresh snapshot about once a second; the examinee's
        # frame rate is much higher than a proctor's live tile needs.
        snapshot = None
        if now - self._last_snapshot >= _SNAPSHOT_INTERVAL_SECONDS:
            self._last_snapshot = now
            snapshot = await database_sync_to_async(self._encode_snapshot)(frame)
        if snapshot:
            await self.channel_layer.group_send(
                self._group_name,
                {
                    "type": "snapshot.broadcast",
                    "image": snapshot,
                    "session_id": str(self.session_id),
                    "analysis": analysis,
                },
            )

        for alert in analysis.get("alerts", []):
            enriched = {
                **alert,
                "session_id": str(self.session_id),
                "user_id": getattr(self._user, "id", None),
                "user": getattr(self._user, "username", ""),
            }
            await self.channel_layer.group_send(
                self._group_name,
                {"type": "alert.broadcast", "payload": enriched},
            )
            # Fan out to any admins watching the global live-monitoring feed.
            await self.channel_layer.group_send(
                ADMIN_ALERTS_GROUP,
                {"type": "alert.broadcast", "payload": enriched},
            )

    async def _handle_enroll(self, content: dict[str, Any]) -> None:
        import logging

        from ai.adapter import enroll_reference
        from ai.frame_utils import decode_base64_image

        log = logging.getLogger("knowing_eye.monitoring.consumers")
        images = content.get("images") if isinstance(content.get("images"), list) else []
        if content.get("image"):
            images = [content["image"], *images]

        def _decode_all() -> list:
            return [f for f in (decode_base64_image(img or "") for img in images[:5]) if f is not None]

        frames = await database_sync_to_async(_decode_all)()
        if not frames:
            await self.send_json({"type": "enroll_result", "ok": False, "message": "invalid image"})
            return

        log.info("ws enroll session=%s frames=%d", self._session.id, len(frames))
        result = await database_sync_to_async(enroll_reference)(frames, self._session)
        log.info("ws enroll session=%s ok=%s", self._session.id, result.get("ok"))
        await self.send_json({"type": "enroll_result", **result})

    async def alert_broadcast(self, event: dict[str, Any]) -> None:
        await self.send_json({"type": "alert", "payload": event.get("payload", {})})

    async def analysis_broadcast(self, event: dict[str, Any]) -> None:
        """Ignore group fan-out; examinee already received the direct analysis reply."""

    async def snapshot_broadcast(self, event: dict[str, Any]) -> None:
        """Snapshots are for observer consumers only."""

    @database_sync_to_async
    def _persist(self, analysis: dict[str, Any], *, save_metrics: bool) -> dict[str, int]:
        from features.behavior.services import persist_analysis

        return persist_analysis(self._session, analysis, save_metrics=save_metrics)

    @database_sync_to_async
    def _flush_ebi(self) -> None:
        from features.behavior.services import EBI_UPDATE_FIELDS

        try:
            self._session.save(update_fields=EBI_UPDATE_FIELDS)
            self._ebi_dirty = False
        except Exception:  # noqa: BLE001 - never fail a disconnect over this
            logger.exception("EBI flush failed for session %s", self.session_id)

    @staticmethod
    def _encode_snapshot(frame) -> str | None:
        from ai.frame_utils import encode_jpeg_snapshot

        return encode_jpeg_snapshot(frame)

    @staticmethod
    @database_sync_to_async
    def _get_session(session_id):
        from features.session.models import ExamSession

        try:
            return ExamSession.objects.select_related("exam", "user").get(pk=session_id)
        except ExamSession.DoesNotExist:
            return None

    @staticmethod
    def _user_can_access(user, session) -> bool:
        from core.security import service as security

        if security.has_module(user, "monitoring"):
            return True
        return session.user_id == user.id


@database_sync_to_async
def _has_monitoring_module(user) -> bool:
    from core.security import service as security

    return security.has_module(user, "monitoring")


class SessionObserverConsumer(AsyncJsonWebsocketConsumer):
    """Read-only feed for a single session (analysis + snapshots).

    Open to any role with the ``monitoring`` module (admin, guidance_staff,
    program_head, faculty, proctor) - matches the "proctor can live-monitor"
    capability, not admin-only.
    """

    async def connect(self) -> None:
        user = self.scope.get("user")
        if user is None or not getattr(user, "is_authenticated", False):
            await self.close(code=4401)
            return
        if not await _has_monitoring_module(user):
            await self.close(code=4403)
            return

        self.session_id = self.scope["url_route"]["kwargs"].get("session_id")
        if not self.session_id:
            await self.close(code=4400)
            return

        session = await MonitoringConsumer._get_session(self.session_id)
        if session is None:
            await self.close(code=4404)
            return

        self._group_name = f"monitoring.session.{self.session_id}"
        await self.channel_layer.group_add(self._group_name, self.channel_name)
        await self.accept()
        await self.send_json(
            {
                "type": "connected",
                "scope": "session.observer",
                "session_id": str(self.session_id),
            }
        )

    async def disconnect(self, close_code: int) -> None:
        group = getattr(self, "_group_name", None)
        if group:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive_json(self, content: dict[str, Any], **kwargs) -> None:
        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})

    async def analysis_broadcast(self, event: dict[str, Any]) -> None:
        await self.send_json(
            {
                "type": "analysis",
                "payload": event.get("payload", {}),
                "session_id": event.get("session_id"),
            }
        )

    async def snapshot_broadcast(self, event: dict[str, Any]) -> None:
        await self.send_json(
            {
                "type": "snapshot",
                "image": event.get("image"),
                "session_id": event.get("session_id"),
                "analysis": event.get("analysis"),
            }
        )

    async def alert_broadcast(self, event: dict[str, Any]) -> None:
        await self.send_json({"type": "alert", "payload": event.get("payload", {})})


class AdminAlertsConsumer(AsyncJsonWebsocketConsumer):
    """Fan-in feed of every monitoring alert across all live sessions.

    Connects at ``/ws/monitoring/alerts/`` and is admin-only. Used by the
    Admin Monitoring dashboard to react to alerts in real time without
    polling each individual session.
    """

    async def connect(self) -> None:
        user = self.scope.get("user")
        if user is None or not getattr(user, "is_authenticated", False):
            await self.close(code=4401)
            return
        if not await _has_monitoring_module(user):
            await self.close(code=4403)
            return

        await self.channel_layer.group_add(ADMIN_ALERTS_GROUP, self.channel_name)
        await self.accept()
        await self.send_json({"type": "connected", "scope": "admin.alerts"})

    async def disconnect(self, code: int) -> None:
        await self.channel_layer.group_discard(ADMIN_ALERTS_GROUP, self.channel_name)

    async def receive_json(self, content: dict[str, Any], **kwargs) -> None:
        # The admin feed is broadcast-only; ignore any client messages other
        # than ping/pong for keep-alive.
        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})

    async def alert_broadcast(self, event: dict[str, Any]) -> None:
        await self.send_json({"type": "alert", "payload": event.get("payload", {})})
