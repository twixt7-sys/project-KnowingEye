# Test Plan — Knowing Eye

*IEEE 829-style plan, sized for a capstone. Author: Kervy Cadiente (QA
reviewer). This plan is the execution instrument for
`docs/documentation/chapter2/04-system-testing.html`, which already defines a
good methodology (5-level verification, scenarios ST-01…ST-06, a
confusion-matrix method for CV classification, and pre-declared targets of
Accuracy ≥90% / Recall ≥88% / Precision ≥88% / F1 ≥88%) but states plainly that
it "has not yet been executed." This document does not replace that
methodology — it is what actually runs it, plus the two levels that
methodology is missing.*

## 1. Scope

**In scope:** every feature app under `backend/features/`, the RBAC/PBAC engine
(`backend/core/security/`), the CV pipeline's API contract (`backend/ai/`), and
the React frontend's route/auth/proctoring layer.

**Out of scope for this plan:** the manuscript deliverables that are not
testing work — CV literature citations, dataset methodology narrative,
algorithm-comparison writeup. Those stay in `docs/todo` §5. Where a manuscript
item *is* also a testing deliverable (the load test, classification metrics),
it is in scope here and cross-referenced there.

## 2. Test levels

| Level | What it verifies | Tooling | Status |
|---|---|---|---|
| Unit | Individual functions/services (escalation tiers, validators, serializers) | Django `TestCase`, Vitest | 167 backend / 33 frontend tests exist |
| Integration | API endpoints against a real DB, including permission checks | Django `APITestCase` (`rest_framework.test`) | Present for most modules — see `03-test-cases.csv` `automated_by` column for gaps |
| WebSocket | `ChannelsLiveServerTestCase` / async consumer tests | `features/monitoring/tests/test_websocket.py` | 6 tests; requires `cv2`/`mediapipe` installed to even import (see §5) |
| System / E2E | Full user journeys across the stack | `core/tests/test_smoke_api.py` (one long walk); no browser-driven E2E exists | Manual pass required — see `07-manual-checklists.md` |
| **Security / authorization** | **Verb × role matrix per endpoint — the level this system's existing plan omits entirely** | New in this document | **Not previously planned. This is where Group A findings in `06-qa-findings.md` live.** |
| Performance / load | Concurrency handling, response time under load | None exists | **P0, unexecuted — §7 below** |
| UAT | `docs/documentation/chapter2/04-system-testing.html`'s UTAUT survey instrument | Survey, 25 items / 5 constructs | Instrument designed, not administered |

## 3. Test approach by level

### 3.1 Unit + Integration (backend)
Run via:
```bash
cd backend
python3.12 -m venv venv && source venv/bin/activate
pip install -r requirements-core.txt -r requirements-cv.txt
export DB_ENGINE=django.db.backends.sqlite3
export OPENBLAS_NUM_THREADS=1
python manage.py test features core shared --verbosity=1
```
**Do not use `python manage.py test features core shared ai`** — the `ai` app's
one test file is pytest-style and will always report an import error under
Django's runner (finding C-2). Run it separately, honestly, as a failing
result:
```bash
pip install pytest   # not in any requirements file — install manually to see this run at all
python -m pytest ai/tests/
```

### 3.2 Unit (frontend)
```bash
cd frontend
npm install
npm test -- --run
```

### 3.3 Type safety
**This project has no `typecheck` script and `typescript` is not a dependency**
(finding C-1). Until that's fixed, run manually:
```bash
cd frontend
npm install --no-save typescript@5.8.3   # pin near what @types/react was authored against
./node_modules/.bin/tsc -b --noEmit
```
Do not use `npx tsc` without pinning a version — the latest published
TypeScript deprecates `baseUrl` and rejects the project's own
`erasableSyntaxOnly` option depending on which side of that transition it
lands on, which produces tooling noise instead of real findings.

### 3.4 Security / authorization (new — see `07-manual-checklists.md` §2)
For every endpoint in `03-test-cases.csv`'s `KE-SEC-*` block: authenticate as
the *lowest*-privileged role that can reach the endpoint at all, then attempt
every HTTP verb the route supports, not just the one the UI happens to send.
This is the exact gap that produced findings A-1, A-2, and A-3 — each is a
verb the frontend never sends but the API still accepts.

### 3.5 Stub vs. production CV mode — mandatory precondition for any CV test
Before running or reporting *any* monitoring/behavior test result, confirm the
pipeline mode:
```bash
curl http://127.0.0.1:8000/api/monitoring/health/
```
This project's own dependency setup does not install ArcFace
(`requirements-identity.txt` is referenced by nothing), so **identity
verification runs in `appearance` mode** (a 16×16 grayscale comparison) even
when the face/pose pipeline itself reports `production`. Confirmed live in
this pass:
```
$ python -c "... IdentityVerifier() ..."
active backend: appearance
```
**No classification metric (accuracy/precision/recall/F1 against the
methodology's targets) may be reported from an appearance-fallback run** —
doing so would put a fabricated performance figure in the manuscript. If real
identity-verification numbers are needed for the defense, install
`requirements-identity.txt` and re-confirm `active backend: arcface` before
collecting data.

### 3.6 System / E2E
No browser-automation E2E suite exists (confirmed: no Playwright/Cypress
config or dependency in either `package.json`). Until one exists, use
`07-manual-checklists.md` for the release-smoke and exam-lifecycle walks.

## 4. Environment & data

| Item | Value |
|---|---|
| Python | **3.12 required** — confirmed live: `pip install Django==6.0.3` fails under 3.11 ("Requires-Python >=3.12"); the committed `backend/venv/` was likely built on Windows with 3.12. |
| Node | 22.x confirmed working (`npm install` succeeds clean, 364 packages) |
| DB | SQLite for this plan (`DB_ENGINE=django.db.backends.sqlite3`); do not use the committed `backend/db.sqlite3` — it contains real personal data (finding D-1) and is migration-stale |
| Seed data | `python manage.py seed_db --noinput` — creates `admin`/`adminpass` (or your `SEED_ADMIN_*`) and `examinee01..20`/`pass001..020` |
| CV mode | Confirm via `/api/monitoring/health/` before every monitoring/behavior test session |

## 5. Entry criteria

- Backend installs clean from `requirements-core.txt` (+ `-cv.txt` for
  monitoring/behavior/AI tests) on Python 3.12.
- Frontend installs clean via `npm install`.
- Migrations apply clean on a fresh SQLite file.
- Seed data loads without error.

All four were verified in this pass (see §6 for the one caveat).

## 6. Baseline results from this pass

*(Filled in from actually running the commands above — not asserted from a
commit message. See `05-defect-log.csv` for the individual defects these
runs surfaced.)*

| Suite | Command | Result |
|---|---|---|
| Backend (`features core shared`) | `python manage.py test features core shared` | See `README.md` for the exact pass/fail counts from this run — the numbers there are current as of this document's date, not carried forward from prior docs |
| Backend `ai` | `python manage.py test ai` | **Fails to import — `ModuleNotFoundError: No module named 'pytest'`.** Confirms C-2. 0 of the 4 AI tests execute under this project's documented test command. |
| Frontend unit | `npm test -- --run` | **32 passed, 1 failed** — `question-import-template.test.ts` expects a CSV header the exporter no longer produces (test drift; see DEF-002 in `05-defect-log.csv`). |
| Frontend typecheck | `tsc -b --noEmit` (TS 5.8.3) | **12 errors across 8 files** — first typecheck this codebase has ever had (DEF-001). |
| CV pipeline mode | `GET /api/monitoring/health/` equivalent, direct call | `production` (mediapipe loads once `requirements-cv.txt` is installed) |
| Identity backend | direct call to `IdentityVerifier()` | **`appearance`** — ArcFace not installed by the documented setup path (confirms A-5) |

## 7. Load / capacity test procedure (P0, unexecuted — do this next)

No load test has ever been run against this system (finding C-7). Procedure,
matching the panel's own request in `docs/todo:219-222`:

1. Seed N examinee accounts and one published exam with monitoring enabled.
2. Using a tool the team already has available (e.g. `locust`, or a simple
   asyncio/`httpx` script since no load-testing tool is currently a
   dependency), simulate concurrent sessions at N = 5, 10, 20, 30, 50, 100:
   - `POST /sessions/start/`
   - repeated `POST /monitoring/frame/` at ~1 fps per session (the frontend's
     own default interval — see `frontend/src/shared/hooks/use-monitoring.ts`)
   - `PATCH /sessions/{id}/responses/` a few times
   - `POST /sessions/{id}/submit/`
3. At each N, record: p50/p95 response time per endpoint, server CPU/RAM,
   error rate, and whether `CHANNEL_LAYERS` (in-memory by default — see
   `06-qa-findings.md`, backend settings) causes any dropped alert broadcasts
   under concurrent WebSocket load.
4. Answer directly, as the panel asked: can this deployment handle ~30
   examinees in one room and ~100 total? Put a number on it, not a guess.

## 8. Exit criteria

- All `KE-*` cases in `03-test-cases.csv` are either passing, or logged in
  `05-defect-log.csv` with a severity and owner.
- Every Group A finding in `06-qa-findings.md` has a decision recorded (fixed,
  or explicitly accepted with a reason) before the next defense.
- The load test in §7 has run at least once with recorded numbers.
- `04-traceability-matrix.csv` has no row where `claimed_status` and
  `verified_status` disagree without an explanation.

## 9. Suspension / resumption

Suspend a test session if: the backend can't reach `production` CV mode when a
test explicitly requires it (confirm via `/api/monitoring/health/` first,
don't guess), or the seed data is contaminated by a previous manual test run
(re-run `seed_db --noinput` against a fresh SQLite file to resume cleanly).

## 10. Roles

| Role | Responsibility |
|---|---|
| Kervy Cadiente (QA) | Own this plan, `03-test-cases.csv`, `05-defect-log.csv`; run the security/authorization pass |
| Twixt Jasley Tamera (dev) | Fix defects logged against backend/frontend code |
| Team | Decide on Group D remedies (secrets rotation, repo history) together |

## 11. Deliverables

`02-test-plan.md` (this file), `03-test-cases.csv`, `04-traceability-matrix.csv`,
`05-defect-log.csv`, `07-manual-checklists.md`, plus whatever evidence
accumulates under `evidence/`.
