"""Re-split the combined face-detection pool (WIDER_yolo + fddb_dataset_YOLO)
into a 70/20/10 train/validation/test split, ready to zip up for Colab.

Why: the original layout is 80/20 train/val with no test set, so every
reported metric came from the same images used for early stopping and
best-epoch selection. This builds a test partition that training never sees.

    train (70%) - fits the weights
    val   (20%) - early stopping + best.pt selection (seen indirectly)
    test  (10%) - evaluated ONCE after training; the numbers to report

What it does:
    1. Pools every labelled image from both datasets' existing train+val.
    2. Drops exact duplicate images (same bytes), keeping the first copy, so
       one picture can't land on both sides of a split.
    3. Validates every label line (class 0, 4 coords in [0, 1]).
    4. Splits each stratum separately with a fixed seed - one stratum per
       WIDER event category, one for FDDB - so every split has the same mix of
       sources/scenes.
    5. Copies into datasets/face_split_70_20_10/{images,labels}/{train,val,test}
       and writes face_split.yaml, split_manifest.csv and split_report.md.

Usage (from the repo root):
    python scripts/split_face_dataset.py            # build the split
    python scripts/split_face_dataset.py --zip      # ...and zip it for Drive
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import random
import shutil
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATASETS = REPO_ROOT / "datasets"
SOURCES = {
    "WIDER": DATASETS / "WIDER_yolo",
    "FDDB": DATASETS / "fddb_dataset_YOLO",
}
OUT_DIR = DATASETS / "face_split_70_20_10"
RATIOS = {"train": 0.70, "val": 0.20, "test": 0.10}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def stratum_of(source: str, stem: str) -> str:
    # WIDER file names start with the event id ("13_Interview_..."); FDDB is one stratum.
    return f"WIDER-{stem.split('_', 1)[0]}" if source == "WIDER" else "FDDB"


def validate_label(path: Path) -> int:
    """Return the number of boxes, raising on any malformed line."""
    boxes = 0
    for n, line in enumerate(path.read_text().splitlines(), 1):
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) != 5 or parts[0] != "0":
            raise ValueError(f"{path}:{n}: expected 'class x y w h' with class 0, got {line!r}")
        if not all(0.0 <= float(v) <= 1.0 for v in parts[1:]):
            raise ValueError(f"{path}:{n}: coordinates outside [0, 1]: {line!r}")
        boxes += 1
    return boxes


def collect():
    items, seen, dropped = [], {}, []
    for source, root in SOURCES.items():
        for original_split in ("train", "val"):
            for image in sorted((root / "images" / original_split).iterdir()):
                if image.suffix.lower() not in IMAGE_EXT:
                    continue
                label = root / "labels" / original_split / f"{image.stem}.txt"
                if not label.exists():
                    raise FileNotFoundError(f"No label for {image}")
                digest = hashlib.md5(image.read_bytes()).hexdigest()
                if digest in seen:
                    dropped.append((image, seen[digest]))
                    continue
                seen[digest] = image
                items.append({
                    "image": image,
                    "label": label,
                    "source": source,
                    "stratum": stratum_of(source, image.stem),
                    "original_split": original_split,
                    "faces": validate_label(label),
                })
    return items, dropped


def assign_splits(items, seed: int):
    by_stratum = defaultdict(list)
    for item in items:
        by_stratum[item["stratum"]].append(item)
    rng = random.Random(seed)
    for stratum in sorted(by_stratum):
        group = sorted(by_stratum[stratum], key=lambda i: i["image"].name)
        rng.shuffle(group)
        n_test = round(len(group) * RATIOS["test"])
        n_val = round(len(group) * RATIOS["val"])
        for i, item in enumerate(group):
            item["split"] = "test" if i < n_test else "val" if i < n_test + n_val else "train"


def write_output(items):
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    names = set()
    for item in items:
        name = item["image"].name
        if name in names:
            raise ValueError(f"File name collision across sources: {name}")
        names.add(name)
        for kind, src in (("images", item["image"]), ("labels", item["label"])):
            dest = OUT_DIR / kind / item["split"] / src.name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)

    (OUT_DIR / "face_split.yaml").write_text(
        "# Face detection - WIDER FACE (3 event categories) + FDDB, re-split 70/20/10.\n"
        "# Built by scripts/split_face_dataset.py. On Colab the notebook rewrites `path`.\n"
        f"path: {OUT_DIR.as_posix()}\n"
        "train: images/train\n"
        "val: images/val\n"
        "test: images/test\n"
        "nc: 1\n"
        "names: ['face']\n"
    )

    with (OUT_DIR / "split_manifest.csv").open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["image", "source", "stratum", "original_split", "split", "faces"])
        for item in sorted(items, key=lambda i: (i["split"], i["image"].name)):
            writer.writerow([item["image"].name, item["source"], item["stratum"],
                             item["original_split"], item["split"], item["faces"]])


def report(items, dropped, seed: int) -> str:
    splits = list(RATIOS)
    strata = sorted({i["stratum"] for i in items})
    count = defaultdict(lambda: [0, 0])  # (stratum, split) -> [images, faces]
    for item in items:
        for key in ((item["stratum"], item["split"]), ("ALL", item["split"]), (item["stratum"], "ALL"), ("ALL", "ALL")):
            count[key][0] += 1
            count[key][1] += item["faces"]

    total = count[("ALL", "ALL")][0]
    lines = [
        "# Face dataset - 70/20/10 split report",
        "",
        f"Built by `scripts/split_face_dataset.py` (seed {seed}). "
        f"{total} unique images after dropping {len(dropped)} exact duplicate(s).",
        "",
        "| Stratum | " + " | ".join(f"{s} images (faces)" for s in splits) + " | total |",
        "|---|" + "---|" * (len(splits) + 1),
    ]
    for stratum in strata + ["ALL"]:
        cells = [f"{count[(stratum, s)][0]} ({count[(stratum, s)][1]})" for s in splits]
        lines.append(f"| {stratum} | " + " | ".join(cells) + f" | {count[(stratum, 'ALL')][0]} ({count[(stratum, 'ALL')][1]}) |")
    shares = " / ".join(f"{100 * count[('ALL', s)][0] / total:.1f}%" for s in splits)
    lines += ["", f"Actual image share train / val / test: {shares}"]
    if dropped:
        lines += ["", "Dropped duplicates (dropped -> kept):"]
        lines += [f"- `{d.relative_to(DATASETS).as_posix()}` -> `{k.relative_to(DATASETS).as_posix()}`" for d, k in dropped]
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--zip", action="store_true", help="Also write datasets/face_split_70_20_10.zip")
    args = parser.parse_args()

    items, dropped = collect()
    assign_splits(items, args.seed)
    write_output(items)
    text = report(items, dropped, args.seed)
    (OUT_DIR / "split_report.md").write_text(text)
    print(text)
    print(f"Wrote {OUT_DIR}")

    if args.zip:
        archive = shutil.make_archive(str(OUT_DIR), "zip", root_dir=DATASETS, base_dir=OUT_DIR.name)
        print(f"Wrote {archive}")


if __name__ == "__main__":
    main()
