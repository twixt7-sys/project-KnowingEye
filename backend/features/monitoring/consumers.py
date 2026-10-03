"""WebSocket consumer for the real-time monitoring stream.

Client → server messages
    {"type": "frame", "image": "<data url or raw base64>"}
    {"type": "enroll", "image": "<base64>"}
    {"type": "ping"}

Server → client messages
    {"type": "analysis", "payload": {...}}
    {"type": "alert", "payload": {...}}
    {"type": "session_state", "status": "paused" | "in_progress" | ..., ...}
    {"type": "enroll_result", "ok": true/false}
    {"type": "pong"}
    {"type": "error", "message": "..."}
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger("knowing_eye.monitoring.consumer")

ADMIN_ALERTS_GROUP = "monitoring.admin.alerts"

# Session expiry / setup-idle bookkeeping is a DB round trip (two during setup).
# Doing it on every frame put that latency in front of every analysis reply;
# timeouts are measured in minutes, so re-checking every few seconds is plenty.
_ACTIVE_CHECK_INTERVAL_S = 5.0

# The examinee streams ~5 frames/s, so per-frame side effects that don't feed
# the examinee's own reply are rate limited: the session's EBI running means are
# still folded every frame (so the averages stay exact) but written back at most
# this often, and the proctor's live snapshot is pushed at most this often.
_EBI_FLUSH_INTERVAL_S = 1.0
_SNAPSHOT_INTERVAL_S = 1.0

# The lifecycle columns a proctor can change while a socket is open (pause,
# resume, terminate). The cached session row is refreshed from just these:
# a full refresh would also reload the EBI running means, discarding frames
# folded in memory but not yet flushed to the database.
_SESSION_STATE_FIELDS = [
    "status",
    "paused_at",
    "paused_total_seconds",
    "pause_reason",
    "deadline_at",
    "submitted_at",
]


def _decode_and_analyze(image_data: str, session_id: str):
    """CPU-bound decode + inference. Runs on a worker thread, not the shared DB thread."""
    from ai.adapter import analyze_frame_bgr
    from ai.frame_utils import decode_base64_image

    frame = decode_base64_image(image_data)
    if frame is None:
        return None, None
    return frame, analyze_frame_bgr(frame, session_id=session_id)


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
        self._last_active_check = float("-inf")
        self._post_task: asyncio.Task | None = None
        self._ebi_dirty = False
        self._last_ebi_flush = float("-inf")
        self._last_snapshot = float("-inf")
        self._group_name = f"monitoring.session.{self.session_id}"
        await self.channel_layer.group_add(self._group_name, self.channel_name)
        await self.accept()

        from ai.adapter import get_pipeline_mode
        from ai.identity_store import get_reference_embedding

        # Warm the in-process reference cache here (DB thread) so the per-frame
        # inference, which runs on a worker thread, never has to touch the DB.
        await database_sync_to_async(get_reference_embedding)(self.session_id)

        await self.send_json(
            {
                "type": "connected",
                "session_id": str(self.session_id),
                "pipeline_mode": get_pipeline_mode(),
            }
        )

    async def disconnect(self, close_code: int) -> None:
        await self._await_post_work()
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
        from features.session.models import ExamSession
        from features.session.services import touch_setup_activity

        now = time.monotonic()
        if now - self._last_active_check >= _ACTIVE_CHECK_INTERVAL_S:
            self._last_active_check = now
            if self._session.status == ExamSession.Status.SETUP:
                await database_sync_to_async(touch_setup_activity)(self._session)

            still_active = await database_sync_to_async(self._refresh_and_check_active)()
            if not still_active:
                await self.send_json({"type": "error", "message": "session expired"})
                await self.close(code=4408)
                return

        # database_sync_to_async is thread_sensitive: every call in the process
        # shares ONE thread, so inference used to queue behind every other
        # session's DB work (and block it in turn). Decode + inference touch no
        # DB, so they run on the general worker pool instead.
        frame, analysis = await sync_to_async(_decode_and_analyze, thread_sensitive=False)(
            content.get("image") or "", str(self.session_id)
        )
        if frame is None:
            await self.send_json({"type": "error", "message": "invalid image"})
            return

        if self._session.status == ExamSession.Status.PAUSED:
            # Nothing is being examined while the exam is paused: keep the live
            # picture flowing to the proctor, but raise no alerts.
            analysis = {**analysis, "alerts": []}

        # Reply before persisting: the client paces its next frame on this
        # message, and the bounding box shouldn't wait on DB writes.
        await self.send_json({"type": "analysis", "payload": analysis})

        # Persistence + fan-out overlap with the next frame's inference. Only
        # one batch is in flight at a time, so DB writes can't pile up.
        await self._await_post_work()
        self._post_task = asyncio.create_task(self._after_frame(frame, analysis))

    async def _await_post_work(self) -> None:
        task = getattr(self, "_post_task", None)
        if task is None:
            return
        self._post_task = None
        try:
            await task
        except Exception:  # noqa: BLE001 - never let bookkeeping kill the stream
            logger.exception("monitoring post-frame work failed session=%s", self.session_id)

    async def _after_frame(self, frame, analysis: dict[str, Any]) -> None:
        now = time.monotonic()
        flush_ebi = now - self._last_ebi_flush >= _EBI_FLUSH_INTERVAL_S
        await self._persist(analysis, save_metrics=flush_ebi)
        if flush_ebi:
            self._last_ebi_flush = now
        self._ebi_dirty = not flush_ebi

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
        if now - self._last_snapshot >= _SNAPSHOT_INTERVAL_S:
            self._last_snapshot = now
            snapshot = await sync_to_async(self._encode_snapshot, thread_sensitive=False)(frame)
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

    async def session_state(self, event: dict[str, Any]) -> None:
        """A proctor paused/resumed this session: sync our copy, then tell the browser."""
        await database_sync_to_async(self._refresh_session_state)()
        await self.send_json(_session_state_message(event))

    async def analysis_broadcast(self, event: dict[str, Any]) -> None:
        """Ignore group fan-out; examinee already received the direct analysis reply."""

    async def snapshot_broadcast(self, event: dict[str, Any]) -> None:
        """Snapshots are for observer consumers only."""

    def _refresh_session_state(self) -> None:
        self._session.refresh_from_db(fields=_SESSION_STATE_FIELDS)

    def _refresh_and_check_active(self) -> bool:
        from features.session.services import ensure_active_session

        # The row cached at connect time goes stale when a proctor pauses,
        # resumes or terminates the session; without this, a resumed examinee
        # (whose deadline moved out) would still be timed out by the old one.
        self._refresh_session_state()
        return ensure_active_session(self._session)

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


def _session_state_message(event: dict[str, Any]) -> dict[str, Any]:
    """Client-facing form of a ``session.state`` group event."""
    return {
        "type": "session_state",
        "session_id": event.get("session_id"),
        "status": event.get("status"),
        "time_remaining_seconds": event.get("time_remaining_seconds"),
        "pause_reason": event.get("pause_reason", ""),
    }


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

    async def session_state(self, event: dict[str, Any]) -> None:
        await self.send_json(_session_state_message(event))


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

    async def session_state(self, event: dict[str, Any]) -> None:
        await self.send_json(_session_state_message(event))
