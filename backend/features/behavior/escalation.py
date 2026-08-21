"""Session-level escalation ladder: Normal -> Warning -> Suspicious -> Critical -> Action.

Directive Area 04 ("Anomaly accumulation model", P0) replaces "one head turn =
anomaly" with an explicit four-tier ladder that counts repeated occurrences of
the same signal and weights combined signals higher than one isolated signal.
Per-event ``Alert.severity`` (low/medium/high) already existed before this
sprint and is untouched - this module adds a session-level rollup on top of
it, aggregating ``BehaviorLog`` rows over the same sliding window
(``behavior.suspicious_pattern`` in ``pipeline.yaml``) that already backs the
``suspicious_pattern`` event type, rather than inventing a second window.

"Action" is deliberately not automatic. A Critical tier only recommends
intervention on the live monitoring dashboard; a human proctor still has to
invoke the existing ``sessions.terminate`` action. See "Threshold
justification" in docs/documentation/chapter2/03-system-design.html for why
auto-terminating from a CV heuristic alone is out of scope here.

The scoring core (:func:`tier_from_events`) is a pure function over plain
``EventRecord`` tuples with no Django/ORM dependency, so the ladder can be
unit-tested against synthetic event streams without a database - per the
Directive's own instruction that this is "the cheapest, most convincing demo
you can put in front of the panel."
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum


class EscalationTier(str, Enum):
    NORMAL = "normal"
    WARNING = "warning"
    SUSPICIOUS = "suspicious"
    CRITICAL = "critical"


# A single-occurrence signal severe enough to jump straight to Critical,
# regardless of weighted total - identity fraud is the one behavior-event
# type where "it happened once" is already the answer, not a pattern to wait
# for. Mirrors alert_severity.identity_mismatch: high in pipeline.yaml.
_CRITICAL_ON_SIGHT = frozenset({"identity_mismatch"})

# Weighted-total tier boundaries. Calibrated against pipeline.yaml's own
# per-event weights (max single weight 1.0, for no_face) so that neither
# tier is reachable by one low/medium-weight event alone, per the Directive's
# "duration and frequency, not single-frame events" instruction.
_SUSPICIOUS_THRESHOLD = 1.5
_CRITICAL_THRESHOLD = 2.5

# Combined-signal bonus: weighting combined signals higher than one isolated
# signal (Directive Area 04), applied as a multiplier per additional
# distinct event type present in the window.
_COMBINED_SIGNAL_BONUS = 0.5


@dataclass(frozen=True)
class EventRecord:
    """One behavior event, reduced to what the escalation math needs."""

    event_type: str
    timestamp: datetime


@dataclass(frozen=True)
class EscalationResult:
    tier: EscalationTier
    combined_score: float
    distinct_signal_types: int
    triggering_event_types: tuple[str, ...]
    recommend_intervention: bool


def _default_weights() -> dict[str, float]:
    from ai.knowing_eye.config import load_config

    config = load_config()
    return dict(config.get("behavior", {}).get("weights", {}))


def _default_window_seconds() -> int:
    from ai.knowing_eye.config import load_config

    config = load_config()
    return int(config.get("behavior", {}).get("suspicious_pattern", {}).get("window_seconds", 60))


def _default_min_flags() -> int:
    from ai.knowing_eye.config import load_config

    config = load_config()
    return int(config.get("behavior", {}).get("suspicious_pattern", {}).get("min_flags", 3))


def tier_from_events(
    events: list[EventRecord],
    *,
    now: datetime,
    weights: dict[str, float] | None = None,
    window_seconds: int | None = None,
    min_flags: int | None = None,
) -> EscalationResult:
    """Compute the escalation tier for one session from a list of events.

    Pure function - no database access - so it can be driven by synthetic
    event streams in tests as well as by real ``BehaviorLog`` rows.

    Args:
        events: All candidate events for the session (any window; only
            events within ``window_seconds`` of ``now`` are considered).
        now: The evaluation instant (usually ``timezone.now()``).
        weights: Per-event-type weight map. Defaults to
            ``pipeline.yaml``'s ``behavior.weights``.
        window_seconds: Sliding window size. Defaults to
            ``pipeline.yaml``'s ``behavior.suspicious_pattern.window_seconds``.
        min_flags: Repeated-occurrence-of-one-type threshold. Defaults to
            ``pipeline.yaml``'s ``behavior.suspicious_pattern.min_flags``.

    Returns:
        The computed :class:`EscalationResult`.
    """
    weights = weights if weights is not None else _default_weights()
    window_seconds = window_seconds if window_seconds is not None else _default_window_seconds()
    min_flags = min_flags if min_flags is not None else _default_min_flags()

    cutoff = now - timedelta(seconds=window_seconds)
    windowed = [e for e in events if cutoff <= e.timestamp <= now]

    if not windowed:
        return EscalationResult(
            tier=EscalationTier.NORMAL,
            combined_score=0.0,
            distinct_signal_types=0,
            triggering_event_types=(),
            recommend_intervention=False,
        )

    event_types = tuple(sorted({e.event_type for e in windowed}))

    if _CRITICAL_ON_SIGHT.intersection(event_types):
        combined_score = sum(weights.get(e.event_type, 0.0) for e in windowed)
        return EscalationResult(
            tier=EscalationTier.CRITICAL,
            combined_score=combined_score,
            distinct_signal_types=len(event_types),
            triggering_event_types=event_types,
            recommend_intervention=True,
        )

    combined_score = sum(weights.get(e.event_type, 0.0) for e in windowed)
    if len(event_types) > 1:
        combined_score *= 1 + _COMBINED_SIGNAL_BONUS * (len(event_types) - 1)

    counts: dict[str, int] = {}
    for e in windowed:
        counts[e.event_type] = counts.get(e.event_type, 0) + 1
    repeated_pattern = any(count >= min_flags for count in counts.values())

    if combined_score >= _CRITICAL_THRESHOLD:
        tier = EscalationTier.CRITICAL
    elif combined_score >= _SUSPICIOUS_THRESHOLD or repeated_pattern:
        tier = EscalationTier.SUSPICIOUS
    else:
        tier = EscalationTier.WARNING

    return EscalationResult(
        tier=tier,
        combined_score=combined_score,
        distinct_signal_types=len(event_types),
        triggering_event_types=event_types,
        recommend_intervention=tier == EscalationTier.CRITICAL,
    )


def compute_escalation_for_session(session) -> EscalationResult:
    """Compute the current escalation tier for a live ``ExamSession``.

    Queries the same ``BehaviorLog`` rows :mod:`features.behavior.services`
    already persists, over the same sliding window used for
    ``suspicious_pattern`` detection.
    """
    from django.utils import timezone

    from features.behavior.models import BehaviorLog

    now = timezone.now()
    window_seconds = _default_window_seconds()
    cutoff = now - timedelta(seconds=window_seconds)
    logs = BehaviorLog.objects.filter(session=session, timestamp__gte=cutoff).values_list(
        "event_type", "timestamp"
    )
    events = [EventRecord(event_type=event_type, timestamp=ts) for event_type, ts in logs]
    return tier_from_events(events, now=now)
