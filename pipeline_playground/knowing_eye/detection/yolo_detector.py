"""YOLO object detection (phones, person) — aligns with capstone YOLO requirement."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

_COCO_PHONE = 67
_COCO_PERSON = 0
_LABELS = {_COCO_PERSON: "person", _COCO_PHONE: "cell_phone"}


@dataclass
class YoloDetection:
    label: str
    confidence: float
    bbox: tuple[int, int, int, int]  # x1,y1,x2,y2


class YoloDetector:
    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        confidence: float = 0.45,
        target_classes: list[int] | None = None,
    ) -> None:
        self._confidence = confidence
        self._target = set(target_classes or [_COCO_PERSON, _COCO_PHONE])
        self._model = None
        self._model_path = model_path
        self._enabled = True

    def _load(self) -> None:
        if self._model is not None:
            return
        try:
            from ultralytics import YOLO

            self._model = YOLO(self._model_path)
        except Exception:
            self._enabled = False

    def detect(self, frame_bgr: np.ndarray) -> list[YoloDetection]:
        self._load()
        if not self._enabled or self._model is None:
            return []

        results = self._model.predict(
            frame_bgr,
            conf=self._confidence,
            verbose=False,
            classes=list(self._target),
        )
        out: list[YoloDetection] = []
        for r in results:
            if r.boxes is None:
                continue
            for box in r.boxes:
                cls_id = int(box.cls[0])
                if cls_id not in self._target:
                    continue
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                conf = float(box.conf[0])
                label = _LABELS.get(cls_id, f"class_{cls_id}")
                out.append(YoloDetection(label=label, confidence=conf, bbox=(x1, y1, x2, y2)))
        return out
