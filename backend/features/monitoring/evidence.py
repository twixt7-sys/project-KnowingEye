"""Persistent snapshot evidence for the proctoring pipeline.

Frames arrive about once a second per examinee and are normally only streamed
to observers. This module keeps two things beyond that:

* a small in-memory ring of recent frames per session (JPEG bytes; nothing is
  written to disk or the database while the exam runs), so that when a proctor
  terminates the attempt the last frames can be kept as evidence;
* the frame that triggered a warning, saved together with the ``Alert`` it caused.

The ring lives in process memory. ``terminate_session`` saves from it when the
terminate request lands in the same process as the examinee's socket, and the
examinee's consumer saves from it when it receives the terminate push; saving is
idempotent, so whichever gets there first wins and the other is a no-op.

Nothing here may raise into the live frame path: every helper logs and returns.
"""

from __future__ import annotations

import itertools
import logging
import threading
import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger("knowing_eye.monitoring.evidence")

# Larger than the 320px observer thumbnail: evidence has to be recognisable.
EVIDENCE_MAX_WIDTH = 480
EVIDENCE_JPEG_QUALITY = 70

# Ring sizes (one entry per ~second). The "flagged" ring only takes frames that
# carried an anomaly, so a long quiet stretch cannot push the evidence out.
# RECENT_FRAMES alone guarantees the five-snapshot minimum once the examinee
# has streamed for five seconds.
RECENT_FRAMES = 6
FLAGGED_FRAMES = 6

MAX_TERMINATION_SNAPSHOTS = RECENT_FRAMES + FLAGGED_FRAMES
MAX_WARNING_SNAPSHOTS_PER_SESSION = 40

# A session that stops sending frames without ever being terminated must not
# pin its ring forever.
_RING_IDLE_TTL_S = 30 * 60
_PURGE_EVERY_S = 60.0


@dataclass(frozen=True)
class EvidenceFrame:
    seq: int
    captured_at: datetime
    jpeg: bytes
    width: int
    height: int
    flags: tuple[str, ...]


class _Ring:
    __slots__ = ("recent", "flagged", "last_seen")

    def __init__(self) -> None:
        self.recent: deque[EvidenceFrame] = deque(maxlen=RECENT_FRAMES)
        self.flagged: deque[EvidenceFrame] = deque(maxlen=FLAGGED_FRAMES)
        self.last_seen = time.monotonic()


_seq = itertools.count()
_rings: dict[str, _Ring] = {}
_lock = threading.Lock()
_last_purge = time.monotonic()


def anomaly_flags(analysis: dict[str, Any] | None) -> tuple[str, ...]:
    """The anomaly types a frame's analysis reported (events and alerts)."""
    if not analysis:
        return ()
    found: set[str] = set()
    for event in analysis.get("events") or []:
        if event.get("event_type"):
            found.add(str(event["event_type"]))
    for alert in analysis.get("alerts") or []:
        if alert.get("type"):
            found.add(str(alert["type"]))
    return tuple(sorted(found))


def _encode(frame) -> tuple[bytes, int, int] | None:
    from ai.frame_utils import encode_jpeg_bytes

    return encode_jpeg_bytes(frame, EVIDENCE_MAX_WIDTH, EVIDENCE_JPEG_QUALITY)


def remember_frame(session_id, frame, analysis: dict[str, Any] | None) -> None:
    """Add a frame to the session's ring. Safe on a worker thread; never raises."""
    global _last_purge
    try:
        encoded = _encode(frame)
        if encoded is None:
            return
        jpeg, width, height = encoded
        entry = EvidenceFrame(
            seq=next(_seq),
            captured_at=timezone.now(),
            jpeg=jpeg,
            width=width,
            height=height,
            flags=anomaly_flags(analysis),
        )
        key = str(session_id)
        now = time.monotonic()
        with _lock:
            ring = _rings.get(key)
            if ring is None:
                ring = _rings[key] = _Ring()
            ring.last_seen = now
            ring.recent.append(entry)
            if entry.flags:
                ring.flagged.append(entry)
            if now - _last_purge >= _PURGE_EVERY_S:
                _last_purge = now
                for stale in [k for k, r in _rings.items() if now - r.last_seen > _RING_IDLE_TTL_S]:
                    del _rings[stale]
    except Exception:  # noqa: BLE001 - evidence must never break the frame path
        logger.exception("could not remember evidence frame session=%s", session_id)


def _take_frames(session_id) -> list[EvidenceFrame]:
    """Remove and return the session's buffered frames, oldest first, deduplicated."""
    with _lock:
        ring = _rings.pop(str(session_id), None)
    if ring is None:
        return []
    merged = {f.seq: f for f in (*ring.flagged, *ring.recent)}
    return [merged[k] for k in sorted(merged)][-MAX_TERMINATION_SNAPSHOTS:]


def save_alert_snapshot(session, alert, frame, analysis: dict[str, Any] | None = None) -> bool:
    """Keep the frame that raised ``alert``. Returns whether a row was written."""
    from features.monitoring.models import SessionSnapshot

    if frame is None:
        return False
    try:
        if (
            SessionSnapshot.objects.filter(
                session=session, kind=SessionSnapshot.Kind.WARNING
            ).count()
            >= MAX_WARNING_SNAPSHOTS_PER_SESSION
        ):
            return False
        encoded = _encode(frame)
        if encoded is None:
            return False
        jpeg, width, height = encoded
        SessionSnapshot.objects.create(
            session=session,
            user_id=session.user_id,
            exam_id=session.exam_id,
            kind=SessionSnapshot.Kind.WARNING,
            alert=alert,
            label=alert.alert_type,
            flags=list(anomaly_flags(analysis)) or [alert.alert_type],
            image=jpeg,
            width=width,
            height=height,
            captured_at=timezone.now(),
        )
        return True
    except Exception:  # noqa: BLE001 - the alert itself is already saved
        logger.exception("could not save warning snapshot session=%s", session.pk)
        return False


def save_termination_snapshots(session, *, session_log=None) -> int:
    """Persist the buffered frames of a terminated session; idempotent.

    Returns the number of rows written (0 when nothing was buffered in this
    process, or the session's termination evidence was already saved).
    """
    from features.monitoring.models import SessionSnapshot
    from features.session.models import ExamSession, SessionLog

    frames = _take_frames(session.pk)
    if not frames:
        return 0
    try:
        with transaction.atomic():
            # Serialise with a concurrent save from another process.
            ExamSession.objects.select_for_update().get(pk=session.pk)
            if SessionSnapshot.objects.filter(
                session=session, kind=SessionSnapshot.Kind.TERMINATION
            ).exists():
                return 0
            if session_log is None:
                session_log = (
                    SessionLog.objects.filter(
                        session=session, event_type=SessionLog.EventType.TERMINATED
                    )
                    .order_by("-timestamp")
                    .first()
                )
            SessionSnapshot.objects.bulk_create(
                [
                    SessionSnapshot(
                        session=session,
                        user_id=session.user_id,
                        exam_id=session.exam_id,
                        kind=SessionSnapshot.Kind.TERMINATION,
                        session_log=session_log,
                        label="termination",
                        flags=list(f.flags),
                        image=f.jpeg,
                        width=f.width,
                        height=f.height,
                        captured_at=f.captured_at,
                    )
                    for f in frames
                ]
            )
        return len(frames)
    except Exception:  # noqa: BLE001 - never fail a terminate over its evidence
        logger.exception("could not save termination snapshots session=%s", session.pk)
        return 0
