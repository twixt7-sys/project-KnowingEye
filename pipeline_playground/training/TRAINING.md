# Training Guide — Knowing Eye CV Playground

This playground supports the capstone training approach: **public datasets + controlled mock exam recordings with consent**.

## What you can train here

| Component | Playground default | Fine-tunable? | Production target (main system) |
|-----------|-------------------|---------------|----------------------------------|
| Face / pose landmarks | MediaPipe (pretrained) | No — use as-is or swap model | Same or custom CNN |
| Object detection (phone, person) | YOLOv8n COCO pretrained | **Yes — YOLO fine-tune** | YOLO per docs |
| Identity consistency | `face_recognition` embeddings | Optional — collect pairs | FaceNet / ArcFace |
| Behavior scoring | Rule-based weights in YAML | Tune thresholds + weights | LSTM / classifier (future) |

## 1. Collect mock exam data (required for custom YOLO)

1. Obtain **written consent** from participants (capstone requirement).
2. Record 10–30 minute mock exam sessions with webcam (720p+, good lighting).
3. Export frames every 1–2 seconds:
   ```bash
   python scripts/analyze_image.py path/to/session.mp4 --every-n 30 -o /tmp/frames.jsonl
   # Or use ffmpeg:
   ffmpeg -i session.mp4 -vf fps=0.5 training/raw/images/frame_%04d.jpg
   ```
4. Store under `training/raw/images/`.

## 2. Label data for YOLO

Use [Roboflow](https://roboflow.com), [CVAT](https://www.cvat.ai), or [labelImg](https://github.com/HumanSignal/labelImg).

**Classes (recommended):**

- `0` — face (examinee)
- `1` — bad_posture (optional bounding region)
- `2` — cell_phone

Export in **YOLO format** (one `.txt` per image, normalized boxes).

Place labels in `training/raw/labels/` matching image filenames.

## 3. Public datasets (optional boost)

| Dataset | Use |
|---------|-----|
| [WIDER Face](http://shuoyang1213.me/WIDERFACE/) | Face detection density |
| [COCO](https://cocodataset.org/) | Person / cell phone (already in YOLOv8) |
| [MPII Human Pose](http://human-pose.mpi-inf.mpg.de/) | Posture reference (convert or use MediaPipe) |
| Custom LTO-style mock exams | Domain-specific phones, lighting, seating |

Merge a subset into `training/data/` using `scripts/prepare_dataset.py`.

## 4. Prepare train/val split

```bash
python scripts/prepare_dataset.py training/raw --out training/data --val-ratio 0.2
copy training\data\dataset.yaml.example training\data\dataset.yaml
```

Edit `dataset.yaml` paths if needed.

## 5. Train YOLO (local GPU or Google Colab)

**Local (NVIDIA GPU recommended):**

```bash
pip install torch torchvision  # match your CUDA version
python scripts/train_yolo.py --data training/data/dataset.yaml --epochs 50 --batch 16
```

**Google Colab:**

1. Upload `training/data` or mount Drive.
2. `!pip install ultralytics`
3. Run the same `train_yolo.py` command.
4. Download `training/runs/knowing_eye_proctor/weights/best.pt`.

**Point the pipeline at your weights:**

```yaml
# config/pipeline.yaml
detection:
  yolo_model: training/runs/knowing_eye_proctor/weights/best.pt
```

## 6. Tune behavior thresholds (no GPU)

Edit `config/pipeline.yaml`:

- `gaze_yaw_threshold_deg` / `gaze_pitch_threshold_deg` — looking away sensitivity
- `posture_shoulder_tilt_max` — slouch / lean detection
- `behavior.weights` — how much each event lowers `behavior_score`
- `event_confidence_threshold` — minimum confidence to log an event

Validate with mock sessions and compare logs in `data/sessions/<session_id>/behavior_log.jsonl`.

## 7. Identity model (FaceNet / ArcFace — main system)

The playground uses `face_recognition` (128-D embeddings) for speed. For capstone alignment:

1. Collect 5–10 reference photos per examinee at enrollment.
2. Train or use pretrained **FaceNet** or **ArcFace** (e.g. `insightface` Python package).
3. Replace `knowing_eye/recognition/identity.py` with your embedding backend.
4. Keep the same `verify()` return shape: `(match: bool, distance: float)`.

## 8. Evaluation metrics (for capstone reporting)

Track on a held-out mock exam set:

- Face detection rate (frames with face / total)
- False alert rate per event type
- Identity verification accuracy (enrolled vs impostor clips)
- Latency (ms per frame at 640px width)

Example: process a labeled video and compare predicted `events` to ground-truth timestamps.

## Integration with main Django backend

After training:
1. Copy `best.pt` into main repo `ai/models/`.
2. Import `BehaviorPipeline` from this package (or vendor the `knowing_eye/` folder into `backend/ai/`).
3. In monitoring service: decode frame → `pipeline.analyze_frame()` → persist `behavior_logs` + `alerts`.
4. WebSocket: forward `analysis_result` payload shape from `api/main.py` `ws/monitor`.
