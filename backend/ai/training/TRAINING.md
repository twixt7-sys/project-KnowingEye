# Training Guide - Knowing Eye CV Pipeline

The production pipeline lives in `backend/ai/knowing_eye/` and is loaded by
`backend/ai/adapter.py`. This guide covers fine-tuning YOLO weights and tuning
behavior thresholds for the integrated Django backend.

## What you can train

| Component | Default | Fine-tunable? | Notes |
|-----------|---------|---------------|-------|
| Face / pose landmarks | MediaPipe (pretrained) | No - use as-is or swap model | Same or custom CNN |
| Object detection (phone, person) | YOLOv8n COCO pretrained | **Yes - YOLO fine-tune** | See sections below |
| Identity consistency | ArcFace embeddings | Optional - collect pairs | InsightFace `buffalo_l` |
| Behavior scoring | Rule-based weights in YAML | Tune thresholds + weights | LSTM / classifier (future) |

## 1. Collect mock exam data (required for custom YOLO)

1. Obtain **written consent** from participants (capstone requirement).
2. Record 10–30 minute mock exam sessions with webcam (720p+, good lighting).
3. Export frames every 1–2 seconds with ffmpeg:
   ```bash
   ffmpeg -i session.mp4 -vf fps=0.5 ai/training/raw/images/frame_%04d.jpg
   ```
4. Store under `backend/ai/training/raw/images/`.

## 2. Label data for YOLO

Use [Roboflow](https://roboflow.com), [CVAT](https://www.cvat.ai), or [labelImg](https://github.com/HumanSignal/labelImg).

**Classes (recommended):**

- `0` - face (examinee)
- `1` - bad_posture (optional bounding region)
- `2` - cell_phone

Export in **YOLO format** (one `.txt` per image, normalized boxes).

Place labels in `backend/ai/training/raw/labels/` matching image filenames.

## 3. Public datasets (optional boost)

| Dataset | Use |
|---------|-----|
| [WIDER Face](http://shuoyang1213.me/WIDERFACE/) | Face detection density |
| [COCO](https://cocodataset.org/) | Person / cell phone (already in YOLOv8) |
| [MPII Human Pose](http://human-pose.mpi-inf.mpg.de/) | Posture reference (convert or use MediaPipe) |
| Custom LTO-style mock exams | Domain-specific phones, lighting, seating |

Merge a subset into `ai/training/data/` using `ai/scripts/prepare_dataset.py`.

## 4. Prepare train/val split

From the `backend/` directory:

```powershell
python ai/scripts/prepare_dataset.py ai/training/raw --out ai/training/data --val-ratio 0.2
copy ai\training\data\dataset.yaml.example ai\training\data\dataset.yaml
```

Edit `dataset.yaml` paths if needed.

## 5. Train YOLO (local GPU or Google Colab)

**Local (NVIDIA GPU recommended):**

```powershell
cd backend
pip install torch torchvision  # match your CUDA version
python ai/scripts/train_yolo.py --data ai/training/data/dataset.yaml --epochs 50 --batch 16
```

**Google Colab:**

1. Upload `ai/training/data` or mount Drive.
2. `!pip install ultralytics`
3. Run the same `train_yolo.py` command.
4. Download `ai/training/runs/knowing_eye_proctor/weights/best.pt`.

**Point the pipeline at your weights:**

```yaml
# backend/ai/config/pipeline.yaml
detection:
  yolo_model: ai/training/runs/knowing_eye_proctor/weights/best.pt
```

Restart the API process after updating the config.

## 6. Tune behavior thresholds (no GPU)

Edit `backend/ai/config/pipeline.yaml`:

- `gaze_yaw_threshold_deg` / `gaze_pitch_threshold_deg` - looking away sensitivity
- `posture_shoulder_tilt_max` - slouch / lean detection
- `behavior.weights` - how much each event lowers `behavior_score`

Validate with mock sessions via the monitoring WebSocket or REST frame endpoint.

## 7. Identity model (ArcFace)

The pipeline uses **InsightFace ArcFace** (`buffalo_l` by default) for 512-D identity
embeddings. Install optional deps from the `backend/` directory:

```powershell
pip install -r requirements-identity.txt
```

Configure in `backend/ai/config/pipeline.yaml`:

```yaml
recognition:
  embedding_backend: arcface
  arcface_model: buffalo_l
pipeline:
  identity_match_threshold: 0.42  # cosine distance; lower = stricter
```

## 8. Evaluation metrics (for capstone reporting)

Track on a held-out mock exam set:

- Face detection rate (frames with face / total)
- False alert rate per event type
- Identity verification accuracy (enrolled vs impostor clips)
- Latency (ms per frame at 640px width)

Example: process a labeled video and compare predicted `events` to ground-truth timestamps.

## Runtime integration

The trained pipeline is consumed automatically by:

- `backend/ai/adapter.py` - lazy-loads `BehaviorPipeline` from `backend/ai/knowing_eye/`
- `backend/features/monitoring/consumers.py` - WebSocket frame stream
- `backend/features/monitoring/views.py` - REST frame/enroll endpoints

Check `/api/monitoring/health/` for the current `pipeline_mode` (`production`, `stub`, or `disabled`).
