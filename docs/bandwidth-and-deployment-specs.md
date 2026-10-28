# Knowing Eye - Bandwidth, Real-Time Data Volume & Deployment Specs

Measured 2026-10-28 against the code on `main` (`e685aef7`). Every figure is either
read straight from the code (cited) or measured with `scripts/load/measure_payloads.py`
and `scripts/load/measure_throughput.py`. Nothing here is a guess. Figures that are
derived by arithmetic say so.

**Test machine:** Intel Core i5-11300H (4 cores / 8 threads), 7.7 GB RAM with only
0.5-0.9 GB free during the runs (a shared dev laptop). Payload sizes do not depend on
the machine. CPU and latency figures do, and on a dedicated server they should come
out better, not worse. Re-run `measure_throughput.py` on the real server before
quoting capacity.

**Frame source:** 60 real frames from the built-in webcam at 640x480, encoded exactly
as the browser does. Frames were held in memory only and never saved. A face-dataset
fixture was used for the CPU runs so a face is always in frame.

---

## 1. What travels over the network

The system does not stream video. The examinee's browser captures still JPEG frames
and sends each one as a binary WebSocket message. The server analyzes each frame and
replies with a small JSON result. The browser sends the next frame only after the
previous reply arrives (back-pressure), so the real send rate is the lower of the
target rate and what the server can keep up with.

### 1.1 Capture & wire-format parameters (from code)

| Parameter | Value | Source |
|---|---|---|
| Camera request | 640x480 ideal, front camera, no audio | `frontend/src/shared/hooks/use-monitoring.ts` (`DEFAULT_VIDEO`) |
| Uploaded frame size | downscaled to max 480 px wide -> **480x360** | `use-monitoring.ts` (`DEFAULT_CAPTURE_MAX_WIDTH`) |
| Encoding | JPEG, quality **0.60** (exam), **0.45** (setup) | `use-monitoring.ts`, `exam-setup-page.tsx` |
| Target rate, exam | **5 frames/s** (200 ms interval), gated on the previous reply | `use-exam-taking.ts`, `pipeline.yaml` `target_fps: 5` |
| Target rate, setup / camera check | 1 frame/s | `exam-setup-page.tsx` |
| Transport | WSS `/ws/monitoring/<session_id>/`, binary frame (no base64) | `consumers.py` `MonitoringConsumer.receive` |
| Fallback transport | HTTPS POST `/api/monitoring/frame/`, base64 data URL in JSON | `use-monitoring.ts` `sendViaRest` |
| Server -> examinee | one `analysis` JSON reply per frame | `consumers.py`, `payloads.client_analysis` |
| Server -> proctor tile | 320 px JPEG snapshot (q65, base64) + 2-number summary, at most 1/s, only while a proctor is watching | `consumers.py` `_SNAPSHOT_INTERVAL_S`, `frame_utils.encode_jpeg_snapshot` |
| Server -> proctor detail page | the above + every per-frame `analysis` (`?detail=1`) | `SessionObserverConsumer` |
| Alerts | each alert type re-sent at most once per 30 s per session | `payloads.ALERT_REBROADCAST_S` |
| Exam heartbeat | REST status/timer sync every 10 s (3 s while paused) | `use-exam-attempt.ts` |
| Proctor keep-alive | WS ping every 20 s; fan-out stops 50 s after the last one | `use-session-observer.ts`, `OBSERVER_PRESENT_TTL_S` |

### 1.2 Measured message sizes

| Message | Median | p95 | Range |
|---|---|---|---|
| Uploaded frame, exam (480x360 JPEG q60, binary WS) | **13.6 KB** | 14.0 KB | 12.3-14.1 KB |
| Uploaded frame, setup (480x360 JPEG q45) | 11.6 KB | - | - |
| Uploaded frame, REST fallback (base64 JSON) | 18.2 KB | 18.8 KB | 16.6-18.9 KB |
| Enrollment message (3 frames, base64 JSON, once per session) | 47 KB | - | 46-47 KB |
| `analysis` reply to examinee | **1.1 KB** | 1.26 KB | 1.10-1.26 KB |
| `analysis` to a proctor detail page | 1.16 KB | 1.31 KB | - |
| Proctor tile snapshot (320 px JPEG data URL) | **11.1 KB** | 11.4 KB | 10.2-11.4 KB |
| Proctor tile summary | 61 B | 61 B | - |
| Evidence JPEG held in RAM (480 px, q70) | 14.4 KB | 14.8 KB | - |

The browser's JPEG encoder (libjpeg-turbo in Chrome) maps quality 0.6 to roughly the
OpenCV quality 60 used in the measurement, so real uploads should land within a few
percent of these sizes. Frames with more texture (busy background, bright room) run
larger. A face-dataset fixture with the same framing measured 15.7 KB.

### 1.3 Per-user bandwidth

Payload rates are measured size x rate. Wire rates add an estimated ~3-6% for
TCP/IP, TLS and WebSocket headers. That overhead was calculated, not measured.

| Who / phase | Direction | Payload rate | On the wire (est.) | Data per hour |
|---|---|---|---|---|
| **Examinee, during exam (5 fps)** | upload | 68 KB/s = **544 kbps** | **~0.56 Mbps** (p95 ~0.58) | **~245 MB** |
| Examinee, during exam (5 fps) | download | 5.5 KB/s = 44 kbps | ~55 kbps (incl. TCP ACKs, heartbeat) | ~25 MB |
| Examinee, setup / camera check (1 fps) | upload | 11.6 KB/s = 93 kbps | ~0.1 Mbps | - |
| Examinee, REST fallback (up to 5 fps) | upload | 91 KB/s = 729 kbps | ~0.76 Mbps | ~330 MB |
| Examinee at 1 fps (if the target is lowered) | upload | 13.6 KB/s = 109 kbps | ~0.11 Mbps | ~49 MB |
| Proctor, per watched tile on the grid | download | 11.3 KB/s = 90 kbps | ~95 kbps | ~41 MB |
| Proctor, single-session detail page | download | ~17 KB/s = ~137 kbps | ~0.15 Mbps | ~62 MB |

**Recommended examinee connection:** 1 Mbps sustained upload minimum (about 1.8x
headroom over the 0.56 Mbps measured). 2 Mbps is comfortable. Download needs are tiny.

### 1.4 Server / school-network totals (design rate, 5 fps)

Derived from 1.3. Assumes one proctor watching every examinee as a grid tile.

| Concurrent examinees | Server ingress (uploads) | Server egress (replies + 1 proctor grid) | Upload volume, 1-hour exam | Upload volume, 2-hour exam |
|---|---|---|---|---|
| 1 | 0.56 Mbps | 0.15 Mbps | 0.25 GB | 0.5 GB |
| 30 (one room) | **~17 Mbps** | **~4.4 Mbps** | 7.3 GB | 14.7 GB |
| 100 (overall) | **~56 Mbps** | **~14.5 Mbps** | 24.5 GB | 49 GB |

For a classroom where 30 students share one school uplink, that uplink needs about
**17 Mbps upstream** to the server for the full 5 fps.

> **Important:** these are the *design* figures, valid only if the server keeps up
> with 5 fps for every examinee. Because each browser waits for its reply, a slower
> server lowers the bandwidth used. Under the current single-process deployment the
> whole server takes in only about 6 frames/s total (section 2.3), which is **~0.65 Mbps
> total ingress no matter how many examinees are connected**.

With a Redis channel layer (multi-process), each watched session also sends about
11 KB/s (snapshot) + 5.5 KB/s (analysis broadcast) through Redis per group member.
That traffic stays inside the data centre but should be included when sizing Redis.

---

## 2. Magnitude of data processed in real time

### 2.1 Per frame

| Parameter | Value | Source / method |
|---|---|---|
| Decoded frame | 480x360x3 B = **518 KB** raw BGR pixels | arithmetic |
| Preprocessing | resize to max 640 px (no-op at 480), light denoise, YCbCr histogram equalization | `pipeline.yaml` `preprocessing` |
| Models run every frame | MediaPipe Face Landmarker (478 landmarks, head yaw/pitch), MediaPipe Pose Landmarker *full* (33 landmarks) | `pipeline.yaml` `detection` |
| Models run every 3rd frame (background thread) | InsightFace `buffalo_l`: RetinaFace detector at 320x320 + ArcFace ResNet-50 -> 512-d embedding | `pipeline.yaml` `identity_check_every_n_frames: 3`, `arcface_det_size: 320` |
| JPEG decode time | 1.7 ms median (3.6 ms p95) | measured |
| Reply latency, one examinee alone | **156-182 ms median**, 190-230 ms p95 | measured, 3 runs |
| ArcFace embedding (one identity check) | ~0.49 s steady state (0.86 s first call) | measured |
| CPU cost per frame, with ArcFace | **~0.82-0.90 CPU-core-seconds** | measured, process CPU time / frames |
| CPU cost per frame, MediaPipe only | ~0.08-0.15 core-seconds | measured (no enrolled reference) |

ArcFace accounts for roughly 85-90% of the per-frame CPU cost, even though it only runs
on every third frame.

### 2.2 Per examinee and in aggregate (design rate, 5 fps)

| Concurrent examinees | Frames analyzed / s | Raw pixels processed / s | JPEG data decoded / s | Frames per hour |
|---|---|---|---|---|
| 1 | 5 | 2.6 MB/s | 68 KB/s | 18,000 |
| 30 | 150 | 78 MB/s | 2.0 MB/s | 540,000 |
| 100 | 500 | 259 MB/s | 6.8 MB/s | 1,800,000 |

### 2.3 Measured server throughput (one Daphne process)

`measure_throughput.py`: N simulated examinees sharing one pipeline on worker threads,
the same threading model as `MonitoringConsumer`. Each examinee waits for its reply
before sending the next frame, like the browser.

| Concurrent examinees | Total frames/s (whole server) | Frames/s each | Reply latency median | p95 | Process CPU |
|---|---|---|---|---|---|
| 1 | 5.4-6.7 | 5.4-6.7 | 156-182 ms | 191-228 ms | 480-535% |
| 2 | 5.3 | 2.7 | 364 ms | 456 ms | 540% |
| 4 | 5.3-6.0 | 1.3-1.5 | 660-750 ms | 750-870 ms | 550-610% |
| 8 | 5.5 | 0.7 | 1.43 s | 1.60 s | 580% |
| 16 | 5.6-5.8 | 0.35 | 2.6-2.8 s | 3.0-3.4 s | 560% |

**Takeaway:** throughput is flat at **about 5.5-6.7 frames/s per process**, whether 1
examinee is connected or 16. Adding examinees only splits that budget. Two limits stack:

1. **CPU.** About 0.85 core-seconds per frame. One examinee at 5 fps already keeps
   ~5 of the laptop's 8 hardware threads busy.
2. **A process-wide lock around MediaPipe** (`ai/knowing_eye/pipeline.py`, `self._lock`).
   Even with unlimited cores, one process cannot run more than about 10-13 MediaPipe
   passes per second (measured 73-105 ms under the lock). Going past that needs more
   processes, not bigger machines, so it needs the Redis channel layer (`REDIS_URL`).

What examinees actually get on one process like the test machine:

| Concurrent examinees | Frames/s each (measured ceiling / N) | Time between analyses |
|---|---|---|
| 1 | ~5.5 | ~0.2 s |
| 10 | ~0.55 | ~1.8 s |
| 30 | ~0.2 | ~5.5 s |
| 100 | ~0.06 | ~18 s |

`no_face_grace_seconds` is 2 s and `leaving_seat_grace_seconds` is 3 s, so beyond
roughly **10 examinees per process** the analysis interval exceeds the grace periods
and short absences can go undetected.

### 2.4 Memory

| Item | Measured |
|---|---|
| Django/Daphne process before models load | 167 MB RSS |
| + MediaPipe face + pose models | ~275 MB RSS |
| + ArcFace `buffalo_l` (detector + recognizer only) | **~440-510 MB RSS** |
| Evidence ring per live session (12 JPEGs max) | ~175 KB (100 sessions ≈ 17 MB) |
| Stored evidence per session (cap: 40 warning + 12 termination snapshots) | at most ~0.75 MB |

Host free RAM matters as much as the process footprint. With under 0.5 GB free, the
earlier Locust run degraded to a 164 s p95 (`scripts/load/README.md`). In this session,
runs taken at 0.5-0.9 GB free varied by up to ~2x in per-frame cost between attempts,
and two runs came out ~6x cheaper for reasons I could not reproduce. Give the server
real headroom.

---

## 3. Deployment sizing

Compute needed ≈ **examinees x frames/s x 0.85 core-seconds**, plus enough processes to
stay under the MediaPipe lock limit (about 10 frames/s per process). These are laptop
numbers. A dedicated server CPU without memory pressure will probably need fewer cores,
so treat this as an upper bound until it is re-measured.

| Scenario | Frames/s needed | CPU cores (laptop-measured cost) | Daphne processes (min) | RAM (processes x 0.5 GB + 2 GB headroom) | Server ingress |
|---|---|---|---|---|---|
| 1 room, 30 examinees @ 5 fps (design) | 150 | ~128 | 15 | ~10 GB | ~17 Mbps |
| 1 room, 30 examinees @ 2 fps | 60 | ~51 | 6 | ~5 GB | ~7 Mbps |
| 1 room, 30 examinees @ 1 fps | 30 | ~26 | 3 | ~3.5 GB | ~3.4 Mbps |
| 100 examinees @ 1 fps | 100 | ~85 | 10 | ~7 GB | ~11 Mbps |
| Current deployment (1 process) | ~6 total | whatever the host has | 1 | - | ~0.65 Mbps total |

Multi-process scaling requires `REDIS_URL` (Channels Redis layer, see `docs/deployment.md`
section 5) so a proctor connected to one process sees examinees streaming to another.

### 3.1 Deployment specification table

| Layer | Parameter | Specification |
|---|---|---|
| Client | Camera | Any UVC webcam, 640x480 or better (higher resolutions are downscaled to 480 px before upload) |
| Client | Browser | Evergreen Chrome / Edge / Firefox / Safari with `getUserMedia`, WebSocket and Canvas 2D |
| Client | Upload bandwidth | **>= 1 Mbps sustained** (measured need 0.56 Mbps at 5 fps) |
| Client | Download bandwidth | >= 0.5 Mbps (measured need ~55 kbps during the exam) |
| Client | Data use | ~245 MB upload per exam-hour at 5 fps (~49 MB at 1 fps) |
| Client | Latency | Under ~150 ms RTT recommended: each frame waits for its reply, so RTT adds directly to the frame interval |
| Proctor | Download bandwidth | ~95 kbps per visible tile: 30 tiles ≈ 3 Mbps, 100 tiles ≈ 9.5 Mbps |
| School network | Uplink to server | ~17 Mbps per 30 examinees at 5 fps (~3.4 Mbps at 1 fps) |
| Server | Runtime | Python 3.12, Daphne (ASGI) behind TLS-terminating proxy (`backend/Dockerfile`, `entrypoint.sh`) |
| Server | CPU | ~0.85 core-s per analyzed frame (laptop-measured); size from the table above |
| Server | Processes | 1 per ~10 frames/s needed (MediaPipe lock); Redis channel layer once > 1 |
| Server | RAM | ~0.5 GB per process with ArcFace + >= 2 GB free headroom |
| Server | Network | Ingress ≈ 0.56 Mbps x examinees (5 fps); egress ≈ 0.055 Mbps x examinees + 0.095 Mbps x proctor tiles |
| Database | Engine | PostgreSQL (Supabase pooler, transaction mode port 6543, `DB_CONN_MAX_AGE=0`) |
| Database | Write rate | EBI running means flushed at most 1/s per examinee (`_EBI_FLUSH_INTERVAL_S`), behavior events once per 30 s cooldown per type |
| Storage | Frames | Not stored during the exam. Evidence JPEGs only on alerts / termination, max ~0.75 MB per session |
| Cache / broker | Redis 7 | Required for > 1 process; carries ~16.5 KB/s per watched session per group member |

---

## 4. Known gaps

- **Production hardware not measured.** Railway's plan (vCPU / RAM / replica count) is
  not in the repo. Run `measure_throughput.py` (and `run_ladder.py` for the full
  WebSocket path) on the actual host.
- **Real browser encoder not measured.** Sizes come from OpenCV encoding real webcam
  frames at the browser's settings. A quick check in Chrome DevTools (Network -> WS ->
  frame sizes) during a real exam would confirm them.
- **Wire overhead is estimated** (~3-6%), not packet-captured.
- **Only one camera / one room was used.** A brighter or busier scene makes larger
  JPEGs. Plan on the p95 sizes, not the median.
- `docs/documentation/chapter2/03-system-design.html#capacity` still quotes the older
  1 fps profile (5.4 KB frames, 43 kbps, 1.3 Mbps for 30, 4.3 Mbps for 100). The
  current code runs 5 fps, so those figures understate bandwidth by about 13x and
  should be replaced with the ones above.

## 5. Reproducing

```bash
cd backend
../backend/venv/Scripts/python.exe ../scripts/load/measure_payloads.py . ../datasets/fddb_dataset_YOLO/images
../backend/venv/Scripts/python.exe ../scripts/load/measure_throughput.py . ../datasets/face_split_70_20_10 20 1 2 4 8 16
```

`measure_payloads.py` uses webcam 0 (frames kept in memory only) and falls back to the
image directory when no camera is available.
