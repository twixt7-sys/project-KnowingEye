"""Normalize detection boxes for client-side overlay rendering."""

from __future__ import annotations


def norm_bbox_xywh(bbox: list[int] | tuple[int, ...], width: int, height: int) -> list[float]:
    x, y, w, h = bbox
    return [
        round(x / max(width, 1), 4),
        round(y / max(height, 1), 4),
        round(w / max(width, 1), 4),
        round(h / max(height, 1), 4),
    ]


def norm_bbox_xyxy(bbox: list[int] | tuple[int, ...], width: int, height: int) -> list[float]:
    x1, y1, x2, y2 = bbox
    return [
        round(x1 / max(width, 1), 4),
        round(y1 / max(height, 1), 4),
        round(x2 / max(width, 1), 4),
        round(y2 / max(height, 1), 4),
    ]


def posture_guide_status(*, pose_detected: bool, face_count: int) -> str:
    if not pose_detected:
        return "no_pose"
    if face_count != 1:
        return "off_center"
    return "ok"
