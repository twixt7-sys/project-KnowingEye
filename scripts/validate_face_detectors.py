"""Reproduce the face-detector comparison metrics locally (CPU) from the
already-trained weights in figures/trained_algos/.

Runs Ultralytics' standard validation protocol (IoU-matched TP/FP/FN ->
Precision/Recall -> PR-curve area = mAP) against datasets/face_dataset.yaml,
the same dataset all three models were trained on, then a separate inference
pass to compute mean detection confidence.

This machine has only 8 GB RAM, most of it already in use, so each model
runs in its OWN subprocess (--only <name>) so the OS fully reclaims memory
between models; within a model, the val() and predict() phases are also
separated by an explicit model reload + gc.collect() so predict() doesn't
inherit whatever val() left cached.

Usage:
    pip install ultralytics
    python scripts/validate_face_detectors.py
"""

from __future__ import annotations

import argparse
import gc
import json
import subprocess
import sys
from pathlib import Path

import pandas as pd
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
WEIGHTS_DIR = REPO_ROOT / "figures" / "trained_algos"
DATA_YAML = REPO_ROOT / "datasets" / "face_dataset.yaml"
RESULTS_DIR = WEIGHTS_DIR / "_validation_partial"

MODELS = [
    ("yolov8n", WEIGHTS_DIR / "yolov8n_best.pt", "yolo"),
    ("yolo11n", WEIGHTS_DIR / "yolo11n_best.pt", "yolo"),
    ("rtdetr-l", WEIGHTS_DIR / "rtdetr-l_best.pt", "rtdetr"),
]


def _model_class(kind: str):
    from ultralytics import RTDETR, YOLO
    return RTDETR if kind == "rtdetr" else YOLO


def _resolve_val_images() -> list[str]:
    """All validation image paths from every dataset listed under `val` in the yaml."""
    with open(DATA_YAML) as f:
        cfg = yaml.safe_load(f)
    base = Path(cfg["path"])
    val_entries = cfg["val"] if isinstance(cfg["val"], list) else [cfg["val"]]
    image_paths: list[str] = []
    for entry in val_entries:
        image_paths.extend(str(p) for p in sorted((base / entry).glob("*.jpg")))
    return image_paths


def run_one(name: str, weights_path: Path, kind: str) -> dict:
    Cls = _model_class(kind)

    print(f"\n{'='*60}\nValidating {name} (phase 1/2: val)\n{'='*60}", flush=True)
    model = Cls(str(weights_path))
    metrics = model.val(data=str(DATA_YAML), imgsz=640, batch=8, device="cpu")
    map50 = float(metrics.box.map50)
    map5095 = float(metrics.box.map)
    p = float(metrics.box.mp)
    r = float(metrics.box.mr)
    f1 = (2 * p * r / (p + r)) if (p + r) else 0.0

    # Drop every reference to the val-phase model/metrics before starting
    # predict() so its memory is actually released on this 8GB machine.
    del model, metrics
    gc.collect()

    print(f"\n{'='*60}\nValidating {name} (phase 2/2: confidence)\n{'='*60}", flush=True)
    confidences: list[float] = []
    try:
        model = Cls(str(weights_path))
        val_image_paths = _resolve_val_images()
        # Chunk manually: passing the full 804-image list straight to predict()
        # was silently ignoring batch=1 and stacking ALL images into one
        # tensor (640*640*3*4 bytes * 804 = 3.95 GB -> OOM on this 8 GB box).
        # Small explicit chunks keep peak memory bounded regardless of what
        # the dataloader does internally.
        CHUNK = 8
        for i in range(0, len(val_image_paths), CHUNK):
            chunk = val_image_paths[i : i + CHUNK]
            results = model.predict(
                source=chunk, conf=0.25, imgsz=640,
                device="cpu", verbose=False,
            )
            for r_pred in results:
                if r_pred.boxes is not None and len(r_pred.boxes):
                    confidences.extend(r_pred.boxes.conf.tolist())
            del results
        del model
        gc.collect()
    except Exception as e:
        print(f"[{name}] confidence phase failed, keeping val metrics only: {e}")

    mean_conf = (sum(confidences) / len(confidences)) if confidences else 0.0

    return {
        "model": name,
        "mAP50 (%)": round(map50 * 100, 2),
        "mAP50-95 (%)": round(map5095 * 100, 2),
        "Precision (%)": round(p * 100, 2),
        "Recall (%)": round(r * 100, 2),
        "F1 (%)": round(f1 * 100, 2),
        "Mean Confidence (%)": round(mean_conf * 100, 2) if confidences else None,
        "Detections (n)": len(confidences),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="Internal: run a single model by name in this process")
    args = parser.parse_args()

    if args.only:
        name, weights_path, kind = next(m for m in MODELS if m[0] == args.only)
        row = run_one(name, weights_path, kind)
        RESULTS_DIR.mkdir(parents=True, exist_ok=True)
        (RESULTS_DIR / f"{name}.json").write_text(json.dumps(row))
        print(f"\n[{name}] -> {row}")
        return

    # Orchestrator: one subprocess per model so the OS reclaims memory in full.
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    for name, weights_path, _kind in MODELS:
        if not weights_path.exists():
            print(f"[skip] {weights_path} not found")
            continue
        result_file = RESULTS_DIR / f"{name}.json"
        if result_file.exists():
            print(f"[skip] {name} already validated -> {result_file}")
            continue
        print(f"\n########## Spawning subprocess for {name} ##########")
        proc = subprocess.run([sys.executable, __file__, "--only", name])
        if proc.returncode != 0:
            print(f"[{name}] subprocess FAILED (exit {proc.returncode}) - continuing with remaining models")

    rows = []
    for name, _weights_path, _kind in MODELS:
        result_file = RESULTS_DIR / f"{name}.json"
        if result_file.exists():
            rows.append(json.loads(result_file.read_text()))
        else:
            rows.append({"model": name, "error": "failed - see console output above"})

    df = pd.DataFrame(rows)
    print("\n" + df.to_string(index=False))
    out_csv = WEIGHTS_DIR / "reproduced_validation_results.csv"
    df.to_csv(out_csv, index=False)
    print(f"\nSaved -> {out_csv}")


if __name__ == "__main__":
    main()
