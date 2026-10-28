"""Per-frame CPU cost and throughput with a face actually in frame.

Builds webcam-like 480x360 frames (one face ~30% of frame width, head+shoulders
framing) from the project's YOLO face dataset, then measures:
  - single stream, MediaPipe only (no enrolled reference)
  - single stream, with ArcFace identity checks (enrolled reference)
  - N concurrent streams sharing one pipeline (production threading model)
Usage: python measure_throughput.py <backend_dir> <dataset_root> <secs_per_rung> <n1> <n2> ...
"""

import glob
import json
import os
import statistics
import sys
import threading
import time

backend, ds_root, secs = sys.argv[1], sys.argv[2], float(sys.argv[3])
rungs = [int(x) for x in sys.argv[4:]]
sys.path.insert(0, backend)
os.chdir(backend)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.config.settings")
os.environ.setdefault("DB_ENGINE", "django.db.backends.sqlite3")

import cv2  # noqa: E402
import psutil  # noqa: E402
import django  # noqa: E402

django.setup()
from ai import adapter  # noqa: E402
from ai.frame_utils import decode_image_bytes  # noqa: E402


def build_fixture(limit=30):
    out = []
    for lbl in sorted(glob.glob(os.path.join(ds_root, "labels", "**", "*.txt"), recursive=True)):
        rows = [r.split() for r in open(lbl).read().strip().splitlines() if r.strip()]
        if len(rows) != 1:
            continue
        _, cx, cy, bw, bh = map(float, rows[0][:5])
        if bw < 0.2:
            continue
        stem = os.path.splitext(os.path.basename(lbl))[0]
        cand = glob.glob(os.path.join(ds_root, "images", "**", stem + ".*"), recursive=True)
        if not cand:
            continue
        img = cv2.imread(cand[0])
        if img is None:
            continue
        H, W = img.shape[:2]
        fw = bw * W
        cw = fw / 0.30  # face ~30% of frame width
        ch = cw * 0.75
        x0 = int(cx * W - cw / 2)
        y0 = int(cy * H - ch * 0.40)  # face in upper half, room for shoulders
        x0 = max(0, min(x0, W - 1)); y0 = max(0, min(y0, H - 1))
        crop = img[y0:int(y0 + ch), x0:int(x0 + cw)]
        if crop.size == 0 or crop.shape[1] < 160:
            continue
        crop = cv2.resize(crop, (480, 360), interpolation=cv2.INTER_AREA)
        out.append(cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 60])[1].tobytes())
        if len(out) >= limit:
            break
    return out


frames = build_fixture()
pipeline = adapter._get_pipeline()
proc = psutil.Process()
ref = None
for j in frames:
    ref = adapter.compute_embedding(decode_image_bytes(j))
    if ref:
        break


def single(reference, label):
    for j in frames[:3]:
        pipeline.analyze_frame(decode_image_bytes(j), session_id=label, reference_embedding=reference)
    c0, t0 = proc.cpu_times(), time.perf_counter()
    faces = 0
    lat = []
    for k in range(len(frames) * 2):
        t = time.perf_counter()
        d = pipeline.analyze_frame(decode_image_bytes(frames[k % len(frames)]), session_id=label, reference_embedding=reference)
        lat.append((time.perf_counter() - t) * 1000)
        d = d.to_dict() if hasattr(d, "to_dict") else d
        faces += 1 if (d.get("face") or {}).get("count") else 0
    n = len(frames) * 2
    time.sleep(1.5)  # async identity thread drains; its CPU is counted below
    c1, wall = proc.cpu_times(), time.perf_counter() - t0 - 1.5
    return {"label": label, "face_rate": round(faces / n, 2), "reply_ms_median": statistics.median(lat),
            "fps": n / wall, "core_s_per_frame": ((c1.user - c0.user) + (c1.system - c0.system)) / n}


emb_ms = []
for j in frames[:10]:
    t = time.perf_counter()
    adapter.compute_embedding(decode_image_bytes(j))
    emb_ms.append((time.perf_counter() - t) * 1000)

print(json.dumps({"fixture_frames": len(frames), "fixture_jpeg_bytes_median": statistics.median(len(f) for f in frames),
                  "reference": bool(ref), "arcface_full_embedding_ms_median": statistics.median(emb_ms)}), flush=True)
print(json.dumps(single(None, "noid")), flush=True)
print(json.dumps(single(ref, "withid")), flush=True)

for n in rungs:
    counts, lat, lock = [0] * n, [], threading.Lock()
    stop = time.perf_counter() + secs

    def worker(i):
        k = 0
        while time.perf_counter() < stop:
            t = time.perf_counter()
            pipeline.analyze_frame(decode_image_bytes(frames[(k + i) % len(frames)]), session_id=f"c{n}-{i}", reference_embedding=ref)
            with lock:
                lat.append((time.perf_counter() - t) * 1000)
            counts[i] += 1
            k += 1

    proc.cpu_percent(None)
    t0 = time.perf_counter()
    ths = [threading.Thread(target=worker, args=(i,)) for i in range(n)]
    [t.start() for t in ths]
    [t.join() for t in ths]
    wall = time.perf_counter() - t0
    lat.sort()
    print(json.dumps({"streams": n, "total_fps": sum(counts) / wall, "fps_per_stream": sum(counts) / wall / n,
                      "reply_ms_median": lat[len(lat) // 2], "reply_ms_p95": lat[int(0.95 * (len(lat) - 1))],
                      "process_cpu_pct": proc.cpu_percent(None), "rss_mb": proc.memory_info().rss / 2**20}), flush=True)
