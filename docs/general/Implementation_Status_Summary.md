# Knowing Eye — Implementation Status Summary

*Last updated: 2026-05-25. Prefer this file over the root README when docs conflict.*

## Stack

| Layer | Technology | Status |
|-------|------------|--------|
| Frontend | React 18, Vite, TypeScript, Tailwind, shadcn/ui | `npm run dev` → `http://127.0.0.1:5173` |
| Backend | Django 6, DRF, SimpleJWT | `backend/run-api.cmd` or `runserver` → `http://127.0.0.1:8000` |
| Database | SQLite (dev), PostgreSQL (prod target) | SQLite default via `DB_ENGINE` |
| AI / CV | `pipeline_playground/knowing_eye` | Integrated via `backend/ai/adapter.py` (stub fallback without ML deps) |

## Module completion

| Module | Backend API | Unit tests | Frontend wired |
|--------|-------------|------------|----------------|
| Authentication | JWT login, register, profile | Yes | Login page |
| Exams | CRUD, publish/archive | Yes | Student dashboard list |
| Sessions | Start, submit, scoring | Yes | Exam-taking (backend page) |
| Monitoring | Frame POST + health | Yes | Webcam frames during exam |
| Behavior | Logs + alerts persistence | Yes | Via monitoring response |
| Reports | Summary + session report | Yes | Pending dashboard polish |
| AI pipeline | Stub or playground | Playground separate (`:8090`) | N/A |

## Quick run (Windows)

```powershell
# Terminal 1 — API
cd backend
$env:DB_ENGINE="django.db.backends.sqlite3"
python manage.py migrate
python manage.py seed_db --noinput   # first time only
python manage.py runserver 127.0.0.1:8000

# Terminal 2 — UI
cd frontend
npm run dev
```

Or double-click `start-dev.cmd` at the repo root.

**Low memory?** Close other apps first. Run API alone via `backend/run-api.cmd`. If Vite fails with heap OOM, open a fresh terminal and run `cd frontend && set NODE_OPTIONS=--max-old-space-size=8192 && npm run dev`.

## Test accounts (after `seed_db`)

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `adminpass` |
| Examinee | `user02` | `pass002` |

## API smoke checks

- Health: `GET http://127.0.0.1:8000/api/monitoring/health/`
- Login: `POST http://127.0.0.1:8000/api/auth/token/` with `username` / `password`

## Unit tests

```powershell
cd backend
$env:DB_ENGINE="django.db.backends.sqlite3"
python manage.py test features.authentication.tests.test_auth_api features.exams.tests.test_exams_api features.session.tests.test_session_api features.behavior.tests.test_behavior_api features.monitoring.tests.test_monitoring_api features.reports.tests.test_reports_api
```

## Testing documentation

- **IEEE pack (Knowing Eye):** `docs/testing/testing(IEEE)/`
- **UTAUT pack (Knowing Eye):** `docs/testing/testing(UTAUT)/`
- **OSAS reference (frozen):** `docs/testing/testing(IEEE)[reference]/`, `testing(UTAUT)[reference]/`

## Remaining work

- WebSocket monitoring (Channels consumer)
- Full `pipeline_playground` ML stack in production (optional `pip install` of playground requirements)
- Admin dashboard wired to `/api/reports/summary/`
- PostgreSQL production deployment

## Related docs

- WBS: `pipeline_playground/docs/general/workflow.tree`
- Architecture: `docs/backend/backend_structure.json`, `docs/database/database_schema.json`
- Main thesis doc: `docs/general/MAIN_DOCUMENT.docx`
