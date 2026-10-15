"""Derive identity / posture thresholds from your OWN webcam captures.

The CV models (MediaPipe Pose, ArcFace buffalo_l) are used frozen; what needs
tuning to this deployment's cameras, lighting and seating is the *thresholds*.
This script measures the real distributions and prints the numbers to put in
backend/ai/config/pipeline.yaml - the evidence for the "Threshold
justification" table in 03-system-design.html.

Identity - one folder per person, each with images and/or short videos
(several sessions / lighting conditions per person is ideal):

    calib/identity/alice/*.jpg|*.mp4
    calib/identity/bob/...

    python scripts/calibrate_monitoring.py identity calib/identity --target-far 0.001

Posture - frames you labelled by hand as acceptable vs not:

    calib/posture/good/*.jpg|*.mp4   (upright, normal exam posture)
    calib/posture/bad/*.jpg|*.mp4    (leaning out, slumped sideways, ...)

    python scripts/calibrate_monitoring.py posture calib/posture

Run from the repo root with the backend venv
(backend\\venv\\Scripts\\python.exe).
"""

from __future__ import annotations

import argparse
import itertools
import sys
from pathlib import Path

import cv2
import numpy as np

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

from ai.knowing_eye.pipeline import BehaviorPipeline, _largest_face  # noqa: E402
from ai.knowing_eye.recognition.arcface_backend import ArcFaceBackend  # noqa: E402

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
VIDEO_EXT = {".mp4", ".avi", ".mov", ".mkv", ".webm"}


def iter_frames(folder: Path, video_stride: int):
    for path in sorted(folder.rglob("*")):
        ext = path.suffix.lower()
        if ext in IMAGE_EXT:
            img = cv2.imread(str(path))
            if img is not None:
                yield img
        elif ext in VIDEO_EXT:
            cap = cv2.VideoCapture(str(path))
            i = 0
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                if i % video_stride == 0:
                    yield frame
                i += 1
            cap.release()


def rates(genuine: np.ndarray, impostor: np.ndarray, t: float) -> tuple[float, float]:
    """(FRR, FAR) at distance threshold t."""
    return float(np.mean(genuine > t)), float(np.mean(impostor <= t))


def calibrate_identity(args, pipeline: BehaviorPipeline) -> None:
    if pipeline._identity.backend != "arcface":
        sys.exit(
            f"Identity backend is {pipeline._identity.backend!r}, not arcface - "
            "install backend/requirements-identity.txt first."
        )
    people = [d for d in sorted(Path(args.folder).iterdir()) if d.is_dir()]
    if len(people) < 2:
        sys.exit("Need at least two person folders.")

    embeddings: dict[str, list[np.ndarray]] = {}
    skipped = 0
    for person in people:
        embs = []
        for frame in iter_frames(person, args.video_stride):
            raw, prepared = pipeline._prepare(frame)
            face = _largest_face(pipeline._face.detect(prepared))
            # Same quality gate the live pipeline applies before comparing.
            if face is None or not pipeline._identity_quality_ok(face):
                skipped += 1
                continue
            emb = pipeline._identity._arcface.encode_frame(raw, face.bbox)
            if emb is not None:
                embs.append(emb)
        embeddings[person.name] = embs
        print(f"  {person.name}: {len(embs)} usable faces")
    print(f"  ({skipped} frames skipped by the quality gate / no face)")

    dist = ArcFaceBackend.cosine_distance
    genuine = np.array(
        [dist(a, b) for embs in embeddings.values() for a, b in itertools.combinations(embs, 2)]
    )
    impostor = np.array(
        [
            dist(a, b)
            for (_, ea), (_, eb) in itertools.combinations(embeddings.items(), 2)
            for a in ea
            for b in eb
        ]
    )
    if not len(genuine) or not len(impostor):
        sys.exit("Not enough usable faces to form genuine and impostor pairs.")

    def summary(name, arr):
        p = np.percentile(arr, [1, 50, 90, 99])
        print(f"{name:9s} n={len(arr):6d}  p1={p[0]:.3f}  median={p[1]:.3f}  p90={p[2]:.3f}  p99={p[3]:.3f}")

    print()
    summary("genuine", genuine)
    summary("impostor", impostor)

    grid = np.round(np.arange(0.20, 0.91, 0.02), 2)
    frr_far = [(t, *rates(genuine, impostor, t)) for t in grid]
    eer_t = min(frr_far, key=lambda r: abs(r[1] - r[2]))
    ok = [r for r in frr_far if r[2] <= args.target_far]
    print("\nthreshold   FRR      FAR")
    for t, frr, far in frr_far[::2]:
        print(f"  {t:.2f}    {frr:6.2%}  {far:7.3%}")
    print(f"\nEER ~ {eer_t[1]:.2%} at distance {eer_t[0]:.2f}")
    if ok:
        # Among thresholds meeting the FAR target, take those with the lowest
        # FRR and pick the middle of that range - the max-margin point between
        # the two distributions, rather than hugging either edge.
        min_frr = min(r[1] for r in ok)
        tied = [r[0] for r in ok if r[1] == min_frr]
        best_t = float(grid[np.argmin(np.abs(grid - (min(tied) + max(tied)) / 2))])
        frr, far = rates(genuine, impostor, best_t)
        print(
            f"Recommended identity_match_threshold: {best_t:.2f} "
            f"(FAR {far:.3%} <= target {args.target_far:.3%}, FRR {frr:.2%} per single check;"
            " the rolling median lowers the per-session FRR further)"
        )
    else:
        print(f"No threshold on the grid reaches FAR <= {args.target_far:.3%}.")
    if len(impostor) < 3 / args.target_far:
        print(
            f"WARNING: only {len(impostor)} impostor pairs - at least {int(3 / args.target_far)} are "
            f"needed to support a FAR of {args.target_far:.3%} (rule of three). Add more people."
        )


def calibrate_posture(args, pipeline: BehaviorPipeline) -> None:
    root = Path(args.folder)
    data = {}
    for label in ("good", "bad"):
        tilts, leans, missing = [], [], 0
        for frame in iter_frames(root / label, args.video_stride):
            _, prepared = pipeline._prepare(frame)
            res = pipeline._pose.detect(prepared)
            if not res.detected:
                missing += 1
                continue
            tilts.append(res.shoulder_tilt_ratio)
            if res.spine_lean_ratio is not None:
                leans.append(res.spine_lean_ratio)
        data[label] = (np.array(tilts), np.array(leans))
        print(f"  {label}: {len(tilts)} frames with upper body, {missing} without")

    for i, name in enumerate(("posture_shoulder_tilt_max", "posture_spine_lean_max")):
        good, bad = data["good"][i], data["bad"][i]
        if not len(good) or not len(bad):
            print(f"{name}: not enough data")
            continue
        candidates = np.unique(np.concatenate([good, bad]))
        # Threshold that maximises balanced accuracy (good stays under, bad goes over).
        best = max(candidates, key=lambda t: (np.mean(good <= t) + np.mean(bad > t)) / 2)
        print(
            f"\n{name}: good p50={np.median(good):.3f} p95={np.percentile(good, 95):.3f} | "
            f"bad p5={np.percentile(bad, 5):.3f} p50={np.median(bad):.3f}"
        )
        print(
            f"  recommended {best:.3f}: good kept {np.mean(good <= best):.1%}, "
            f"bad caught {np.mean(bad > best):.1%}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", choices=("identity", "posture"))
    parser.add_argument("folder")
    parser.add_argument("--target-far", type=float, default=0.001, help="identity: max false-accept rate")
    parser.add_argument("--video-stride", type=int, default=15, help="use every Nth video frame")
    args = parser.parse_args()

    pipeline = BehaviorPipeline()
    print(f"face={pipeline._face.backend} pose={pipeline._pose.backend} identity={pipeline._identity.backend}")
    try:
        (calibrate_identity if args.mode == "identity" else calibrate_posture)(args, pipeline)
    finally:
        pipeline.close()


if __name__ == "__main__":
    main()
