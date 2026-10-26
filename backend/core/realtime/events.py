"""Tell open browsers which kinds of data just changed.

Every write that other screens show - an exam, a question, a department, an
attempt, an alert, a user - calls :func:`notify` (mostly through model
signals). Once the surrounding transaction commits, one small message per
topic goes out over the ``/ws/updates/`` socket and each browser refetches
whatever it has on screen for that topic. Messages carry only a topic and an
optional exam id, never the data itself, so a browser always re-reads what
it is allowed to see through the normal REST endpoints.

The same commit also drops server-side cached responses that depend on the
changed data (see ``core.utils.api_cache``), so the refetch is never served
a stale copy.
"""

from __future__ import annotations

import logging
import threading

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

from core.utils.api_cache import bump_namespace

logger = logging.getLogger("knowing_eye.realtime")

# Every signed-in user.
ALL_GROUP = "data.all"
# Every non-examinee role.
STAFF_GROUP = "data.staff"


def user_group(user_id: int) -> str:
    return f"data.user.{user_id}"


class Topic:
    EXAMS = "exams"
    REFERENCE = "reference"
    SESSIONS = "sessions"
    ALERTS = "alerts"
    USERS = "users"
    # The signed-in user's own account (role, permissions, profile).
    ME = "me"


# Server-cached response namespaces each topic makes stale.
_CACHE_NAMESPACES = {
    Topic.EXAMS: ("reports",),
    Topic.REFERENCE: ("reference-data", "reports"),
    Topic.SESSIONS: ("reports",),
    Topic.ALERTS: ("reports",),
    Topic.USERS: ("reports",),
}

_local = threading.local()


def notify(
    topic: str,
    *,
    exam_id: int | None = None,
    audience: str | None = ALL_GROUP,
    user_id: int | None = None,
) -> None:
    """Queue a change notification, sent once the current transaction commits.

    ``audience`` is ``ALL_GROUP``, ``STAFF_GROUP`` (examinees are not told) or
    ``None`` (only ``user_id`` is told); ``user_id`` additionally tells that
    one user. Repeats within one transaction - e.g. every row of a question
    import - collapse into a single message. Never raises: a broadcast problem
    must not fail a write.
    """
    try:
        groups = [audience] if audience else []
        if user_id is not None:
            groups.append(user_group(user_id))
        keys = {(group, topic, exam_id) for group in groups}

        connection = transaction.get_connection()
        if not connection.in_atomic_block:
            _send(keys)
            return
        # One pending batch per transaction. Django swaps in a fresh
        # ``run_on_commit`` list on commit and on rollback, so a batch whose
        # list is gone was either sent or discarded - start a new one.
        batch = getattr(_local, "batch", None)
        if batch is None or batch[0] is not connection.run_on_commit:
            pending: set[tuple[str, str, int | None]] = set()
            transaction.on_commit(lambda: _send(pending))
            batch = (connection.run_on_commit, pending)
            _local.batch = batch
        batch[1].update(keys)
    except Exception:  # noqa: BLE001
        logger.exception("could not queue %s notification", topic)


def _send(pending: set[tuple[str, str, int | None]]) -> None:
    if not pending:
        return

    for namespace in {ns for _, topic, _ in pending for ns in _CACHE_NAMESPACES.get(topic, ())}:
        try:
            bump_namespace(namespace)
        except Exception:  # noqa: BLE001
            logger.exception("could not drop cached %s responses", namespace)

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    send = async_to_sync(channel_layer.group_send)
    for group, topic, exam_id in pending:
        try:
            send(group, {"type": "data.changed", "topic": topic, "exam_id": exam_id})
        except Exception:  # noqa: BLE001
            logger.exception("could not broadcast %s change to %s", topic, group)
