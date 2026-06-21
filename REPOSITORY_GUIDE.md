# Repository guide

A map of **Knowing Eye** for contributors — whether you are new to the stack or reviewing architecture.

## What this project is

A capstone full-stack platform that delivers timed exams and monitors examinee behavior in real time using computer vision (face, gaze, posture, identity).

```text
Browser (React) ──REST/JWT──► Django API (DRF + Channels)
                                    │
                                    ├── SQLite / PostgreSQL
                                    └── ai.adapter ──► backend/ai/knowing_eye (YOLO, MediaPipe, …)
Webcam frames ──WebSocket──► monitoring consumer ──► same pipeline
```

## Where to start

| Goal | Start here |
|------|------------|
| Run locally (Windows) | Double-click `start-dev.cmd` |
| Run locally (manual) | [README.md](README.md) → Quick start |
| API endpoints | [README.md](README.md) → API surface |
| Implementation status | [docs/general/Implementation_Status_Summary.md](docs/general/Implementation_Status_Summary.md) |
| Deploy to production | [docs/deployment.md](docs/deployment.md) |
| CV pipeline tuning | [backend/ai/training/TRAINING.md](backend/ai/training/TRAINING.md) |

**Seed logins** (after `python manage.py seed_db --noinput`):

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `adminpass` |
| Examinee | `user02` | `pass002` |

## Directory map

```text
project-KnowingEye/
├── backend/              Django REST + WebSocket API
│   ├── ai/               Bridge to CV pipeline (stub fallback when ML missing)
│   ├── core/             Settings, ASGI, shared config
│   ├── features/         Domain apps (auth, exams, session, monitoring, behavior, reports)
│   └── seed_data/        CSV seeds for dev/demo
├── frontend/             React SPA (see frontend/README.md)
├── docs/                 Architecture, deployment, thesis/testing (Knowing Eye)
├── misc/                 Archived / unrelated artifacts (safe to delete after review)
├── start-dev.cmd         Windows dev bootstrap
└── test-all.cmd          Run backend feature + AI pipeline test suites
```

## Backend conventions

- **Feature apps** under `backend/features/<name>/`: `models`, `serializers`, `views`, `urls`, `services`, `tests`.
- **Permissions** use the custom `User.role` field (`ADMIN` / `EXAMINEE`), not Django `is_staff`.
- **Shared repository base** lives in `backend/shared/repositories/base_repository.py` (used by exams).
- **Run with Daphne**, not `runserver`, so WebSockets work.

## Frontend conventions

- **Pages** in `frontend/src/pages/` — one file per route screen.
- **Feature modules** in `frontend/src/features/` — thin wrappers over `apiClient`.
- **Shared UI** in `frontend/src/shared/components/ui/` — shadcn/Radix primitives.
- **Monitoring hook** — `useMonitoring` in `shared/hooks/` (re-exported from features).

## Tests

```powershell
# From repo root
.\test-all.cmd

# Backend only
cd backend
$env:DB_ENGINE = "django.db.backends.sqlite3"
python manage.py test features

# AI pipeline only
cd backend
python -m pytest ai/tests/
```

Backend: **32 tests** across auth, exams, sessions, monitoring (REST + WebSocket), behavior, reports.

Frontend automated tests are not yet set up; manual smoke: login → start exam → submit → view reports.

## What is in `misc/`?

Prior thesis artifacts, OSAS reference packs from another project, duplicate doc trees, and superseded mock UI files. See [misc/README.md](misc/README.md). Nothing in `misc/` is imported by the application.

## Common pitfalls

1. **Stale JSON schemas** in `docs/database/` and `docs/backend/` may differ from live models — trust the code and [Implementation_Status_Summary.md](docs/general/Implementation_Status_Summary.md).
2. **ML stack is optional** — without MediaPipe/YOLO the API uses a deterministic stub; monitoring still works end-to-end.
3. **Registration always creates EXAMINEE** — admin users must be seeded or promoted in the database.

## Documentation index

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Overview, API table, quick start |
| [REPOSITORY_GUIDE.md](REPOSITORY_GUIDE.md) | This file |
| [docs/deployment.md](docs/deployment.md) | Production |
| [docs/backend/commands.txt](docs/backend/commands.txt) | CLI cheat sheet |
| [frontend/README.md](frontend/README.md) | UI structure |
| [backend/ai/training/TRAINING.md](backend/ai/training/TRAINING.md) | CV pipeline training & tuning |
