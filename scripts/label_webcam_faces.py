"""Draw face boxes on the webcam frames, then split, clean and pack the data set for Colab.

The ground truth is drawn by hand and blind: this tool never runs or shows a detector, so the labels cannot lean
towards any of the models they will be used to score.

Labelling rules - the same convention as the WIDER FACE / FDDB training labels, so a box means the same thing to
every model:
    * Box every face you can recognise as a face: turned heads, partly covered faces, a second person in the
      background, small or blurry faces as long as you can tell where the face is.
    * Top edge at the hairline (where it would be if hair or a hat covers the forehead), bottom edge just below
      the chin, left and right edges at the outer cheeks. Ears, hair and neck stay outside.
    * A partly covered face is boxed where the whole face is, not just the visible part.
    * Frontal faces come out about 1.3-1.6x taller than wide (training labels: median 1.45). Each box shows its
      height/width ratio and turns orange outside 1.1-1.9 - check it, and keep it if the face really is that
      shape (a head turned sideways or tilted).
    * No face in the frame: press E. It is saved as an empty label and still counts (false alarms are scored).
    * A frame that cannot be labelled fairly (blur too strong to place the face, a broken frame): press X to
      exclude it. Decide from the image alone - never after any model has been run on the set.

--pack, once every frame is labelled or excluded:
    1. Split - puts every new participant, as a whole, into test / val / train (about 35% / 15% / 50% of people),
       at random with a fixed seed, and records it in splits.csv. A participant's split never changes afterwards.
    2. Clean - the same fixed rules for every split: a frame that is a near-copy of the previous kept frame of the
       same person and condition is dropped (it adds nothing but weight). Nothing is dropped for being hard.
    3. Check - flags labels worth a second look (faces on an empty-seat frame, no face where someone should be, tiny
       or overlapping boxes, odd shapes, nearly black frames) in qa_flags.csv; --flagged steps through them.
       Flags are never acted on automatically.
    4. Server view - writes each frame again the way the server receives it: scaled to 480 px wide and re-encoded
       as JPEG quality 60 (frontend/src/shared/hooks/use-monitoring.ts).
    5. Writes manifests (SHA-256 of every image and label), label_report.md, and two archives for Google Drive:
       datasets/webcam_test.zip (test people only - for notebooks/eval_webcam_test.ipynb) and
       datasets/webcam_train.zip (train + val people - for notebooks/finetune_blazeface_webcam.ipynb).

Usage (from the repo root):
    python scripts/label_webcam_faces.py             # label every frame that has no label yet
    python scripts/label_webcam_faces.py --review    # step through every frame from the start
    python scripts/label_webcam_faces.py --pack      # split, clean, check and zip for Drive
    python scripts/label_webcam_faces.py --flagged   # step through the frames --pack flagged

Mouse: drag to draw a box, right-click a box to delete it.
Keys: ENTER / N save + next, B back, E no face, X exclude / include, U undo, C clear, H rules, Q quit.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import random
import statistics
import zipfile
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
DATASETS = REPO_ROOT / "datasets"
OUT_DIR = DATASETS / "webcam"
IMAGES = OUT_DIR / "images"
LABELS = OUT_DIR / "labels"
SERVER_IMAGES = OUT_DIR / "server" / "images"
CAPTURE_LOG = OUT_DIR / "capture_log.csv"
PARTICIPANTS = OUT_DIR / "participants.csv"
EXCLUDED = OUT_DIR / "excluded.csv"
SPLITS = OUT_DIR / "splits.csv"
QA_FLAGS = OUT_DIR / "qa_flags.csv"
REPORT = OUT_DIR / "label_report.md"
# archive -> the participant splits it holds
ARCHIVES = {"webcam_test": ("test",), "webcam_train": ("train", "val")}
IMAGE_EXT = {".jpg", ".jpeg", ".png"}
MANIFEST_FIELDS = ["file", "participant", "condition", "split", "width", "height", "faces", "excluded",
                   "exclude_reason", "image_sha256", "server_sha256", "label_sha256"]

SPLIT_SHARE = {"test": 0.35, "val": 0.15}   # share of participants; the rest train
SPLIT_SEED = 42
SERVER_MAX_WIDTH, SERVER_JPEG_QUALITY = 480, 60   # use-monitoring.ts: captureMaxWidth 480, jpegQuality 0.6
DUPLICATE_MAD = 1.0   # mean |difference| in grey levels at 160x120 under which a frame repeats the last kept one
TINY_FACE = 0.05      # QA: a face under 5% of the image side is flagged for a second look
DARK_MEAN = 15        # QA: a mean grey level under this looks like a covered lens or a camera glitch

WINDOW = "Knowing Eye - label webcam faces"
MAX_VIEW = (1280, 800)   # the frame is scaled up to fit this, for precise boxes
PANEL_H = 78
MIN_BOX_PX = 4
RATIO_OK = (1.1, 1.9)    # frontal training faces: height/width median 1.45 (IQR 1.40-1.57)
RULES = [
    "LABELLING RULES (H to close)",
    "- Box every recognisable face: turned, partly covered, background, small.",
    "- Top: hairline (where it would be). Bottom: just below the chin.",
    "- Sides: outer cheeks. Ears, hair and neck stay outside.",
    "- Covered face: box where the whole face is, not only the visible part.",
    "- Frontal faces are ~1.3-1.6x taller than wide (orange = check it).",
    "- No face at all: E.  Unusable frame (judge the image only): X.",
    "- Never look at any model's output before labelling is finished.",
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


def list_images() -> list[Path]:
    return sorted(p for p in IMAGES.iterdir() if p.suffix.lower() in IMAGE_EXT) if IMAGES.exists() else []


def label_path(image: Path) -> Path:
    return LABELS / f"{image.stem}.txt"


def load_boxes(image: Path, w: int, h: int) -> list[list[float]] | None:
    """Pixel xyxy boxes from the YOLO label, or None if the frame has no label file yet."""
    path = label_path(image)
    if not path.exists():
        return None
    boxes = []
    for line in path.read_text().splitlines():
        if line.strip():
            _, cx, cy, bw, bh = (float(v) for v in line.split())
            boxes.append([(cx - bw / 2) * w, (cy - bh / 2) * h, (cx + bw / 2) * w, (cy + bh / 2) * h])
    return boxes


def save_boxes(image: Path, boxes: list[list[float]], w: int, h: int):
    LABELS.mkdir(parents=True, exist_ok=True)
    lines = [f"0 {(x1 + x2) / 2 / w:.6f} {(y1 + y2) / 2 / h:.6f} {(x2 - x1) / w:.6f} {(y2 - y1) / h:.6f}"
             for x1, y1, x2, y2 in boxes]
    label_path(image).write_text("".join(f"{line}\n" for line in lines))


def ratio(box) -> float:
    return (box[3] - box[1]) / max(box[2] - box[0], 1e-9)


class Labeller:
    def __init__(self, images: list[Path], start: int, notes: dict[str, str] | None = None):
        self.images, self.idx, self.notes = images, start, notes or {}
        self.excluded = {r["file"]: r for r in read_csv(EXCLUDED)}
        self.mouse, self.drag, self.show_rules = None, None, False
        self.load()

    # ---- frame state ----
    def load(self):
        self.path = self.images[self.idx]
        self.img = cv2.imread(str(self.path))
        note = self.notes.get(self.path.name)
        self.message = f"Check: {note}" if note else ""
        if self.img is None:
            self.img = np.full((480, 640, 3), 40, np.uint8)
            self.message = "This file cannot be read - press X to exclude it."
        self.h, self.w = self.img.shape[:2]
        self.scale = min(MAX_VIEW[0] / self.w, MAX_VIEW[1] / self.h)
        stored = load_boxes(self.path, self.w, self.h)
        self.labelled = stored is not None
        self.boxes = stored or []
        self.dirty, self.drag = False, None

    def status(self) -> str:
        if self.path.name in self.excluded:
            return "EXCLUDED"
        if not self.labelled:
            return "not labelled"
        return f"{len(self.boxes)} face(s)" if self.boxes else "no face"

    def save(self):
        save_boxes(self.path, self.boxes, self.w, self.h)
        self.labelled, self.dirty = True, False

    def go(self, step: int) -> bool:
        """Move by `step` frames; False when stepping past the last one."""
        if self.dirty and self.boxes:
            self.save()
        target = self.idx + step
        if target >= len(self.images):
            return False
        self.idx = max(target, 0)
        self.load()
        return True

    def toggle_excluded(self):
        name = self.path.name
        if name in self.excluded:
            del self.excluded[name]
            self.message = "Included again."
        else:
            self.excluded[name] = {"file": name, "reason": "excluded by labeller",
                                   "decided_at": datetime.now().isoformat(timespec="seconds")}
            self.message = "Excluded - this frame will not be used. X again to undo."
        write_csv(EXCLUDED, ["file", "reason", "decided_at"], sorted(self.excluded.values(), key=lambda r: r["file"]))

    # ---- input ----
    def to_image(self, x, y):
        return min(max(x / self.scale, 0), self.w), min(max(y / self.scale, 0), self.h)

    def on_mouse(self, event, x, y, flags, param):
        inside = y < self.h * self.scale
        self.mouse = (x, y) if inside else None
        if event == cv2.EVENT_LBUTTONDOWN and inside:
            if self.path.name in self.excluded:
                self.message = "This frame is excluded - press X to include it before drawing."
            else:
                self.drag = self.to_image(x, y)
        elif event == cv2.EVENT_LBUTTONUP and self.drag:
            (x1, y1), (x2, y2) = self.drag, self.to_image(x, y)
            box = [min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2)]
            if box[2] - box[0] >= MIN_BOX_PX and box[3] - box[1] >= MIN_BOX_PX:
                self.boxes.append(box)
                self.dirty, self.message = True, ""
            self.drag = None
        elif event == cv2.EVENT_RBUTTONDOWN and inside:
            px, py = self.to_image(x, y)
            hits = [b for b in self.boxes if b[0] <= px <= b[2] and b[1] <= py <= b[3]]
            if hits:
                self.boxes.remove(min(hits, key=lambda b: (b[2] - b[0]) * (b[3] - b[1])))
                self.dirty = True

    def on_key(self, key: int) -> bool:
        """Handle a key press; False to quit."""
        k = chr(key).lower() if key < 256 else ""
        if k in ("n", "\r"):
            if self.path.name in self.excluded or self.boxes or (self.labelled and not self.dirty):
                if self.boxes and self.dirty:
                    self.save()
                return self.go(1)
            self.message = "No boxes drawn - press E if there is no face in this frame."
        elif k == "e":
            if self.boxes:
                self.message = "There are boxes on this frame - C clears them; E is only for frames with no face."
            else:
                self.save()
                return self.go(1)
        elif k == "b":
            self.go(-1)
        elif k == "x":
            self.toggle_excluded()
        elif k == "u" and self.boxes:
            self.boxes.pop()
            self.dirty = True
        elif k == "c" and self.boxes:
            self.boxes.clear()
            self.dirty = True
        elif k == "h":
            self.show_rules = not self.show_rules
        elif k == "q" or key == 27:
            if self.dirty and self.boxes:
                self.save()
            return False
        return True

    # ---- drawing ----
    def render(self):
        s = self.scale
        view = cv2.resize(self.img, (round(self.w * s), round(self.h * s)), interpolation=cv2.INTER_LINEAR)
        if self.mouse:
            mx, my = self.mouse
            cv2.line(view, (mx, 0), (mx, view.shape[0]), (160, 160, 160), 1)
            cv2.line(view, (0, my), (view.shape[1], my), (160, 160, 160), 1)
        for box in self.boxes:
            ok = RATIO_OK[0] <= ratio(box) <= RATIO_OK[1]
            color = (0, 210, 0) if ok else (0, 140, 255)
            p1, p2 = (round(box[0] * s), round(box[1] * s)), (round(box[2] * s), round(box[3] * s))
            cv2.rectangle(view, p1, p2, color, 2)
            cv2.putText(view, f"{ratio(box):.2f}", (p1[0], max(p1[1] - 6, 14)), cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                        color, 1, cv2.LINE_AA)
        if self.drag and self.mouse:
            cv2.rectangle(view, (round(self.drag[0] * s), round(self.drag[1] * s)), self.mouse, (0, 230, 255), 1)
        if self.path.name in self.excluded:
            cv2.line(view, (0, 0), (view.shape[1], view.shape[0]), (0, 0, 220), 3)
            cv2.line(view, (view.shape[1], 0), (0, view.shape[0]), (0, 0, 220), 3)
        if self.show_rules:
            band = 16 + 26 * len(RULES)
            view[:band] = (view[:band] * 0.25).astype(np.uint8)
            for i, line in enumerate(RULES):
                cv2.putText(view, line, (12, 30 + 26 * i), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1,
                            cv2.LINE_AA)

        panel = np.full((PANEL_H, view.shape[1], 3), 32, np.uint8)
        head = f"{self.idx + 1}/{len(self.images)}   {self.path.name}   [{self.status()}]" + (
            "  *unsaved" if self.dirty else "")
        keys = "ENTER/N save+next  B back  E no face  X exclude  U undo  C clear  H rules  Q quit  | right-click deletes"
        for i, (text, color) in enumerate([(head, (255, 255, 255)), (self.message, (0, 200, 255)),
                                           (keys, (170, 170, 170))]):
            cv2.putText(panel, text, (10, 22 + 24 * i), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)
        return np.vstack([view, panel])

    def run(self):
        cv2.namedWindow(WINDOW, cv2.WINDOW_AUTOSIZE)
        cv2.setMouseCallback(WINDOW, self.on_mouse)
        while True:
            cv2.imshow(WINDOW, self.render())
            key = cv2.waitKey(20)
            if cv2.getWindowProperty(WINDOW, cv2.WND_PROP_VISIBLE) < 1:
                if self.dirty and self.boxes:
                    self.save()
                break
            if key != -1 and not self.on_key(key & 0xFFFF):
                break
        cv2.destroyAllWindows()


# ---------------------------------------------------------------- pack


def validate_label(path: Path) -> list[tuple[float, float, float, float]]:
    """Normalised (cx, cy, w, h) of every box, raising on any malformed line."""
    boxes = []
    for n, line in enumerate(path.read_text().splitlines(), 1):
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) != 5 or parts[0] != "0":
            raise ValueError(f"{path}:{n}: expected 'class x y w h' with class 0, got {line!r}")
        values = tuple(float(v) for v in parts[1:])
        if not all(0.0 <= v <= 1.0 for v in values) or values[2] <= 0 or values[3] <= 0:
            raise ValueError(f"{path}:{n}: coordinates outside [0, 1] or empty box: {line!r}")
        boxes.append(values)
    return boxes


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def assign_splits(participants: set[str]) -> dict[str, str]:
    """Put every new participant, as a whole, into test / val / train. Earlier assignments never change."""
    rows = read_csv(SPLITS)
    split = {r["participant"]: r["split"] for r in rows}
    new = sorted(participants - split.keys())
    if not new:
        return split
    random.Random(f"{SPLIT_SEED}:{len(split)}").shuffle(new)   # which person goes where is random...
    n = len(split) + len(new)
    targets = {"test": round(n * SPLIT_SHARE["test"]), "val": round(n * SPLIT_SHARE["val"])}
    targets["train"] = n - targets["test"] - targets["val"]
    for p in new:   # ...and each one fills the split furthest below its share
        counts = Counter(split.values())
        split[p] = max(("test", "val", "train"), key=lambda s: targets[s] - counts[s])
        rows.append({"participant": p, "split": split[p], "assigned_at": datetime.now().isoformat(timespec="seconds")})
        print(f"  {p} -> {split[p]}  (fixed from now on)")
    write_csv(SPLITS, ["participant", "split", "assigned_at"], rows)
    return split


def server_view(img) -> bytes:
    """The frame as the server receives it: scaled to 480 px wide like canvas.drawImage, then JPEG quality 60."""
    h, w = img.shape[:2]
    if w > SERVER_MAX_WIDTH:
        s = SERVER_MAX_WIDTH / w
        img = cv2.resize(img, (int(w * s + 0.5), int(h * s + 0.5)), interpolation=cv2.INTER_LINEAR)
    return cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, SERVER_JPEG_QUALITY])[1].tobytes()


def thumbnail(img):
    return cv2.resize(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (160, 120), interpolation=cv2.INTER_AREA).astype(np.float32)


def check_frame(condition: str, boxes, img) -> list[str]:
    """Reasons to look at a label again. Nothing here changes or drops anything."""
    h, w = img.shape[:2]
    flags = []
    if condition == "empty_seat" and boxes:
        flags.append("faces labelled on an empty-seat frame")
    if condition != "empty_seat" and not boxes:
        flags.append("no face labelled - is nobody really in view?")
    if condition == "second_person" and len(boxes) < 2:
        flags.append("second-person frame with fewer than 2 faces")
    xyxy = np.array([[cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2] for cx, cy, bw, bh in boxes]).reshape(-1, 4)
    for cx, cy, bw, bh in boxes:
        size = (bw * w * bh * h) ** 0.5 / max(w, h)
        if size < TINY_FACE:
            flags.append(f"tiny box ({size:.0%} of the image)")
        if not RATIO_OK[0] <= (bh * h) / (bw * w) <= RATIO_OK[1]:
            flags.append(f"unusual box shape (height/width {(bh * h) / (bw * w):.2f})")
    for i in range(len(xyxy)):
        for j in range(i + 1, len(xyxy)):
            a, b = xyxy[i], xyxy[j]
            inter = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
            union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
            if inter / union > 0.5:
                flags.append("two boxes overlap - drawn twice?")
    if img.mean() < DARK_MEAN:
        flags.append("nearly black frame - covered lens or camera glitch?")
    return flags


def pack():
    images = list_images()
    if not images:
        raise SystemExit(f"No frames in {IMAGES} - record some with scripts/capture_webcam_faces.py first.")
    log = {r["file"]: r for r in read_csv(CAPTURE_LOG)}
    labeller_excluded = {r["file"] for r in read_csv(EXCLUDED)}
    consented = {r["participant"] for r in read_csv(PARTICIPANTS) if r.get("consent") == "yes"}

    rows, missing = [], []
    for image in images:
        meta = log.get(image.name)
        if meta is None:   # not from the capture script: <participant>_<condition>_<nn>.jpg
            participant, rest = image.stem.split("_", 1)
            meta = {"participant": participant, "condition": rest.rsplit("_", 1)[0]}
        if meta["participant"] not in consented:
            raise SystemExit(f"{image.name}: participant {meta['participant']} has no consent in {PARTICIPANTS}.")
        row = {"file": image.name, "participant": meta["participant"], "condition": meta["condition"],
               "faces": 0, "excluded": 0, "exclude_reason": "", "image_sha256": "", "server_sha256": "",
               "label_sha256": "", "width": "", "height": ""}
        if image.name in labeller_excluded:
            row.update(excluded=1, exclude_reason="labeller: unusable frame")
        elif not label_path(image).exists():
            missing.append(image.name)
        rows.append(row)
    if missing:
        raise SystemExit(f"{len(missing)} frame(s) have no label yet (first: {missing[0]}). Label or exclude them, "
                         "then pack again.")

    print("Split (by participant):")
    split = assign_splits({r["participant"] for r in rows})
    by_group = defaultdict(list)
    for row in rows:
        row["split"] = split[row["participant"]]
        by_group[(row["participant"], row["condition"])].append(row)

    SERVER_IMAGES.mkdir(parents=True, exist_ok=True)
    flags, boxes_of, sizes = {}, {}, defaultdict(list)
    for group in by_group.values():
        last = None   # thumbnail of the last kept frame of this person + condition (frames sorted = capture order)
        for row in group:
            if row["excluded"]:
                continue
            image = IMAGES / row["file"]
            data = image.read_bytes()
            img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
            if img is None:
                raise SystemExit(f"{row['file']} cannot be read - exclude it (X) in the labeller.")
            thumb = thumbnail(img)
            if last is not None and np.abs(thumb - last[0]).mean() < DUPLICATE_MAD:
                row.update(excluded=1, exclude_reason=f"near-duplicate of {last[1]}")
                continue
            last = (thumb, row["file"])
            label = label_path(image).read_bytes()
            boxes = boxes_of[row["file"]] = validate_label(label_path(image))
            server = server_view(img)
            (SERVER_IMAGES / f"{image.stem}.jpg").write_bytes(server)
            row.update(width=img.shape[1], height=img.shape[0], faces=len(boxes), image_sha256=sha256(data),
                       server_sha256=sha256(server), label_sha256=sha256(label))
            sizes[row["split"]] += [(bw * img.shape[1] * bh * img.shape[0]) ** 0.5 / max(img.shape[:2])
                                    for _, _, bw, bh in boxes]
            if found := check_frame(row["condition"], boxes, img):
                flags[row["file"]] = "; ".join(found)
    write_csv(QA_FLAGS, ["file", "flags"], [{"file": f, "flags": v} for f, v in sorted(flags.items())])

    fingerprints = {}
    for archive, splits in ARCHIVES.items():
        members = [r for r in rows if r["split"] in splits]
        if not members:
            print(f"No {'/'.join(splits)} participants yet - {archive}.zip not written.")
            continue
        manifest = OUT_DIR / f"{archive}_manifest.csv"
        write_csv(manifest, MANIFEST_FIELDS, members)
        fingerprints[archive] = sha256(manifest.read_bytes())[:12]
        with zipfile.ZipFile(DATASETS / f"{archive}.zip", "w", zipfile.ZIP_DEFLATED) as z:
            for row in members:
                if row["excluded"]:
                    continue
                stem = Path(row["file"]).stem
                z.write(IMAGES / row["file"], f"{archive}/images/{row['file']}")
                z.write(LABELS / f"{stem}.txt", f"{archive}/labels/{stem}.txt")
                z.write(SERVER_IMAGES / f"{stem}.jpg", f"{archive}/server/images/{stem}.jpg")
                z.write(LABELS / f"{stem}.txt", f"{archive}/server/labels/{stem}.txt")
            z.write(manifest, f"{archive}/manifest.csv")
    REPORT.write_text(report(rows, split, flags, sizes, fingerprints), encoding="utf-8")
    for archive in fingerprints:
        with zipfile.ZipFile(DATASETS / f"{archive}.zip", "a") as z:
            z.write(REPORT, f"{archive}/label_report.md")

    print(REPORT.read_text(encoding="utf-8"))
    if flags:
        print(f"{len(flags)} frame(s) flagged for a second look - `python scripts/label_webcam_faces.py --flagged`, "
              "fix what is wrong, then pack again.")
    for archive in fingerprints:
        print(f"Wrote {DATASETS / f'{archive}.zip'} - upload it to the root of Google Drive.")


def report(rows: list[dict], split: dict[str, str], flags: dict, sizes: dict, fingerprints: dict) -> str:
    order = ("train", "val", "test")
    kept = [r for r in rows if not r["excluded"]]
    people = {s: sorted(p for p, v in split.items() if v == s and any(r["participant"] == p for r in rows))
              for s in order}
    lines = [
        "# Webcam face data set - label report",
        "",
        f"Packed by `scripts/label_webcam_faces.py --pack` on {datetime.now():%Y-%m-%d %H:%M}.",
        "",
        "Fingerprints (SHA-256 of each archive's manifest.csv): "
        + ", ".join(f"`{a}.zip` `{fp}`" for a, fp in fingerprints.items()) + ".",
        "",
        "| Split | Participants | Frames kept | Faces | Frames with no face | Near-duplicates dropped | "
        "Excluded by labeller |",
        "|---|---|---|---|---|---|---|",
    ]
    for s in order:
        mine = [r for r in rows if r["split"] == s]
        k = [r for r in mine if not r["excluded"]]
        lines.append(f"| {s} | {len(people[s])} ({', '.join(people[s])}) | {len(k)} | {sum(r['faces'] for r in k)} | "
                     f"{sum(r['faces'] == 0 for r in k)} | "
                     f"{sum(r['exclude_reason'].startswith('near-duplicate') for r in mine)} | "
                     f"{sum(r['exclude_reason'].startswith('labeller') for r in mine)} |")
    by_condition = defaultdict(Counter)
    for r in kept:
        by_condition[r["condition"]][r["split"]] += 1
    lines += ["", "Frames kept per condition:", "", "| Condition | " + " | ".join(order) + " |",
              "|---|" + "---|" * len(order)]
    lines += [f"| {c} | " + " | ".join(str(n[s]) for s in order) + " |" for c, n in sorted(by_condition.items())]
    lines.append("")
    for s in order:
        if len(sizes[s]) > 1:
            q = statistics.quantiles(sizes[s], n=10)
            lines.append(f"Face size in {s} (sqrt(w*h) / image's longer side): 10th percentile {q[0]:.0%}, "
                         f"median {statistics.median(sizes[s]):.0%}, 90th percentile {q[-1]:.0%}.")
    lines += ["", f"Frames flagged for a second look (qa_flags.csv): {len(flags)}."]
    if len(people["test"]) < 5:
        lines += ["", f"Note: {len(people['test'])} test participant(s) - the scoring notebook needs 5+ for "
                      "participant-level confidence intervals and falls back to frame-level ones (optimistic)."]
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--review", action="store_true", help="Start at the first frame, not the first unlabelled one")
    parser.add_argument("--flagged", action="store_true", help="Step through the frames --pack flagged")
    parser.add_argument("--pack", action="store_true", help="Split, clean, check and zip the data set for Drive")
    args = parser.parse_args()

    if args.pack:
        pack()
        return
    images = list_images()
    if not images:
        raise SystemExit(f"No frames in {IMAGES} - record some with scripts/capture_webcam_faces.py first.")
    if args.flagged:
        notes = {r["file"]: r["flags"] for r in read_csv(QA_FLAGS)}
        flagged = [p for p in images if p.name in notes]
        if not flagged:
            print("No flagged frames. (--pack writes the flags.)")
            return
        Labeller(flagged, 0, notes).run()
        print("Done reviewing - pack again to refresh the flags.")
        return
    excluded = {r["file"] for r in read_csv(EXCLUDED)}
    todo = [i for i, p in enumerate(images) if not label_path(p).exists() and p.name not in excluded]
    if not args.review and not todo:
        print(f"All {len(images)} frames are labelled or excluded. Use --review to check them, or --pack.")
        return
    Labeller(images, 0 if args.review else todo[0]).run()
    left = sum(not label_path(p).exists() and p.name not in excluded for p in list_images())
    print(f"{left} frame(s) still to label." if left else "Every frame is done - next: --pack")


if __name__ == "__main__":
    main()
