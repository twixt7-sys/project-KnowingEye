"""Convert the official WIDER FACE ground-truth annotations to YOLO format
and lay out a combined face-detection dataset (WIDER + fddb_dataset_YOLO)
ready to zip up and train on in Google Colab.

Usage:
    1. Download "wider_face_split.zip" from the official WIDER FACE page:
       http://shuoyang1213.me/WIDERFACE/  ->  Download -> "Face annotations"
       and place it at datasets/WIDER/wider_face_split.zip
       (or pass --annotations path/to/wider_face_split.zip)

    2. Run:
       python scripts/prepare_wider_face.py

This only converts annotations for the WIDER categories you actually have
images for locally (it skips any bbox line whose image isn't found on disk),
so it works fine with a partial WIDER download.
"""

from __future__ import annotations

import argparse
import shutil
import zipfile
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
WIDER_DIR = REPO_ROOT / "datasets" / "WIDER"
FDDB_DIR = REPO_ROOT / "datasets" / "fddb_dataset_YOLO"
OUT_DIR = REPO_ROOT / "datasets" / "WIDER_yolo"
COMBINED_YAML = REPO_ROOT / "datasets" / "face_dataset.yaml"

SPLITS = {
    "train": ("WIDER_train", "wider_face_train_bbx_gt.txt"),
    "val": ("WIDER_val", "wider_face_val_bbx_gt.txt"),
}


def parse_bbx_gt(gt_path: Path):
    """Yield (relative_image_path, [(x, y, w, h, invalid), ...]) from a WIDER bbx_gt file."""
    lines = gt_path.read_text().splitlines()
    i = 0
    while i < len(lines):
        rel_path = lines[i].strip()
        if not rel_path:
            i += 1
            continue
        i += 1
        count = int(lines[i].strip())
        i += 1
        boxes = []
        n = max(count, 1)  # WIDER writes one placeholder line even when count == 0
        for j in range(n):
            parts = lines[i + j].split()
            x, y, w, h = (int(parts[k]) for k in range(4))
            invalid = int(parts[7]) if len(parts) > 7 else 0
            if count > 0:
                boxes.append((x, y, w, h, invalid))
        i += n
        yield rel_path, boxes


def convert_split(split: str, folder_name: str, gt_filename: str, annotations_dir: Path) -> int:
    src_images_root = WIDER_DIR / folder_name
    gt_path = annotations_dir / gt_filename
    if not gt_path.exists():
        print(f"  [skip] {gt_filename} not found in {annotations_dir}")
        return 0

    out_images = OUT_DIR / "images" / split
    out_labels = OUT_DIR / "labels" / split
    out_images.mkdir(parents=True, exist_ok=True)
    out_labels.mkdir(parents=True, exist_ok=True)

    written = 0
    for rel_path, boxes in parse_bbx_gt(gt_path):
        src_image = src_images_root / rel_path
        if not src_image.exists():
            continue  # category not downloaded locally, skip

        with Image.open(src_image) as im:
            img_w, img_h = im.size

        yolo_lines = []
        for x, y, w, h, invalid in boxes:
            if invalid or w <= 0 or h <= 0:
                continue
            cx = (x + w / 2) / img_w
            cy = (y + h / 2) / img_h
            nw = w / img_w
            nh = h / img_h
            if not (0 < cx < 1 and 0 < cy < 1):
                continue
            yolo_lines.append(f"0 {cx:.6f} {cy:.6f} {min(nw,1):.6f} {min(nh,1):.6f}")

        stem = src_image.stem
        dest_image = out_images / f"{stem}.jpg"
        if not dest_image.exists():
            shutil.copy2(src_image, dest_image)
        (out_labels / f"{stem}.txt").write_text("\n".join(yolo_lines))
        written += 1

    print(f"  [{split}] converted {written} images -> {out_images}")
    return written


def write_combined_yaml():
    COMBINED_YAML.write_text(
        "# Combined face-detection dataset: WIDER FACE (converted) + fddb_dataset_YOLO\n"
        "# `path` is the folder that contains both dataset subfolders below.\n"
        "# On Colab, set it to wherever you extract the uploaded datasets/ zip, e.g.\n"
        "# path: /content/drive/MyDrive/knowing-eye-datasets\n"
        f"path: {REPO_ROOT / 'datasets'}\n"
        "train:\n"
        "  - WIDER_yolo/images/train\n"
        "  - fddb_dataset_YOLO/images/train\n"
        "val:\n"
        "  - WIDER_yolo/images/val\n"
        "  - fddb_dataset_YOLO/images/val\n"
        "nc: 1\n"
        "names: ['face']\n"
    )
    print(f"\nWrote combined dataset config -> {COMBINED_YAML}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--annotations",
        type=Path,
        default=WIDER_DIR / "wider_face_split.zip",
        help="Path to the official wider_face_split.zip (or an already-extracted folder)",
    )
    args = parser.parse_args()

    ann_path = args.annotations
    if not ann_path.exists():
        raise SystemExit(
            f"Annotation source not found: {ann_path}\n"
            "Download 'wider_face_split.zip' from http://shuoyang1213.me/WIDERFACE/ "
            "(Download -> Face annotations) and save it there, or pass --annotations."
        )

    if ann_path.is_dir():
        annotations_dir = ann_path
    else:
        extract_dir = WIDER_DIR / "_annotations_extracted"
        with zipfile.ZipFile(ann_path) as zf:
            zf.extractall(extract_dir)
        # the zip usually contains a top-level "wider_face_split" folder
        nested = extract_dir / "wider_face_split"
        annotations_dir = nested if nested.exists() else extract_dir

    total = 0
    for split, (folder_name, gt_filename) in SPLITS.items():
        print(f"Converting {split}...")
        total += convert_split(split, folder_name, gt_filename, annotations_dir)

    if total == 0:
        raise SystemExit("No images were converted - check that datasets/WIDER images are present.")

    write_combined_yaml()
    print(f"\nDone. {total} WIDER images converted to YOLO format in {OUT_DIR}")
    print("Next: zip up datasets/WIDER_yolo, datasets/fddb_dataset_YOLO and "
          "datasets/face_dataset.yaml and upload to Google Drive for the Colab notebook.")


if __name__ == "__main__":
    main()
