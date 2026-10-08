"""Evaluate the PRODUCTION face detector (MediaPipe Face Landmarker, whose
detector stage is BlazeFace short-range) on the held-out TEST split of the
70/20/10 face dataset - the same 402 images / 1,005 faces the fine-tuned YOLO
and RT-DETR models were tested on.

The detector is pre-trained and used frozen, so it never sees the train or val
splits; only the test split is used, exactly once.

Exactly what production runs (backend/ai/knowing_eye):
    prepare_frame_pair()  -> resize to 640 px wide, bilateral denoise, histogram
                             equalisation (config: backend/ai/config/pipeline.yaml)
    FaceDetector.detect() -> FaceLandmarker (num_faces=3, min conf 0.62) +
                             _is_plausible_face() filter

Matching and scoring protocol: scripts/face_eval_common.py (shared with the
fine-tuned detectors). Speed is mean CPU time per image on this machine (no GPU).

Usage (from the repo root, backend venv - it has mediapipe):
    backend\\venv\\Scripts\\python.exe scripts\\eval_mediapipe_face_test.py

Writes figures/mediapipe_eval/{summary.json, per_image.csv}.
"""

from __future__ import annotations

import json
import platform
import sys
import time

import cv2
import numpy as np
import yaml

from face_eval_common import (
    REPO_ROOT, SPLIT_DIR, WARMUP_IMAGES, load_test_manifest, score_image, summarize, write_per_image,
)

sys.path.insert(0, str(REPO_ROOT / "backend"))

from ai.knowing_eye.detection.face_detector import FaceDetector  # noqa: E402
from ai.knowing_eye.preprocessing.frame import prepare_frame_pair  # noqa: E402

PIPELINE_YAML = REPO_ROOT / "backend" / "ai" / "config" / "pipeline.yaml"
OUT_DIR = REPO_ROOT / "figures" / "mediapipe_eval"


def main() -> None:
    config = yaml.safe_load(PIPELINE_YAML.read_text())
    manifest = load_test_manifest()

    detector = FaceDetector()
    assert detector.backend == "mediapipe", f"production backend not loaded: {detector.backend}"

    rows, det_ms, prep_ms = [], [], []
    for i, rec in enumerate(manifest):
        img = cv2.imread(str(SPLIT_DIR / "images" / "test" / rec["image"]))
        t0 = time.perf_counter()
        _, frame = prepare_frame_pair(img, config)
        t1 = time.perf_counter()
        faces = detector.detect(frame)
        t2 = time.perf_counter()
        if i >= WARMUP_IMAGES:
            prep_ms.append((t1 - t0) * 1000)
            det_ms.append((t2 - t1) * 1000)

        h, w = frame.shape[:2]
        preds = [(x, y, x + bw, y + bh) for (x, y, bw, bh) in (f.bbox for f in faces)]
        rows.append(score_image(rec, preds, w, h))
        if (i + 1) % 50 == 0:
            print(f"{i + 1}/{len(manifest)}")
    detector.close()

    summary = {
        "detector": "MediaPipe Face Landmarker (BlazeFace short-range detector), production config",
        **summarize(rows),
        "speed_cpu": {
            "cpu": platform.processor() or platform.machine(),
            "detect_ms_mean": round(float(np.mean(det_ms)), 2),
            "preprocess_ms_mean": round(float(np.mean(prep_ms)), 2),
            "fps_detect_only": round(1000 / float(np.mean(det_ms)), 1),
            "fps_end_to_end": round(1000 / float(np.mean(det_ms) + np.mean(prep_ms)), 1),
            "images_timed": len(det_ms),
        },
        "pipeline_config": {k: config[k] for k in ("preprocessing", "detection")},
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2))
    write_per_image(rows, OUT_DIR / "per_image.csv")
    print(json.dumps({k: summary[k] for k in ("all_faces", "in_domain", "speed_cpu")}, indent=2))


if __name__ == "__main__":
    main()
