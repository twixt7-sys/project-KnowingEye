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
from typing import Any

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger("knowing_eye.monitoring.consumer")

ADMIN_ALERTS_GROUP = "monitoring.admin.alerts"


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

        if not self._user_can_access(user, session):
            await self.close(code=4403)
            return

        self._session = session
        self._user = user
        self._group_name = f"monitoring.session.{self.session_id}"
        self._frame_counter = 0
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
        persisted = await self._persist(analysis)

        await self.send_json(
            {
                "type": "analysis",
                "payload": analysis,
                "persisted": persisted,
            }
        )

        self._frame_counter += 1
        await self.channel_layer.group_send(
            self._group_name,
            {
                "type": "analysis.broadcast",
                "payload": analysis,
                "session_id": str(self.session_id),
            },
        )
        if self._frame_counter % 3 == 0:
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
        frame = await database_sync_to_async(decode_base64_image)(content.get("image") or "")
        if frame is None:
            await self.send_json({"type": "enroll_result", "ok": False, "message": "invalid image"})
            return

        log.info("ws enroll session=%s shape=%s", self._session.id, getattr(frame, "shape", None))
        result = await database_sync_to_async(enroll_reference)(frame, self._session)
        log.info("ws enroll session=%s ok=%s", self._session.id, result.get("ok"))
        await self.send_json({"type": "enroll_result", **result})

    async def alert_broadcast(self, event: dict[str, Any]) -> None:
        await self.send_json({"type": "alert", "payload": event.get("payload", {})})

    async def analysis_broadcast(self, event: dict[str, Any]) -> None:
        """Ignore group fan-out; examinee already received the direct analysis reply."""

    async def snapshot_broadcast(self, event: dict[str, Any]) -> None:
        """Snapshots are for observer consumers only."""

    @database_sync_to_async
    def _persist(self, analysis: dict[str, Any]) -> dict[str, int]:
        from features.behavior.services import persist_analysis

        return persist_analysis(self._session, analysis)

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
        if getattr(user, "is_admin", lambda: False)():
            return True
        return session.user_id == user.id


class SessionObserverConsumer(AsyncJsonWebsocketConsumer):
    """Read-only admin feed for a single session (analysis + snapshots)."""

    async def connect(self) -> None:
        user = self.scope.get("user")
        if user is None or not getattr(user, "is_authenticated", False):
            await self.close(code=4401)
            return
        if not getattr(user, "is_admin", lambda: False)():
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
        if not getattr(user, "is_admin", lambda: False)():
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
