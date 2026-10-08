"""Scoring shared by the face-detector test-split evaluations, so every detector
is matched and scored by the same code:

    scripts/eval_mediapipe_face_test.py   - production MediaPipe (BlazeFace)
    scripts/eval_finetuned_face_test.py   - fine-tuned YOLOv8n / YOLO11n / RT-DETR-l

Protocol (fixed before the first run - do not change it after seeing results):
    * Matching: one-to-one greedy by IoU, a prediction is a TP if IoU >= 0.5.
    * Precision = TP/(TP+FP), Recall = TP/(TP+FN), F1 = 2PR/(P+R),
      Accuracy = TP/(TP+FP+FN) - the same definitions as the YOLO test table.
    * PRIMARY result: every annotated face.
    * SECONDARY result: the operating domain stated in Google's BlazeFace
      (short-range) model card - face box sides >= 15% of the image sides
      (its evaluation Datasets I-III). Faces outside that domain are marked
      "ignore": they are neither FN when missed nor FP when detected.
    * Breakdown by data source (FDDB, WIDER-13/16/29).
"""

from __future__ import annotations

import csv
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SPLIT_DIR = REPO_ROOT / "datasets" / "face_split_70_20_10"

IOU_THRESHOLD = 0.5
DOMAIN_MIN_SIDE_FRAC = 0.15   # BlazeFace short-range model card, evaluation Datasets I-III
WARMUP_IMAGES = 3


def load_test_manifest() -> list[dict]:
    with (SPLIT_DIR / "split_manifest.csv").open(newline="") as f:
        manifest = [r for r in csv.DictReader(f) if r["split"] == "test"]
    assert len(manifest) == 402, f"expected 402 test images, got {len(manifest)}"
    return manifest


def iou(a, b) -> float:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    iw = max(0.0, min(ax1, bx1) - max(ax0, bx0))
    ih = max(0.0, min(ay1, by1) - max(ay0, by0))
    inter = iw * ih
    union = (ax1 - ax0) * (ay1 - ay0) + (bx1 - bx0) * (by1 - by0) - inter
    return inter / union if union > 0 else 0.0


def match(preds, gts, ignore):
    """Greedy one-to-one IoU matching. Returns (tp, fp, fn) with ignore-region handling."""
    pairs = sorted(
        ((iou(p, g), pi, gi) for pi, p in enumerate(preds) for gi, g in enumerate(gts)),
        reverse=True,
    )
    used_p, used_g = set(), set()
    # Pass 1: match to faces that count.
    for v, pi, gi in pairs:
        if v < IOU_THRESHOLD:
            break
        if pi in used_p or gi in used_g or ignore[gi]:
            continue
        used_p.add(pi)
        used_g.add(gi)
    tp = len(used_p)
    # Pass 2: leftover predictions that land on an ignored face are not false positives.
    absorbed = set()
    for v, pi, gi in pairs:
        if v < IOU_THRESHOLD:
            break
        if pi in used_p or pi in absorbed or gi in used_g or not ignore[gi]:
            continue
        absorbed.add(pi)
        used_g.add(gi)
    fp = len(preds) - tp - len(absorbed)
    fn = sum(1 for gi in range(len(gts)) if not ignore[gi] and gi not in used_g)
    return tp, fp, fn


def scores(tp: int, fp: int, fn: int) -> dict:
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * p * r / (p + r) if p + r else 0.0
    acc = tp / (tp + fp + fn) if tp + fp + fn else 0.0
    return {
        "Accuracy (%)": round(acc * 100, 2), "Precision (%)": round(p * 100, 2),
        "Recall (%)": round(r * 100, 2), "F1 (%)": round(f1 * 100, 2),
        "TP": tp, "FP": fp, "FN": fn, "Faces counted": tp + fn,
    }


def load_gt(image_name: str, w: int, h: int):
    """Ground-truth boxes (x0, y0, x1, y1) in pixels of a w x h image, plus in-domain flags."""
    label_path = SPLIT_DIR / "labels" / "test" / (Path(image_name).stem + ".txt")
    boxes, in_domain = [], []
    if label_path.exists():
        for line in label_path.read_text().split("\n"):
            parts = line.split()
            if len(parts) != 5:
                continue
            _, cx, cy, bw, bh = map(float, parts)
            boxes.append(((cx - bw / 2) * w, (cy - bh / 2) * h, (cx + bw / 2) * w, (cy + bh / 2) * h))
            in_domain.append(bw >= DOMAIN_MIN_SIDE_FRAC and bh >= DOMAIN_MIN_SIDE_FRAC)
    return boxes, in_domain


def score_image(rec: dict, preds, w: int, h: int) -> dict:
    """Per-image row: counts for all faces and for the model-card domain."""
    gts, in_domain = load_gt(rec["image"], w, h)
    a_tp, a_fp, a_fn = match(preds, gts, [False] * len(gts))
    d_tp, d_fp, d_fn = match(preds, gts, [not d for d in in_domain])
    return {
        "image": rec["image"], "stratum": rec["stratum"], "gt_faces": len(gts),
        "gt_in_domain": sum(in_domain), "detections": len(preds),
        "tp_all": a_tp, "fp_all": a_fp, "fn_all": a_fn,
        "tp_domain": d_tp, "fp_domain": d_fp, "fn_domain": d_fn,
    }


def summarize(rows: list[dict]) -> dict:
    assert sum(r["gt_faces"] for r in rows) == 1005, "expected 1,005 annotated test faces"

    def total(subset, kind):
        return scores(*(sum(r[f"{k}_{kind}"] for r in subset) for k in ("tp", "fp", "fn")))

    strata = sorted({r["stratum"] for r in rows}, key=lambda s: (s != "FDDB", s))
    return {
        "split": "test (70/20/10, seed 42)", "images": len(rows),
        "faces_total": sum(r["gt_faces"] for r in rows),
        "faces_in_domain": sum(r["gt_in_domain"] for r in rows),
        "images_with_in_domain_face": sum(1 for r in rows if r["gt_in_domain"]),
        "detections": sum(r["detections"] for r in rows),
        "iou_threshold": IOU_THRESHOLD, "domain_min_side_frac": DOMAIN_MIN_SIDE_FRAC,
        "all_faces": total(rows, "all"),
        "in_domain": total(rows, "domain"),
        "by_stratum": {
            s: {"images": sum(1 for r in rows if r["stratum"] == s),
                "all_faces": total([r for r in rows if r["stratum"] == s], "all"),
                "in_domain": total([r for r in rows if r["stratum"] == s], "domain")}
            for s in strata
        },
    }


def write_per_image(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
