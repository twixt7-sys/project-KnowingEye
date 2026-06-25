# Knowing Eye - Implementation Status Summary

*Last updated: 2026-05-25. This is the canonical status doc - prefer it over the
root README when in conflict.*

## Stack

| Layer    | Technology                                            | Status                                                                                    |
|----------|-------------------------------------------------------|-------------------------------------------------------------------------------------------|
| Frontend | React 18, Vite, TypeScript, Tailwind, shadcn, Recharts | `npm run dev` → `http://127.0.0.1:5173`                                                   |
| Backend  | Django 6, DRF, SimpleJWT, **Channels (ASGI)**, Daphne  | `start-dev.cmd` or `backend/run-api.cmd` → `http://127.0.0.1:8000` (HTTP + WebSocket)     |
| Database | SQLite (dev), PostgreSQL (prod)                        | Set `DB_ENGINE` env var                                                                   |
| AI / CV  | `backend/ai/knowing_eye` (YOLO + MediaPipe + ArcFace)   | Integrated via `backend/ai/adapter.py` - auto-fallback to a stub when ML deps are absent |

## Module completion

| Module          | Backend API                                            | Tests       | Frontend                                              |
|-----------------|--------------------------------------------------------|-------------|-------------------------------------------------------|
| Authentication  | JWT (access + refresh + verify), register, profile, avatar, password change | ✓           | Login + profile pages, auto-refresh tokens             |
| Exams           | CRUD, publish/archive, nested questions                | ✓           | Dashboard list + create-exam modal                     |
| Sessions        | Start, submit, terminate, scoring, logs               | ✓           | Exam-taking page (with monitoring)                     |
| Monitoring      | REST `/frame/`, `/enroll/`, **`ws://ws/monitoring/`** | ✓ (incl. WS) | Live-monitoring dashboard + per-session inspector       |
| Behavior        | Logs + alerts persistence, resolve / resolve_all       | ✓           | Visualised in session inspector + dashboard            |
| Reports         | Summary, sessions list, detail, **CSV export**, **timeseries** | ✓           | Reports page with Recharts charts                      |
| Profile         | GET/PATCH/avatar upload/change-password               | ✓           | Profile page with avatar upload + security             |

## What is new in this revision

* **ASGI + WebSocket monitoring.** Daphne serves both HTTP and `ws://ws/monitoring/{session}/` with JWT auth via query-string token, JSON message protocol, group broadcast for alerts.
* **Pipeline integration hardened.** Thread-safe lazy loader, graceful degradation to a stub analyzer, `enroll_reference` exposed; production code lives in `backend/ai/knowing_eye/`.
* **Production-grade settings.** Decouple-based env config, structured logging to file + stdout, conditional production hardening (HSTS, secure cookies, SSL proxy), Redis-ready Channels layer.
* **Reports & analytics.** Pass-rate, severity histogram, behavior-event histogram, day-by-day timeseries, downloadable CSV.
* **Profile & avatars.** ImageField avatar, phone, institution, student-id; multipart upload endpoint; signed media via `MEDIA_URL`.
* **Tests.** Now 23 unit tests including 3 WebSocket-consumer integration tests through the full ASGI stack.

## Quick run (Windows)

```powershell
# One-click
start-dev.cmd

# OR manual:
cd backend
$env:DB_ENGINE = "django.db.backends.sqlite3"
$env:OPENBLAS_NUM_THREADS = "1"
python manage.py migrate
python manage.py seed_db --noinput        # first run only
python -m daphne -b 127.0.0.1 -p 8000 core.config.asgi:application

# Frontend
cd ../frontend
npm install
npm run dev
```

Open <http://127.0.0.1:5173/>. API base defaults to <http://127.0.0.1:8000/api>.

## Test accounts (after `seed_db`)

| Role     | Username | Password    |
|----------|----------|-------------|
| Admin    | `admin`  | `adminpass` |
| Examinee | `user02` | `pass002`   |

## Smoke checks

```powershell
# REST
curl http://127.0.0.1:8000/api/monitoring/health/
# WebSocket (requires wscat or similar)
wscat -c "ws://127.0.0.1:8000/ws/monitoring/<session-uuid>/?token=<access-token>"
```

## Tests

```powershell
cd backend
$env:DB_ENGINE = "django.db.backends.sqlite3"
$env:OPENBLAS_NUM_THREADS = "1"
python manage.py test features
```

All 23 tests pass.

## Documentation

* **Production deployment:** [docs/deployment.md](../deployment.md)
* **CV training & tuning:** [backend/ai/training/TRAINING.md](../../backend/ai/training/TRAINING.md)
* **WBS:** [docs/general/workflow.tree](./workflow.tree)
* **IEEE testing:** [docs/testing/testing(IEEE)/](../testing/testing\(IEEE\)/)
* **UTAUT testing:** [docs/testing/testing(UTAUT)/](../testing/testing\(UTAUT\)/)

## Remaining work (post-MVP)

* Replace `face_recognition` with FaceNet/ArcFace embeddings for production identity verification.
* End-to-end Playwright/Cypress test suite covering the SPA flows.
* Per-exam analytics: question-level difficulty + cheating-pattern correlations.
* Multi-tenant deployment (institutions × exam sets).
