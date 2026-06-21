#!/usr/bin/env python3
"""
Prepare YOLO training dataset from mock exam recordings.

Expected layout after running:
  ai/training/data/
    images/train/, images/val/
    labels/train/, labels/val/

Label format (YOLO): class_id x_center y_center width height (normalized 0-1)
Classes (default):
  0 = face
  1 = bad_posture_region
  2 = cell_phone
"""

from __future__ import annotations

import argparse
import random
import shutil
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Split raw captures into YOLO train/val folders")
    parser.add_argument(
        "raw_dir",
        type=Path,
        help="Folder with images/ and labels/ subdirs (or images only for manual labeling)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("ai/training/data"),
        help="Output dataset root",
    )
    parser.add_argument("--val-ratio", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    images_src = args.raw_dir / "images"
    labels_src = args.raw_dir / "labels"
    if not images_src.exists():
        raise SystemExit(f"Missing {images_src}")

    images = sorted(images_src.glob("*.*"))
    random.seed(args.seed)
    random.shuffle(images)
    n_val = max(1, int(len(images) * args.val_ratio))
    val_set = set(images[:n_val])

    for split, subset in [("train", [i for i in images if i not in val_set]), ("val", list(val_set))]:
        img_dst = args.out / "images" / split
        lbl_dst = args.out / "labels" / split
        img_dst.mkdir(parents=True, exist_ok=True)
        lbl_dst.mkdir(parents=True, exist_ok=True)
        for img in subset:
            shutil.copy2(img, img_dst / img.name)
            lbl = labels_src / f"{img.stem}.txt"
            if lbl.exists():
                shutil.copy2(lbl, lbl_dst / lbl.name)
            else:
                (lbl_dst / f"{img.stem}.txt").write_text("", encoding="utf-8")

    print(f"Prepared {len(images)} images -> {args.out}")
    print("Annotate missing labels before training (see ai/training/TRAINING.md).")


if __name__ == "__main__":
    main()
