"""Map raw detections to 0–100% compliance scores."""

from __future__ import annotations


def clamp_pct(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 1)


def face_presence_pct(face_count: int) -> float:
    if face_count == 0:
        return 0.0
    if face_count == 1:
        return 100.0
    return clamp_pct(100.0 - 25.0 * (face_count - 1))


def gaze_focus_pct(yaw_deg: float | None, pitch_deg: float | None, yaw_max: float, pitch_max: float) -> float:
    if yaw_deg is None or pitch_deg is None:
        return 0.0
    yaw_ratio = abs(yaw_deg) / max(yaw_max, 1e-6)
    pitch_ratio = abs(pitch_deg) / max(pitch_max, 1e-6)
    worst = max(yaw_ratio, pitch_ratio)
    return clamp_pct(100.0 * (1.0 - min(1.0, worst)))


def posture_compliance_pct(
    detected: bool,
    shoulder_tilt: float | None,
    spine_lean: float | None,
    tilt_max: float,
    lean_max: float = 0.55,
) -> float:
    if not detected:
        return 50.0
    tilt_ratio = (shoulder_tilt or 0.0) / max(tilt_max, 1e-6)
    lean_ratio = (spine_lean or 0.0) / max(lean_max, 1e-6)
    worst = max(tilt_ratio, lean_ratio)
    return clamp_pct(100.0 * (1.0 - min(1.0, worst)))


def identity_match_pct(
    match: bool | None,
    distance: float | None,
    match_threshold: float,
) -> float | None:
    if match is None and distance is None:
        return None
    if distance is not None:
        return clamp_pct(100.0 * max(0.0, 1.0 - distance / max(match_threshold, 1e-6)))
    return 100.0 if match else 0.0


def exam_behavior_index_pct(
    face_pct: float,
    gaze_pct: float,
    posture_pct: float,
    identity_pct: float | None,
) -> tuple[float, int]:
    """Composite **Exam Behavior Index (EBI)** as an equal-weight formative index.

    EBI is the arithmetic mean of the normalized examination-monitoring
    indicators (all on the same 0-100 "higher = more compliant" scale)::

        EBI = (Fp + Fi + Up + Gc) / N

    where the four indicators are Face Presence (``Fp`` = ``face_pct``), Face
    Identity (``Fi`` = ``identity_pct``), Upper-Body Presence (``Up`` =
    ``posture_pct``) and Looking-Away Compliance (``Gc`` = ``gaze_pct``).

    Equal weighting is a deliberate formative-measurement design decision: the
    indicators collectively *define* the monitoring construct and are not
    required to be interchangeable or strongly correlated, so an equal-weight
    arithmetic mean is the appropriate initial aggregation once every indicator
    has been normalized to the same direction and scale.

    **Identity is only counted when it was evaluated.** When no reference face
    is enrolled ``identity_pct`` is ``None`` and identity is *not evaluated*
    rather than scored zero - otherwise a single face-absence event would be
    penalised twice (through both Face Presence and Face Identity). In that
    case ``N`` is 3; when identity is evaluated ``N`` is 4.

    Returns:
        ``(ebi_pct, indicator_count)`` - the 0-100 index and the number ``N``
        of indicators actually averaged (3 or 4).
    """
    indicators = [face_pct, gaze_pct, posture_pct]
    if identity_pct is not None:
        indicators.append(identity_pct)
    count = len(indicators)
    return clamp_pct(sum(indicators) / count), count


def overall_compliance_pct(
    face_pct: float,
    gaze_pct: float,
    posture_pct: float,
    identity_pct: float | None,
    weights: dict[str, float] | None = None,
) -> float:
    """Overall compliance score, defined as the equal-weight Exam Behavior Index.

    The system's composite compliance figure is the averaged EBI (see
    :func:`exam_behavior_index_pct`). The ``weights`` argument is retained for
    backward compatibility but ignored: the EBI is an equal-weight formative
    index by design, so the KPIs are averaged rather than weighted here.
    """
    ebi, _ = exam_behavior_index_pct(face_pct, gaze_pct, posture_pct, identity_pct)
    return ebi
