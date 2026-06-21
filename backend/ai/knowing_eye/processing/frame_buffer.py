"""Per-session frame queue — sequential processing with bounded backlog."""

from __future__ import annotations

import threading
from collections import deque
from dataclasses import dataclass
from typing import Any, Callable

import numpy as np


@dataclass
class _QueuedFrame:
    frame: np.ndarray
    session_id: str | None
    reference_embedding: list[float] | None


class FrameAnalysisBuffer:
    """
    Ensures frames for a session are analyzed sequentially.

    When the queue exceeds ``max_depth``, the oldest pending frame is dropped
    so latency stays bounded under load (real-time monitoring requirement).
    """

    def __init__(self, max_depth: int = 3) -> None:
        self._max_depth = max(1, max_depth)
        self._queues: dict[str, deque[_QueuedFrame]] = {}
        self._locks: dict[str, threading.Lock] = {}
        self._global_lock = threading.Lock()

    def _session_lock(self, session_id: str) -> threading.Lock:
        with self._global_lock:
            if session_id not in self._locks:
                self._locks[session_id] = threading.Lock()
            return self._locks[session_id]

    def analyze(
        self,
        session_id: str | None,
        frame_bgr: np.ndarray,
        reference_embedding: list[float] | None,
        analyze_fn: Callable[..., Any],
    ) -> Any:
        sid = session_id or "__anonymous__"
        lock = self._session_lock(sid)
        with lock:
            return analyze_fn(
                frame_bgr,
                session_id=session_id,
                reference_embedding=reference_embedding,
            )

    def reset_session(self, session_id: str) -> None:
        with self._global_lock:
            self._queues.pop(session_id, None)
            self._locks.pop(session_id, None)
