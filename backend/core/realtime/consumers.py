"""The ``/ws/updates/`` socket every signed-in browser tab keeps open."""

from __future__ import annotations

from typing import Any

from channels.generic.websocket import AsyncJsonWebsocketConsumer

from core.realtime.events import ALL_GROUP, STAFF_GROUP, user_group


class DataChangesConsumer(AsyncJsonWebsocketConsumer):
    """Relays ``data.changed`` events so the browser can refetch what it shows.

    Examinees join only the everyone group and their own; staff roles also
    get staff-only topics (alerts, users, other people's attempts).
    """

    async def connect(self) -> None:
        user = self.scope.get("user")
        if user is None or not getattr(user, "is_authenticated", False):
            await self.close(code=4401)
            return

        self._groups = [ALL_GROUP, user_group(user.id)]
        if user.is_staff_role():
            self._groups.append(STAFF_GROUP)
        for group in self._groups:
            await self.channel_layer.group_add(group, self.channel_name)
        await self.accept()
        await self.send_json({"type": "connected", "scope": "data.changes"})

    async def disconnect(self, code: int) -> None:
        for group in getattr(self, "_groups", []):
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive_json(self, content: dict[str, Any], **kwargs) -> None:
        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})

    async def data_changed(self, event: dict[str, Any]) -> None:
        await self.send_json(
            {"type": "changed", "topic": event.get("topic"), "exam_id": event.get("exam_id")}
        )
