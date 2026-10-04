"""Map raw detections to 0–100% compliance scores."""

from __future__ import annotations

# --- Exam Behavior Index (EBI) risk bands -----------------------------------
# The EBI (0-100, higher = more compliant) is classified into three ordinal
# behaviour bands so that a continuous monitoring score becomes an actionable
# good / mid / bad label. The two cut-points are cited, not arbitrary:
#
#   EBI_GOOD_MIN = 80  -> "good": matches the system's per-metric compliance
#       cutoff (pipeline.alert_threshold_pct, see 04-system-testing.html#ai-
#       evaluation). It is deliberately stricter than the 75% "no-risk"
#       boundary of the cited automated-proctoring risk model [20], so a
#       "good" EBI is never more lenient than that reference.
#   EBI_MID_MIN  = 50  -> boundary between "mid" and "bad": the same automated-
#       proctoring risk model assigns its maximum risk weight once a visual
#       compliance signal falls below 50% [20]. Below this, behaviour is
#       treated as high-concern ("bad").
#
# Threshold-based ordinal classification of online-exam behaviour follows the
# established practice in [14] (Ferdosi et al.), which classifies examinee
# behavioural patterns against a fixed decision threshold. Boundaries are
# configurable via behavior.ebi_bands in pipeline.yaml; these are the defaults.
EBI_GOOD_MIN = 80.0
EBI_MID_MIN = 50.0

EBI_BAND_GOOD = "good"
EBI_BAND_MID = "mid"
EBI_BAND_BAD = "bad"


def classify_ebi_band(
    ebi_pct: float,
    good_min: float = EBI_GOOD_MIN,
    mid_min: float = EBI_MID_MIN,
) -> str:
    """Classify an EBI value (0-100) into ``good`` / ``mid`` / ``bad``.

    ``good`` = EBI >= ``good_min`` (compliant, low concern).
    ``mid``  = ``mid_min`` <= EBI < ``good_min`` (moderate concern, review).
    ``bad``  = EBI < ``mid_min`` (high concern, priority review).
    """
    if ebi_pct >= good_min:
        return EBI_BAND_GOOD
    if ebi_pct >= mid_min:
        return EBI_BAND_MID
    return EBI_BAND_BAD


# Posture scoring: ratios are measured against the configured limit (tilt_max /
# lean_max). Below _POSTURE_DEADBAND_RATIO the score is 100; it reaches 0 at
# _POSTURE_ZERO_RATIO.
_POSTURE_DEADBAND_RATIO = 0.5
_POSTURE_ZERO_RATIO = 2.0

# Lowest Upper-Body Presence while any other examinee signal is detected (face
# box, recognised identity or a pose) - see upper_body_presence_pct.
_UPPER_BODY_PRESENT_MIN_PCT = 50.0


def clamp_pct(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 1)


def face_presence_pct(face_count: int, identity_detected: bool = False) -> float:
    """Face Presence (``Fp``): strictly binary - 0% or 100%, nothing in between.

    100% when a face is in view, or whenever the examinee's identity was
    detected (recognising the enrolled face proves a face is there, even if the
    face detector missed it this frame); 0% otherwise.
    """
    return 100.0 if face_count > 0 or identity_detected else 0.0


def gaze_focus_pct(yaw_deg: float | None, pitch_deg: float | None, yaw_max: float, pitch_max: float) -> float:
    if yaw_deg is None or pitch_deg is None:
        return 0.0
    yaw_ratio = abs(yaw_deg) / max(yaw_max, 1e-6)
    pitch_ratio = abs(pitch_deg) / max(pitch_max, 1e-6)
    worst = max(yaw_ratio, pitch_ratio)
    return clamp_pct(100.0 * (1.0 - min(1.0, worst)))


def threshold_compliance_pct(
    value: float | None,
    threshold: float,
    knee_pct: float = 80.0,
) -> float:
    """Map a "lower is better" measurement onto 0-100% compliance so that the
    configured threshold lands exactly on the alert cutoff.

        value = 0              -> 100%
        value = threshold      -> ``knee_pct`` (the 80% alert cutoff)
        value = 2 x threshold  -> 0%

    A plain ``1 - value / threshold`` line puts the 80% cutoff at only 20% of
    the threshold, so e.g. a 0.42 identity threshold actually alerted at a
    cosine distance of 0.084 - inside the normal same-person range for ArcFace.
    With this piecewise mapping, "metric < alert cutoff" means exactly
    "value > threshold".
    """
    if value is None:
        return 100.0
    ratio = max(0.0, float(value)) / max(threshold, 1e-6)
    if ratio <= 1.0:
        return clamp_pct(100.0 - (100.0 - knee_pct) * ratio)
    return clamp_pct(knee_pct * (2.0 - ratio))


def upper_body_presence_pct(
    detected: bool,
    visibility: float | None = None,
    *,
    identity_detected: bool = False,
    face_box_present: bool = False,
) -> float:
    """Upper-Body Presence (``Up``): is the examinee's upper body in view?

    ``visibility`` is the pose model's shoulder visibility (0-1); ``None``
    means the backend gives no confidence, so a detection counts fully.

    * Identity detected *and* face bounding box present -> always 100%. The
      recognised examinee is evidently seated in front of the camera; a close
      webcam framing that shows only the head and upper torso cuts the
      shoulders off at the frame edge, which the pose model reports as "not
      detected", but that is not absence.
    * Any other examinee signal (face box, recognised identity or a pose
      detection) -> never 0%: the shoulder visibility is rescaled onto 50-100%
      (50% = no shoulder evidence, 100% = shoulders fully visible), which is
      never lower than the plain score. This covers e.g. an identity score of
      0 (mismatch / not yet recognised) with the face still in view.
    * Nothing detected at all -> 0%.
    """
    if identity_detected and face_box_present:
        return 100.0
    if not (detected or identity_detected or face_box_present):
        return 0.0
    if visibility is None:
        visibility = 1.0 if detected else 0.0
    vis = max(0.0, min(1.0, visibility))
    floor = _UPPER_BODY_PRESENT_MIN_PCT
    return clamp_pct(floor + (100.0 - floor) * vis)


def posture_quality_pct(
    detected: bool,
    shoulder_tilt: float | None,
    spine_lean: float | None,
    tilt_max: float,
    lean_max: float = 0.30,
) -> float | None:
    """How upright a *detected* upper body is (drives the bad_posture event only).

    ``None`` when no upper body was detected - absence is handled by
    upper-body presence and the leaving_seat event, not scored as bad posture.
    """
    if not detected:
        return None
    tilt_ratio = (shoulder_tilt or 0.0) / max(tilt_max, 1e-6)
    lean_ratio = (spine_lean or 0.0) / max(lean_max, 1e-6)
    worst = max(tilt_ratio, lean_ratio)
    # Gradual falloff: full marks inside the deadband, then a linear decline that
    # only reaches 0 at twice the limit. A ratio right at the limit scores ~67%
    # (below the 80% alert cutoff) instead of cliffing straight to 0%.
    over = (worst - _POSTURE_DEADBAND_RATIO) / (_POSTURE_ZERO_RATIO - _POSTURE_DEADBAND_RATIO)
    return clamp_pct(100.0 * (1.0 - max(0.0, min(1.0, over))))


def identity_match_pct(
    match: bool | None,
    distance: float | None,
    match_threshold: float,
    knee_pct: float = 80.0,
) -> float | None:
    if match is None and distance is None:
        return None
    if distance is not None:
        return threshold_compliance_pct(distance, match_threshold, knee_pct)
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
