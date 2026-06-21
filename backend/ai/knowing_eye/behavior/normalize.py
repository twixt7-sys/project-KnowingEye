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


def object_clear_pct(max_phone_confidence: float) -> float:
    return clamp_pct(100.0 * (1.0 - max_phone_confidence))


def overall_compliance_pct(
    face_pct: float,
    gaze_pct: float,
    posture_pct: float,
    identity_pct: float | None,
    object_clear: float,
    weights: dict[str, float] | None = None,
) -> float:
    w = weights or {
        "face": 0.25,
        "gaze": 0.25,
        "posture": 0.2,
        "identity": 0.15,
        "object": 0.15,
    }
    total_w = w["face"] + w["gaze"] + w["posture"] + w["object"]
    score = (
        face_pct * w["face"]
        + gaze_pct * w["gaze"]
        + posture_pct * w["posture"]
        + object_clear * w["object"]
    )
    if identity_pct is not None:
        total_w += w["identity"]
        score += identity_pct * w["identity"]
    else:
        # Redistribute identity weight across other metrics
        bonus = w["identity"] / 4
        score += (face_pct + gaze_pct + posture_pct + object_clear) * bonus
        total_w += w["identity"]
    return clamp_pct(score / total_w)
