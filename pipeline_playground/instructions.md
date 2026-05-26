# Knowing Eye — Pipeline playground startup

This module is the **computer-vision pipeline** that powers behavior monitoring
for the Knowing Eye platform. Two usage modes are supported:

| Mode | Use when |
|------|----------|
| **Integrated (recommended)** | You're running the full Django + React stack — the backend imports this package automatically through `backend/ai/adapter.py`. Nothing else to do. |
| **Standalone playground**    | You want to iterate on CV thresholds, train YOLO, or test webcam analysis in isolation. Boots a tiny FastAPI server with a live dashboard. |

---

## Mode A — integrated (default)

When the main stack starts (`start-dev.cmd` at the repo root), the Django
backend imports `knowing_eye.pipeline.BehaviorPipeline` from this folder. If
the heavy ML dependencies aren't installed the adapter degrades gracefully to
a deterministic stub and the rest of the system keeps working.

### Activate the full ML pipeline

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install mediapipe ultralytics PyYAML
# optional facial identity verification (needs Visual C++ build tools)
pip install -r ..\pipeline_playground\requirements-identity.txt
```

The pipeline mode reported by `GET /api/monitoring/health/` will flip from
`stub` → `playground` after the next backend restart. Tune thresholds in
`pipeline_playground/config/pipeline.yaml`.

---

## Mode B — standalone playground

Useful for offline CV iteration. Brings up a FastAPI server with a live
webcam dashboard at <http://127.0.0.1:8090>.

### Prerequisites

| Requirement      | Notes                                                                                  |
|------------------|----------------------------------------------------------------------------------------|
| **Windows 10/11**| Tested in PowerShell                                                                   |
| **Python 3.10+** | Tick "Add python.exe to PATH" during install                                           |
| **Webcam**       | Needed for the live dashboard; image/video scripts work without one                    |
| **~2 GB disk**   | Virtual environment + ML deps; YOLO downloads weights on first run                     |

Verify Python:

```powershell
python --version
```

### Quick start

```powershell
cd pipeline_playground
.\start.ps1
```

Wait for `Application startup complete` (30–90 s the first time while YOLO and
MediaPipe initialize), then open <http://127.0.0.1:8090>. Stop with `Ctrl+C`.

Or **double-click `start.cmd`** in File Explorer.

### Manual setup (alternative)

```powershell
cd pipeline_playground
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn api.main:app --host 127.0.0.1 --port 8090
```

### Why `start.ps1` alone won't work

PowerShell doesn't execute scripts from the current directory unless you
prefix them. Use:

```powershell
.\start.ps1   # backslash-dot
```

---

## Troubleshooting

### `Running scripts is disabled on this system`

```powershell
.\start.cmd
# or:
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

### `dlib` / `face-recognition` build error

Ignore it — the core deps don't include `face-recognition`. The pipeline still
runs; `identity_match` simply stays `null`. To enable identity matching later,
install the [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
and then:

```powershell
.\.venv\Scripts\Activate.ps1
pip install cmake
pip install -r requirements-identity.txt
```

### Port 8090 already in use

```powershell
netstat -ano | findstr :8090
taskkill /PID <pid> /F
```

### Browser shows nothing

* Confirm the terminal still shows the server running.
* Wait for startup — first launch downloads YOLO weights.
* Health check:

  ```powershell
  Invoke-RestMethod http://127.0.0.1:8090/health
  ```

### Webcam not working

* Allow camera access in the browser prompt.
* Use Chrome or Edge.
* Close other apps using the camera (Zoom, Teams, Discord).

---

## Other ways to run

### OpenCV webcam window (no browser)

```powershell
.\.venv\Scripts\Activate.ps1
python scripts\run_webcam.py --session-id demo-001
```

Press **Q** to quit.

### Analyze a single image or video

```powershell
.\.venv\Scripts\Activate.ps1
python scripts\analyze_image.py path\to\photo.jpg --session-id test-1
python scripts\analyze_image.py path\to\clip.mp4 --every-n 10 --reference enroll.jpg
```

### Tests

```powershell
.\.venv\Scripts\Activate.ps1
pip install pytest
pytest tests/ -q
```

---

## What `start.ps1` does

1. `cd` into this folder.
2. Creates `.venv` if missing.
3. Installs `requirements.txt`.
4. Launches Uvicorn serving `api.main:app` on <http://127.0.0.1:8090>.

The dashboard lives at `/`; health is at `/health`.

For architecture, API contracts, and integration with the Django app, see the
top-level [README.md](../README.md) and [docs/deployment.md](../docs/deployment.md).
