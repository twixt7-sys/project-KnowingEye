# Knowing Eye — CV/AI Pipeline Playground

Experimental **computer vision and behavior analysis** module for the [Knowing Eye](docs/general/Project.json) capstone. Use this repo to test facial and postural monitoring before integrating into the main Django + React system.

Aligned with project docs:

- **YOLO** — object / phone detection (fine-tunable)
- **MediaPipe** — face mesh, head pose, posture (playground stand-in for CNN feature paths)
- **ArcFace (InsightFace)** — 512-D identity embeddings (`buffalo_l` model)
- **Behavior scoring** — outputs `behavior_logs` and `alerts` event types from `docs/database/database_schema.json`

## Quick start

### 1. Environment (Python 3.10+)

```powershell
cd knowing-eye-pipeline
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Windows note:** ArcFace identity matching is optional — not in `requirements.txt`. After core install:

```powershell
pip install -r requirements-identity.txt
```

Installs InsightFace + ONNX Runtime. If install fails, the pipeline falls back to a lightweight appearance signature; `identity_match` may stay `null` without a usable backend.

### 2. Web UI (recommended)

```powershell
uvicorn api.main:app --host 127.0.0.1 --port 8090 --reload
```

Open **http://127.0.0.1:8090** — live webcam dashboard with 0–100% compliance metrics. Alerts fire when any metric drops below **80%**.

### 3. Webcam demo (OpenCV window)

```powershell
python scripts/run_webcam.py --session-id demo-001
```

Press **Q** to quit.

### 4. HTTP API (integration test)

- Health: `GET http://localhost:8090/health`
- Analyze frame (base64): `POST http://localhost:8090/analyze/frame`
- Django-compatible: `POST http://localhost:8090/api/monitoring/frame/`
- WebSocket: `ws://localhost:8090/ws/monitor` — send `{"type":"frame_stream","image":"<base64>","session_id":"..."}`

### 5. Analyze image or video

```powershell
python scripts/analyze_image.py path\to\photo.jpg --session-id test-1
python scripts/analyze_image.py path\to\exam_clip.mp4 --every-n 10 --reference path\to\enroll.jpg
```

## Project layout

```
knowing_eye/           # Core package (copy into main backend/ai/ later)
  preprocessing/       # Frame decode & resize
  detection/             # Face, pose, YOLO
  recognition/           # Identity verification
  behavior/              # Scoring → events & alerts
  pipeline.py            # BehaviorPipeline entry point
api/main.py              # FastAPI for integration testing
scripts/                 # Webcam, file analysis, dataset prep, YOLO train
config/pipeline.yaml     # Thresholds & model paths
training/                # Dataset layout & TRAINING.md
data/                    # Session logs & reference faces
```

## Output format (for main system)

Each analyzed frame returns JSON like:

```json
{
  "session_id": "uuid",
  "metrics": {
    "face_presence_pct": 100,
    "gaze_focus_pct": 92.5,
    "posture_compliance_pct": 88.0,
    "identity_match_pct": 95.0,
    "object_clear_pct": 100,
    "overall_compliance_pct": 94.2,
    "alert_threshold_pct": 80,
    "flagged_metrics": [],
    "all_compliant": true
  },
  "overall_compliance_pct": 94.2,
  "events": [],
  "alerts": []
}
```

Map `events[]` → `behavior_logs` table; `alerts[]` → `alerts` table in PostgreSQL.

## Integration checklist (main Django app)

1. Vendor or `pip install -e` this package from the monorepo.
2. In `monitoring_service.py`: call `BehaviorPipeline.analyze_frame(frame, session_id)`.
3. Persist `events` / `alerts` via existing behavior feature models.
4. Point WebSocket consumer at the same analysis payload as `api/main.py` `ws/monitor`.
5. Replace `face_recognition` with FaceNet/ArcFace when ready (see `training/TRAINING.md`).

## Training & tuning

See **[training/TRAINING.md](training/TRAINING.md)** for:

- Mock exam data collection (with consent)
- YOLO labeling and fine-tuning
- Public dataset suggestions
- Google Colab workflow
- Threshold tuning in `config/pipeline.yaml`
- FaceNet/ArcFace migration path

Short version:

```powershell
# 1. Label images → training/raw/images + labels
python scripts/prepare_dataset.py training/raw --out training/data
copy training\data\dataset.yaml.example training\data\dataset.yaml

# 2. Train (GPU recommended)
pip install torch torchvision
python scripts/train_yolo.py --data training/data/dataset.yaml --epochs 50

# 3. Update config/pipeline.yaml → yolo_model: training/runs/.../weights/best.pt
```

## Tests

```powershell
pip install pytest
pytest tests/ -q
```

## Capstone mapping

| Objective (Group 1 doc) | Playground module |
|-------------------------|-------------------|
| 3.1 Facial presence & identity | `FaceDetector` + `IdentityVerifier` |
| 3.2 Head movement, gaze, posture | MediaPipe pose + head pose angles |
| 3.3 Suspicious patterns | `BehaviorScorer` |
| 4.1 YOLO | `YoloDetector` (+ `train_yolo.py`) |
| 4.2 CNN features | MediaPipe embeddings (upgrade path documented) |
| 4.3 FaceNet/ArcFace | `identity.py` swap documented |
| 5.x Behavior scoring & flags | `behavior/scoring.py` |

## Team

Legacy College of Compostela — Knowing Eye capstone group (see `docs/general/Project.json`).
