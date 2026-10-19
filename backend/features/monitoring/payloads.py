"""What the live-monitoring sockets put on the wire.

The pipeline's analysis dict carries more than any browser reads (per-event
metadata, ids the socket already implies). These helpers produce the trimmed
forms that are actually sent; persistence keeps using the full dict.
"""

from __future__ import annotations

from typing import Any

# A persistent condition is flagged on every analyzed frame. Persistence records
# it once per cooldown (``features.behavior.services._EVENT_COOLDOWN_SECONDS``);
# the live feed repeats an alert type at the same pace. A test keeps them equal.
ALERT_REBROADCAST_S = 30.0

# Fields no browser reads off a live analysis: the events (stored server-side,
# and the dock/overlay/tiles only use metrics, face, posture and alerts), the
# session id (implied by the socket), the timestamp, and the pipeline mode (sent
# once in the "connected" message).
_SERVER_ONLY_FIELDS = ("events", "session_id", "timestamp", "pipeline_mode")


def client_analysis(analysis: dict[str, Any]) -> dict[str, Any]:
    """The per-frame analysis as sent to browsers (examinee reply, detail observers)."""
    return {k: v for k, v in analysis.items() if k not in _SERVER_ONLY_FIELDS}


def analysis_summary(analysis: dict[str, Any]) -> dict[str, Any]:
    """The few numbers a proctor's grid tile shows next to its snapshot."""
    metrics = analysis.get("metrics") or {}
    ebi = analysis.get("exam_behavior_index_pct")
    if ebi is None:
        ebi = metrics.get("exam_behavior_index_pct")
    if ebi is None:
        ebi = analysis.get("overall_compliance_pct")
    return {
        "exam_behavior_index_pct": ebi,
        "face_presence_pct": metrics.get("face_presence_pct"),
    }
