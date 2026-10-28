"""Measure real per-frame payload sizes and inference cost of the monitoring path.

Mirrors the production wire format:
  examinee -> server : binary WS frame = JPEG, <=480px wide, quality 0.6 (use-monitoring.ts)
  server -> examinee : {"type":"analysis","payload":client_analysis(...)} JSON
  server -> observer : snapshot data URL (320px, q65) + summary, ~1/s
  server -> observer : detail analysis JSON per frame (?detail=1 only)
  evidence ring      : JPEG 480px q70 in RAM, ~1/s

Webcam frames are held in memory only; nothing is written to disk.
Usage: python measure_payloads.py <backend_dir> [fallback_image_dir]
"""

import base64
import glob
import json
import os
import statistics
import sys
import time

backend = sys.argv[1]
fallback_dir = sys.argv[2] if len(sys.argv) > 2 else None
sys.path.insert(0, backend)
os.chdir(backend)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.config.settings")
os.environ.setdefault("DB_ENGINE", "django.db.backends.sqlite3")

import cv2  # noqa: E402
import numpy as np  # noqa: E402
import psutil  # noqa: E402
import django  # noqa: E402

django.setup()

from ai import adapter  # noqa: E402
from ai.frame_utils import decode_image_bytes, encode_jpeg_bytes, encode_jpeg_snapshot  # noqa: E402
from features.monitoring.payloads import analysis_summary, client_analysis  # noqa: E402


def capture_webcam(n=60, gap_s=0.15):
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap.isOpened():
        return [], None
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    for _ in range(15):  # let auto-exposure settle
        cap.read()
    frames = []
    for _ in range(n):
        ok, f = cap.read()
        if ok and f is not None and f.mean() > 5:
            frames.append(f)
        time.sleep(gap_s)
    cap.release()
    return frames, "webcam"


def load_fallback(n=60):
    paths = sorted(glob.glob(os.path.join(fallback_dir, "**", "*.jpg"), recursive=True))[:n]
    frames = []
    for p in paths:
        img = cv2.imread(p)
        if img is None:
            continue
        frames.append(cv2.resize(img, (640, 480)))
    return frames, "dataset"


def client_jpeg(frame, max_w=480, q=60):
    h, w = frame.shape[:2]
    if w > max_w:
        frame = cv2.resize(frame, (max_w, round(h * max_w / w)), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, q])
    return buf.tobytes()


def stats(xs):
    xs = sorted(xs)
    p95 = xs[min(len(xs) - 1, int(round(0.95 * (len(xs) - 1))))]
    return {"min": xs[0], "median": statistics.median(xs), "mean": statistics.fmean(xs), "p95": p95, "max": xs[-1]}


frames, source = capture_webcam()
if len(frames) < 10 and fallback_dir:
    frames, source = load_fallback()
print(f"source={source} frames={len(frames)} native={frames[0].shape[1]}x{frames[0].shape[0]}")

proc = psutil.Process()
rss_before = proc.memory_info().rss
pipeline = adapter._get_pipeline()
print("pipeline mode:", adapter.get_pipeline_mode())
rss_loaded = proc.memory_info().rss

# Encoded sizes (no inference needed)
up_jpeg, up_b64_json, snap_url, evid = [], [], [], []
for f in frames:
    j = client_jpeg(f)
    up_jpeg.append(len(j))
    data_url = "data:image/jpeg;base64," + base64.b64encode(j).decode()
    up_b64_json.append(len(json.dumps({"image": data_url, "session_id": "00000000-0000-0000-0000-000000000000"})))
    dec = decode_image_bytes(j)
    snap_url.append(len(encode_jpeg_snapshot(dec)))
    evid.append(len(encode_jpeg_bytes(dec, 480, 70)[0]))

# Enrollment-equivalent reference so ArcFace identity checks actually run
dec0 = decode_image_bytes(client_jpeg(frames[0]))
t = time.perf_counter()
ref = adapter.compute_embedding(dec0)
embed_ms = (time.perf_counter() - t) * 1000
print("reference embedding:", "ok" if ref else "none", f"{embed_ms:.0f} ms")

# Warm-up
for f in frames[:3]:
    pipeline.analyze_frame(decode_image_bytes(client_jpeg(f)), session_id="bench", reference_embedding=ref)

reply, detail, summary, decode_ms, infer_ms = [], [], [], [], []
proc.cpu_percent(None)
wall0 = time.perf_counter()
cpu0 = proc.cpu_times()
for f in frames:
    j = client_jpeg(f)
    t0 = time.perf_counter()
    dec = decode_image_bytes(j)
    t1 = time.perf_counter()
    res = pipeline.analyze_frame(dec, session_id="bench", reference_embedding=ref)
    t2 = time.perf_counter()
    payload = res.to_dict() if hasattr(res, "to_dict") else res
    payload["pipeline_mode"] = adapter.get_pipeline_mode()
    decode_ms.append((t1 - t0) * 1000)
    infer_ms.append((t2 - t1) * 1000)
    ca = client_analysis(payload)
    reply.append(len(json.dumps({"type": "analysis", "payload": ca})))
    detail.append(len(json.dumps({"type": "analysis", "payload": ca, "session_id": "00000000-0000-0000-0000-000000000000"})))
    summary.append(len(json.dumps(analysis_summary(payload))))
wall = time.perf_counter() - wall0
cpu1 = proc.cpu_times()
cpu_s = (cpu1.user - cpu0.user) + (cpu1.system - cpu0.system)

out = {
    "source": source,
    "n_frames": len(frames),
    "cpu_logical_cores": psutil.cpu_count(),
    "cpu_physical_cores": psutil.cpu_count(logical=False),
    "upload_jpeg_bytes": stats(up_jpeg),
    "upload_rest_json_bytes": stats(up_b64_json),
    "reply_analysis_json_bytes": stats(reply),
    "observer_detail_json_bytes": stats(detail),
    "observer_summary_json_bytes": stats(summary),
    "observer_snapshot_dataurl_bytes": stats(snap_url),
    "evidence_jpeg_bytes": stats(evid),
    "decode_ms": stats(decode_ms),
    "inference_ms": stats(infer_ms),
    "enroll_embedding_ms": embed_ms,
    "frames_per_s_single_stream": len(frames) / wall,
    "cpu_core_seconds_per_frame": cpu_s / len(frames),
    "rss_mb_before_models": rss_before / 2**20,
    "rss_mb_models_loaded": rss_loaded / 2**20,
    "rss_mb_after": proc.memory_info().rss / 2**20,
    "example_reply_keys": sorted(ca.keys()),
}
print(json.dumps(out, indent=2, default=float))
