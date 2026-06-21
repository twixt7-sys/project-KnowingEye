#!/usr/bin/env python3
"""Fine-tune YOLOv8 for exam proctoring objects (face, phone, posture cues)."""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data",
        type=Path,
        default=Path("ai/training/data/dataset.yaml"),
        help="Ultralytics dataset YAML",
    )
    parser.add_argument("--model", default="yolov8n.pt", help="Base checkpoint")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--device", default="", help="cuda device id or cpu")
    args = parser.parse_args()

    if not args.data.exists():
        raise SystemExit(
            f"Dataset config not found: {args.data}\n"
            "Copy ai/training/data/dataset.yaml.example and prepare labels first."
        )

    from ultralytics import YOLO

    model = YOLO(args.model)
    results = model.train(
        data=str(args.data),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device or None,
        project="ai/training/runs",
        name="knowing_eye_proctor",
    )
    print("Training complete. Best weights:", results.save_dir)


if __name__ == "__main__":
    main()
