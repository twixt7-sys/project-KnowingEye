"""Record webcam frames for Knowing Eye's own face-detection data set.

Why: the WIDER FACE + FDDB data is mostly crowd photos with tiny faces, which is not what Knowing Eye sees. This
records data that matches the deployment: one examinee at a laptop webcam, in the situations the proctoring system
has to handle (looking down, head turned, dim light, a second person, an empty seat, ...).

`scripts/label_webcam_faces.py --pack` later puts every person, as a whole, into one split: test people only ever
score the models (notebooks/eval_webcam_test.ipynb, once); train and val people fine-tune BlazeFace
(notebooks/finetune_blazeface_webcam.ipynb). A person's frames never end up in two splits - frames a second
apart are near-copies, so that would leak the test set into training.

The test set is only honest if nothing about it is chosen by looking at detector output, so:
    * frames are saved on a timer, never hand-picked;
    * scripts/label_webcam_faces.py draws the ground truth by hand and never runs a detector;
    * the split is drawn at random with a fixed seed and never changed afterwards.

Per participant this:
    1. Records consent in participants.csv (an ID, never a name). Nobody is recorded without it. Anyone else
       who appears in a frame (the "second_person" condition) must agree too.
    2. Walks through CONDITIONS. Each one's instruction is shown on the preview; SPACE starts a 3 s countdown,
       then --frames frames are saved --interval seconds apart. The preview is mirrored and annotated; the
       saved frames are exactly what the camera delivers, at the app's 640x480 by default.
    3. Writes datasets/webcam/images/<participant>_<condition>_<nn>.jpg and appends to capture_log.csv.
       Conditions already recorded for a participant are skipped, so an interrupted session resumes.

Aim for about 15 different people - roughly 5 end up in the test set (the scoring notebook needs 5+ for
participant-level confidence intervals), the rest train and validate the fine-tuning - with a mix of skin tones,
glasses / no glasses and hair, and more than one camera or room if you can. Record everyone before packing.

Usage (from the repo root):
    python scripts/capture_webcam_faces.py --participant P01
    python scripts/capture_webcam_faces.py --participant P02 --camera 1 --notes "glasses"

Keys in the preview window: SPACE record this condition, S skip it, R redo the previous one, Q quit.
"""

from __future__ import annotations

import argparse
import csv
import math
import re
import sys
import textwrap
import time
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "datasets" / "webcam"
IMAGES = OUT_DIR / "images"
CAPTURE_LOG = OUT_DIR / "capture_log.csv"
PARTICIPANTS = OUT_DIR / "participants.csv"
LOG_FIELDS = ["file", "participant", "condition", "frame", "captured_at", "width", "height", "camera"]
PARTICIPANT_FIELDS = ["participant", "consent", "first_recorded", "notes"]
WINDOW = "Knowing Eye - webcam test capture"
COUNTDOWN_S = 3.0

# (condition, instruction). The situations a proctoring face detector has to get right.
CONDITIONS = [
    ("frontal", "Sit normally and look at the screen."),
    ("reading", "Look down at the desk as if reading or writing on paper."),
    ("turn_left", "Turn your head to your left, about 45 degrees."),
    ("turn_right", "Turn your head to your right, about 45 degrees."),
    ("look_up", "Look up, above the screen."),
    ("far", "Sit back as far as you would during a long exam (about 1 m)."),
    ("near", "Lean in close to the screen."),
    ("hand_on_face", "Rest your chin or cheek on your hand, partly covering your mouth."),
    ("phone", "Hold a phone up near your face as if using it."),
    ("moving", "Move naturally in your seat - shift, stretch, tilt your head."),
    ("dim_light", "Dim the room lights (the screen may still light your face)."),
    ("backlit", "Put a bright lamp or window behind you."),
    ("second_person", "A second person (who has also agreed) appears in view behind you."),
    ("empty_seat", "Leave the seat - nobody in view."),
]


def read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, fields: list[str], rows: list[dict]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fields)
        writer.writeheader()
        writer.writerows(rows)


def ensure_consent(participant: str, notes: str) -> bool:
    rows = read_csv(PARTICIPANTS)
    if any(r["participant"] == participant for r in rows):
        return True
    answer = input(
        f"Has {participant} agreed to be recorded, and to have these frames used to test face detectors for the "
        "Knowing Eye study? [y/N] "
    )
    if answer.strip().lower() not in ("y", "yes"):
        return False
    rows.append({"participant": participant, "consent": "yes",
                 "first_recorded": datetime.now().isoformat(timespec="seconds"), "notes": notes})
    write_csv(PARTICIPANTS, PARTICIPANT_FIELDS, rows)
    return True


def open_camera(index: int, width: int, height: int):
    # DirectShow opens much faster than the default backend on Windows.
    cap = cv2.VideoCapture(index, cv2.CAP_DSHOW) if sys.platform == "win32" else cv2.VideoCapture(index)
    if not cap.isOpened():
        cap = cv2.VideoCapture(index)
    if not cap.isOpened():
        raise SystemExit(f"Cannot open camera {index}. Try --camera 1.")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    for _ in range(15):  # let auto-exposure and white balance settle
        cap.read()
    ok, frame = cap.read()
    if not ok:
        raise SystemExit(f"Camera {index} opened but returned no frame.")
    h, w = frame.shape[:2]
    if (w, h) != (width, height):
        print(f"Note: camera gives {w}x{h}, not the requested {width}x{height}. Frames are saved as delivered.")
    return cap, w, h


def preview(frame, lines: list[str], color=(255, 255, 255), dot=False):
    """Mirrored copy of the frame with an instruction band on top (only shown, never saved)."""
    view = cv2.flip(frame, 1)
    wrapped = [w for line in lines for w in (textwrap.wrap(line, 62) or [""])]
    band = 12 + 24 * len(wrapped)
    view[:band] = (view[:band] * 0.35).astype(np.uint8)
    for i, line in enumerate(wrapped):
        cv2.putText(view, line, (10, 28 + 24 * i), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 1, cv2.LINE_AA)
    if dot:
        cv2.circle(view, (view.shape[1] - 24, view.shape[0] - 24), 10, (0, 0, 255), -1)
    return view


def show(view) -> str | None:
    """Show a preview; return the key pressed ('quit' if the window was closed)."""
    cv2.imshow(WINDOW, view)
    key = cv2.waitKey(1) & 0xFF
    if cv2.getWindowProperty(WINDOW, cv2.WND_PROP_VISIBLE) < 1:
        return "quit"
    return {ord(" "): "start", ord("s"): "skip", ord("r"): "redo", ord("q"): "quit", 27: "quit"}.get(key)


def read(cap):
    ok, frame = cap.read()
    if not ok:
        raise SystemExit("The camera stopped delivering frames.")
    return frame


def wait_for_start(cap, header: str, instruction: str, can_redo: bool) -> str:
    keys = "SPACE record   S skip" + ("   R redo previous" if can_redo else "") + "   Q quit"
    while True:
        action = show(preview(read(cap), [header, instruction, keys]))
        if action in ("start", "skip", "quit") or (action == "redo" and can_redo):
            return action


def record(cap, participant: str, condition: str, instruction: str, frames: int, interval: float,
           camera: int) -> list[dict] | None:
    """Countdown, then save `frames` frames `interval` s apart. None if the user quit part-way."""
    rows, start = [], time.monotonic() + COUNTDOWN_S
    due = start
    while len(rows) < frames:
        frame = read(cap)
        now = time.monotonic()
        if now < start:
            view = preview(frame, [instruction, f"Starting in {math.ceil(start - now)}..."], (0, 220, 255))
        else:
            if now >= due:
                name = f"{participant}_{condition}_{len(rows) + 1:02d}.jpg"
                cv2.imwrite(str(IMAGES / name), frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
                rows.append({"file": name, "participant": participant, "condition": condition,
                             "frame": len(rows) + 1, "captured_at": datetime.now().isoformat(timespec="milliseconds"),
                             "width": frame.shape[1], "height": frame.shape[0], "camera": camera})
                due = now + interval
            view = preview(frame, [instruction, f"Recording {len(rows)}/{frames}"], (80, 80, 255), dot=True)
        if show(view) == "quit":
            for row in rows:
                (IMAGES / row["file"]).unlink(missing_ok=True)
            return None
    return rows


def forget(participant: str, condition: str):
    """Delete a recorded condition (frames + log rows), e.g. to redo it."""
    keep = []
    for row in read_csv(CAPTURE_LOG):
        if row["participant"] == participant and row["condition"] == condition:
            (IMAGES / row["file"]).unlink(missing_ok=True)
        else:
            keep.append(row)
    write_csv(CAPTURE_LOG, LOG_FIELDS, keep)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--participant", required=True, help="Anonymous ID such as P01 (letters, digits, '-')")
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default 0)")
    parser.add_argument("--frames", type=int, default=8, help="Frames saved per condition (default 8)")
    parser.add_argument("--interval", type=float, default=0.75, help="Seconds between saved frames (default 0.75)")
    parser.add_argument("--width", type=int, default=640, help="Requested width (the app asks for 640)")
    parser.add_argument("--height", type=int, default=480, help="Requested height (the app asks for 480)")
    parser.add_argument("--notes", default="", help="Free text kept in participants.csv, e.g. 'glasses'")
    args = parser.parse_args()

    if not re.fullmatch(r"[A-Za-z0-9-]+", args.participant):
        raise SystemExit("--participant may only contain letters, digits and '-' (it is part of the file names).")
    if not ensure_consent(args.participant, args.notes):
        raise SystemExit("No consent recorded - nothing captured.")
    IMAGES.mkdir(parents=True, exist_ok=True)

    done = {r["condition"] for r in read_csv(CAPTURE_LOG) if r["participant"] == args.participant}
    todo = [c for c in CONDITIONS if c[0] not in done]
    if done:
        print(f"{args.participant}: {len(done)} condition(s) already recorded, {len(todo)} to go.")
    if not todo:
        print("Nothing left to record for this participant.")
        return

    cap, width, height = open_camera(args.camera, args.width, args.height)
    cv2.namedWindow(WINDOW, cv2.WINDOW_AUTOSIZE)
    i, previous, saved = 0, None, 0
    try:
        while i < len(todo):
            condition, instruction = todo[i]
            header = f"{args.participant}  -  {condition} ({i + 1}/{len(todo)})"
            action = wait_for_start(cap, header, instruction, can_redo=previous is not None)
            if action == "quit":
                break
            if action == "skip":
                i += 1
                continue
            if action == "redo":
                forget(args.participant, previous[0])
                saved -= args.frames
                todo.insert(i, previous)
                previous = None
                continue
            rows = record(cap, args.participant, condition, instruction, args.frames, args.interval, args.camera)
            if rows is None:
                break
            write_csv(CAPTURE_LOG, LOG_FIELDS, read_csv(CAPTURE_LOG) + rows)
            saved += len(rows)
            previous = todo[i]
            i += 1
    finally:
        cap.release()
        cv2.destroyAllWindows()

    total = sum(r["participant"] == args.participant for r in read_csv(CAPTURE_LOG))
    print(f"Saved {saved} frame(s) this session; {args.participant} now has {total} ({width}x{height}) in {IMAGES}")
    print("Next: python scripts/label_webcam_faces.py")


if __name__ == "__main__":
    main()
