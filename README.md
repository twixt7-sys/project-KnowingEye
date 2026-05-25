# Knowing Eye

A Full-Stack Session-Guided Web-Based Examination Platform with Integrated Behavior Monitoring (facial and postural analysis via computer vision).

## Project layout

```
project-KnowingEye/
├── backend/                 # Django REST API
├── frontend/                # React + Vite UI
├── pipeline_playground/     # CV/AI module (YOLO, MediaPipe, behavior scoring)
├── docs/                    # Architecture, thesis, IEEE & UTAUT testing packs
└── start-dev.cmd            # Windows: start API + UI
```

## Quick start

### 1. Backend

```powershell
cd backend
$env:DB_ENGINE="django.db.backends.sqlite3"
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_db --noinput    # first run; skip if already seeded
python manage.py runserver 127.0.0.1:8000
```

### 2. Frontend

```powershell
cd frontend
copy .env.example .env.local   # optional
npm install
npm run dev
```

Open **http://127.0.0.1:5173/** — API base defaults to **http://127.0.0.1:8000/api**.

### Test accounts (after seed)

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `adminpass` |
| Examinee | `user02` | `pass002` |

### Unit tests

```powershell
cd backend
$env:DB_ENGINE="django.db.backends.sqlite3"
python manage.py test features.authentication.tests.test_auth_api features.exams.tests.test_exams_api features.session.tests.test_session_api features.behavior.tests.test_behavior_api features.monitoring.tests.test_monitoring_api features.reports.tests.test_reports_api
```

## Key API routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/monitoring/health/` | Health + pipeline mode |
| POST | `/api/auth/token/` | JWT login |
| GET | `/api/exams/` | List exams |
| POST | `/api/sessions/start/` | Start exam session |
| POST | `/api/monitoring/frame/` | Submit webcam frame + AI analysis |
| GET | `/api/reports/summary/` | Admin dashboard stats |

## AI / monitoring

- Production path: `backend/ai/adapter.py` loads `pipeline_playground/knowing_eye` when ML deps are installed; otherwise uses a deterministic **stub** analyzer.
- Standalone playground UI: `cd pipeline_playground` → `uvicorn api.main:app --port 8090`

## Documentation

- **Status (canonical):** [docs/general/Implementation_Status_Summary.md](docs/general/Implementation_Status_Summary.md)
- **WBS:** [pipeline_playground/docs/general/workflow.tree](pipeline_playground/docs/general/workflow.tree)
- **IEEE testing:** [docs/testing/testing(IEEE)/](docs/testing/testing(IEEE)/)
- **UTAUT (Ch. 7):** [docs/testing/testing(UTAUT)/](docs/testing/testing(UTAUT)/)

## Team

Legacy College of Compostela — Institute of Information Technology (capstone).
