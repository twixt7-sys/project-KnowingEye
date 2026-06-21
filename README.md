# Knowing Eye

**Full-Stack Session-Guided Web Examination Platform with Behavior Monitoring**

A production-ready platform that combines a centralized exam delivery system
with real-time computer-vision behavior analysis for examination integrity.

| Layer    | Stack |
|----------|-------|
| Frontend | React 18, Vite, TypeScript, Tailwind, Recharts |
| Backend  | Django 6, DRF, SimpleJWT, Channels (Daphne ASGI) |
| Realtime | WebSocket (Channels) for live monitoring |
| AI / CV  | YOLOv8, MediaPipe, FaceNet-compatible identity verification |
| Database | SQLite (dev), PostgreSQL (prod) |

## Project layout

```text
project-KnowingEye/
├── backend/                 Django REST + Channels API
│   ├── ai/                  Production CV pipeline (knowing_eye) + adapter
│   ├── core/                Settings, ASGI/WSGI, exceptions, management
│   └── features/            authentication, exams, session, monitoring, behavior, reports
├── frontend/                React + Vite UI
│   └── src/
│       ├── core/            providers, router, api client, env
│       ├── pages/           home, login, dashboard, monitoring, reports, profile, …
│       └── shared/          components, hooks (use-monitoring), utilities
├── pipeline_playground/     Installable CV/AI module (YOLO + MediaPipe + scoring)
│   ├── knowing_eye/         preprocessing/detection/recognition/behavior packages
│   ├── api/                 FastAPI standalone playground (optional)
│   └── config/pipeline.yaml Thresholds & model paths
├── docs/                    Architecture, deployment, IEEE / UTAUT testing (Knowing Eye)
├── misc/                    Archived artifacts & dead code (see misc/README.md)
├── REPOSITORY_GUIDE.md      Contributor map — start here if new to the repo
└── start-dev.cmd            One-click dev bootstrap (Windows)
```

## Quick start (Windows)

Double-click `start-dev.cmd` at the repo root. This boots:

* `http://127.0.0.1:8000/`     → Django ASGI (HTTP + WebSocket)
* `http://127.0.0.1:5173/`     → Vite dev server with HMR

### Manual

**First time only** — install Python dependencies (creates `backend/venv/`):

```powershell
cd backend
.\setup-venv.cmd
```

```powershell
# --- 1. Backend ---
cd backend
.\venv\Scripts\Activate.ps1          # skip if you used setup-venv.cmd
$env:DB_ENGINE = "django.db.backends.sqlite3"
python manage.py migrate
python manage.py seed_db --noinput      # first run only
python -m daphne -b 127.0.0.1 -p 8000 core.config.asgi:application

# --- 2. Frontend ---
cd ../frontend
npm install
copy .env.example .env.local           # optional
npm run dev
```

### Seed accounts

| Role     | Username | Password    |
|----------|----------|-------------|
| Admin    | `admin`  | `adminpass` |
| Examinee | `user02` | `pass002`   |

## API surface

| Method | Path                                                  | Purpose                                  |
|--------|-------------------------------------------------------|------------------------------------------|
| GET    | `/api/monitoring/health/`                             | Health + pipeline mode                   |
| POST   | `/api/auth/token/`                                    | JWT login (access + refresh)             |
| POST   | `/api/auth/token/refresh/`                            | Rotate JWT                               |
| POST   | `/api/auth/register/`                                 | Create a user                            |
| GET    | `/api/auth/profile/me/`                               | Current user profile                    |
| PATCH  | `/api/auth/profile/update_profile/`                   | Edit profile                             |
| POST   | `/api/auth/profile/avatar/`                           | Upload avatar (`multipart/form-data`)    |
| POST   | `/api/auth/profile/change-password/`                  | Change password                          |
| GET    | `/api/exams/`                                         | List exams (paginated)                   |
| POST   | `/api/exams/`                                         | Create exam (admin)                      |
| POST   | `/api/exams/{id}/publish/`                            | Publish a draft exam                     |
| POST   | `/api/sessions/start/`                                | Start an exam session                    |
| POST   | `/api/sessions/{uuid}/submit/`                        | Submit answers                           |
| POST   | `/api/monitoring/frame/`                              | Analyze a single base64 frame            |
| POST   | `/api/monitoring/enroll/`                             | Enroll a reference face                  |
| GET    | `/api/behavior/logs/?session={uuid}`                  | Behavior events                          |
| GET    | `/api/behavior/alerts/?resolved=false`                | Unresolved alerts                        |
| POST   | `/api/behavior/alerts/{id}/resolve/`                  | Resolve an alert (admin)                 |
| GET    | `/api/reports/summary/`                               | Dashboard KPIs                           |
| GET    | `/api/reports/sessions/`                              | Paginated session reports               |
| GET    | `/api/reports/sessions/{uuid}/`                       | Full session report                      |
| GET    | `/api/reports/timeseries/`                            | Per-day activity                         |
| GET    | `/api/reports/export/csv/`                            | CSV download                             |
| WS     | `/ws/monitoring/{uuid}/?token={jwt-access}`           | Live monitoring (frame stream + alerts)  |

The WebSocket protocol is documented in `backend/features/monitoring/consumers.py`.

## Computer-Vision pipeline

`backend/ai/adapter.py` loads the production pipeline from `backend/ai/knowing_eye`.
If ML dependencies aren't present it falls back to a deterministic stub so the
monitoring API contract is always honoured.

```text
Webcam ► JPEG/base64 ► /api/monitoring/frame/ (REST) or /ws/monitoring/* (WebSocket)
       ► ai.adapter.analyze_frame_bgr()  ← backend/ai/knowing_eye.BehaviorPipeline
       ► metrics + events + alerts ► persisted via features.behavior.services
```

### Install the full ML stack

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements-cv.txt
# optional ArcFace identity verification (Windows may need Visual C++ build tools):
pip install -r ../pipeline_playground/requirements-identity.txt
```

When dependencies load successfully the adapter runs in **`production`** mode
(stub otherwise).

### Tune thresholds

Edit `backend/ai/config/pipeline.yaml` — values control preprocessing, compliance
thresholds, alert severities, and metric weights. The adapter picks the file up
automatically on next process start.

## Tests

```powershell
cd backend
$env:DB_ENGINE = "django.db.backends.sqlite3"
$env:OPENBLAS_NUM_THREADS = "1"
python manage.py test features
```

Currently **32 tests** across:

* `features.authentication` — JWT, registration, profile, password change, refresh
* `features.exams` — CRUD, publish/archive
* `features.session` — start, submit, lifecycle
* `features.monitoring` — REST frame, enroll, **WebSocket consumer**, RBAC
* `features.behavior` — logs + alerts persistence
* `features.reports` — summary, detail, CSV export, timeseries

## Production deployment

See [docs/deployment.md](docs/deployment.md) for the full guide. Highlights:

1. Set `DJANGO_DEBUG=False`, generate a strong `DJANGO_SECRET_KEY`.
2. Switch the database with `DB_ENGINE=django.db.backends.postgresql` + creds.
3. (Optional but recommended) point `REDIS_URL` to a Redis cluster for the
   Channels layer so multiple Daphne workers can broadcast alerts to each other.
4. Run with Daphne or Uvicorn behind Nginx as a reverse proxy.
5. Serve the React app from `frontend/dist/` (built via `npm run build`).

## Documentation

* **Repository guide:** [REPOSITORY_GUIDE.md](REPOSITORY_GUIDE.md)
* **Implementation status:** [docs/general/Implementation_Status_Summary.md](docs/general/Implementation_Status_Summary.md)
* **WBS:** [docs/general/workflow.tree](docs/general/workflow.tree)
* **Deployment:** [docs/deployment.md](docs/deployment.md)
* **Pipeline integration:** [pipeline_playground/README.md](pipeline_playground/README.md)

## Team

Legacy College of Compostela — Institute of Information Technology (capstone).
