"""Score the fine-tuned YOLOv8n / YOLO11n / RT-DETR-l face detectors on the
70/20/10 TEST split with the same matching and scoring code as the production
MediaPipe detector (scripts/face_eval_common.py), so the four detectors can be
compared like for like - including on the BlazeFace model-card domain
(face sides >= 15% of the image), which the Ultralytics test report never measured.

Fixed operating point (chosen before the first run): conf >= 0.25 and NMS IoU 0.7
(Ultralytics predict defaults - the same conf the test report used for its
TP/FP/FN and Detections columns), imgsz 640, raw images as in training/testing,
CPU, one image at a time.

The weights must be the 70/20/10 run's best.pt files (MyDrive/knowing-eye-70-20-10/
<model>/best.pt). The older figures/trained_algos/*.pt come from the 80/20 run,
whose training set overlaps this test split - do not use them here.

Usage (any Python with ultralytics):
    python scripts/eval_finetuned_face_test.py --weights-dir <folder with yolov8n/, yolo11n/, rtdetr-l/>

Writes figures/finetuned_eval/{summary.json, <model>_per_image.csv}.
"""

from __future__ import annotations

import argparse
import gc
import json
import time
from pathlib import Path

import cv2
import numpy as np
import torch

from face_eval_common import (
    REPO_ROOT, SPLIT_DIR, WARMUP_IMAGES, load_test_manifest, score_image, summarize, write_per_image,
)

OUT_DIR = REPO_ROOT / "figures" / "finetuned_eval"
MODELS = ["yolov8n", "yolo11n", "rtdetr-l"]
CONF, NMS_IOU, IMGSZ = 0.25, 0.7, 640


def evaluate(name: str, weights: Path, manifest: list[dict]) -> dict:
    from ultralytics import RTDETR, YOLO

    model = (RTDETR if name.startswith("rtdetr") else YOLO)(str(weights))
    rows, ms = [], []
    for i, rec in enumerate(manifest):
        img = cv2.imread(str(SPLIT_DIR / "images" / "test" / rec["image"]))
        t0 = time.perf_counter()
        res = model.predict(img, conf=CONF, iou=NMS_IOU, imgsz=IMGSZ, device="cpu", verbose=False)[0]
        if i >= WARMUP_IMAGES:
            ms.append((time.perf_counter() - t0) * 1000)
        preds = [tuple(b) for b in res.boxes.xyxy.cpu().numpy().tolist()]
        h, w = img.shape[:2]
        rows.append(score_image(rec, preds, w, h))
        if (i + 1) % 100 == 0:
            print(f"  [{name}] {i + 1}/{len(manifest)}", flush=True)
    write_per_image(rows, OUT_DIR / f"{name}_per_image.csv")
    summary = summarize(rows)
    summary["speed_cpu"] = {"ms_mean": round(float(np.mean(ms)), 2),
                            "fps": round(1000 / float(np.mean(ms)), 1), "images_timed": len(ms)}
    del model
    gc.collect()
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights-dir", type=Path, required=True)
    parser.add_argument("--only", nargs="*", default=MODELS)
    args = parser.parse_args()

    # This laptop has ~8 GB RAM; oneDNN's conv primitives fail to allocate under memory
    # pressure ("could not create a primitive"), so use the plain CPU kernels.
    torch.backends.mkldnn.enabled = False
    manifest = load_test_manifest()

    out_path = OUT_DIR / "summary.json"
    results = json.loads(out_path.read_text()) if out_path.exists() else {}
    for name in args.only:
        print(f"evaluating {name}", flush=True)
        results[name] = {"weights": str(args.weights_dir / name / "best.pt"),
                         "conf": CONF, "nms_iou": NMS_IOU, "imgsz": IMGSZ,
                         **evaluate(name, args.weights_dir / name / "best.pt", manifest)}
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(results, indent=2))   # save after each model
        r = results[name]
        print(f"  all faces: {r['all_faces']}\n  in domain: {r['in_domain']}\n  cpu: {r['speed_cpu']}", flush=True)


if __name__ == "__main__":
    main()
