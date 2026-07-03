"""Heuristic prohibited-object detection via rectangular contour analysis."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ObjectDetectionResult:
    detected: bool
    confidence: float = 0.0
    bbox: list[int] | None = None


def _bbox_overlap_ratio(
    a: tuple[int, int, int, int], b: tuple[int, int, int, int]
) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    x0 = max(ax, bx)
    y0 = max(ay, by)
    x1 = min(ax + aw, bx + bw)
    y1 = min(ay + ah, by + bh)
    if x1 <= x0 or y1 <= y0:
        return 0.0
    inter = (x1 - x0) * (y1 - y0)
    area_a = max(aw * ah, 1)
    return inter / area_a


class ObjectDetector:
    """Detect phone-like rectangular objects in the webcam frame."""

    def detect(
        self,
        frame_bgr,
        face_bbox: tuple[int, int, int, int] | None = None,
    ) -> ObjectDetectionResult:
        if not hasattr(frame_bgr, "shape"):
            return ObjectDetectionResult(detected=False)

        try:
            import cv2
        except ImportError:
            return ObjectDetectionResult(detected=False)

        h, w = frame_bgr.shape[:2]
        if h < 48 or w < 48:
            return ObjectDetectionResult(detected=False)

        y0 = int(h * 0.2)
        roi = frame_bgr[y0:, :]
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blur, 45, 140)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        frame_area = w * h
        best: ObjectDetectionResult | None = None

        for cnt in contours:
            peri = cv2.arcLength(cnt, True)
            if peri < 40:
                continue
            approx = cv2.approxPolyDP(cnt, 0.04 * peri, True)
            x, y, bw, bh = cv2.boundingRect(approx)
            area = bw * bh
            if area < frame_area * 0.006 or area > frame_area * 0.32:
                continue

            aspect = bw / max(bh, 1)
            phone_like = 1.25 <= aspect <= 2.9 or 0.34 <= aspect <= 0.8
            if not phone_like:
                continue

            abs_bbox = (x, y0 + y, bw, bh)
            if face_bbox and _bbox_overlap_ratio(abs_bbox, face_bbox) > 0.45:
                continue

            if len(approx) < 4 or len(approx) > 8:
                continue

            patch = gray[y : y + bh, x : x + bw]
            if patch.size == 0:
                continue
            contrast = float(patch.std())
            if contrast < 22:
                continue

            conf = min(1.0, contrast / 55.0)
            candidate = ObjectDetectionResult(detected=True, confidence=conf, bbox=list(abs_bbox))
            if best is None or candidate.confidence > best.confidence:
                best = candidate

        return best or ObjectDetectionResult(detected=False)

    def close(self) -> None:
        return None
