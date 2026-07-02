# Knowing Eye — System Run & Regression Report

**Date:** 2026-07-02  
**Environment:** Windows 10 (26200), Python 3.12 / Django 6, Node + Vite 6, SQLite dev DB  
**Scope:** Backend unit/integration tests, frontend build + Vitest, live API smoke tests, browser UI regression (admin + examinee flows)

---

## Executive summary

The system is **largely functional** end-to-end: backend API, auth, exams/departments, sessions, monitoring health, reports, and core UI routes all work against the seeded database.

**Initial regression run:** 3 of 50 backend tests failed. All three were **test-suite drift** (not production bugs) and were fixed in this session. After fixes: **50/50 backend tests pass**, **8/8 frontend Vitest tests pass**, production build succeeds.

No blocking runtime failures were found in admin login, examiner dashboard, reports, monitoring, or examinee exam listing/setup flows.

---

## Test matrix

| Layer | Command | Result | Notes |
|-------|---------|--------|-------|
| Backend (features + ai) | `manage.py test features ai` | **50/50 PASS** | Was 47/50 before fixes |
| Backend (core) | `manage.py test core` | **2/2 PASS** | Exception handler envelope |
| Frontend build | `npm run build` | **PASS** | 3546 modules, ~1.9 MB JS bundle |
| Frontend unit | `npm run test` (Vitest) | **8/8 PASS** | Error-boundary “kaboom” logs are expected |
| API smoke | curl / Invoke-RestMethod | **PASS** | Health, JWT, exams, departments, reports |
| UI smoke (browser) | Manual via Cursor browser | **PASS** | See UI section below |

---

## Failures found and fixes applied

### 1. Registration tests — invalid JPEG fixture (FIXED)

**Symptom:** `test_register_examinee` and `test_register_rejects_admin_role_escalation` returned HTTP 400 with:

```text
avatar: Upload a valid image. The file you uploaded was either not an image or a corrupted image.
```

**Root cause:** `_sample_avatar()` in `features/authentication/tests/test_auth_api.py` used a minimal JPEG header blob. Pillow (used by Django `ImageField`) rejects it as corrupt. Registration itself works with real images (confirmed by serializer requiring `avatar`).

**Fix:** Generate a valid 1×1 JPEG via Pillow in the test helper.

**File changed:** `backend/features/authentication/tests/test_auth_api.py`

---

### 2. Department validation test — error envelope mismatch (FIXED)

**Symptom:** `test_create_exam_requires_department` failed because it asserted `"department_id" in response.data`, but the API now returns the standardized envelope:

```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "status": 400,
    "details": { "department_id": ["Select a department to create an exam."] }
  }
}
```

**Root cause:** Test written before `core.exceptions.handlers.custom_exception_handler` wrapped validation errors.

**Fix:** Assert against `response.data["error"]["details"]` with fallback to flat `response.data` for backward compatibility.

**File changed:** `backend/features/exams/tests/test_departments_api.py`

---

## Live API smoke test results

Server: `http://127.0.0.1:8000` (Daphne ASGI), DB: seeded `db.sqlite3`

| Endpoint | Method | Result |
|----------|--------|--------|
| `/api/monitoring/health/` | GET | `status: ok`, `pipeline_mode: production` |
| `/api/auth/token/` | POST (admin) | JWT issued, `role: ADMIN` |
| `/api/exams/` | GET | 5 exams |
| `/api/departments/` | GET | 3 departments |
| `/api/reports/summary/` | GET | KPIs returned (`total_sessions: 1`) |
| `/api/auth/token/` | POST (examinee01) | JWT issued, `role: EXAMINEE` |
| `/api/exams/` | GET (examinee) | 4 published exams visible |
| `/api/sessions/start/` | POST (examinee, exam 1) | Session created, `status: setup` |

---

## UI regression (browser)

### Admin flow — PASS

1. `/login` → credentials `admin` / `adminpass` → redirects to `/examiner`
2. Examiner overview loads KPI cards and exam table (5 exams in seed data)
3. `/reports` loads analytics page with export buttons and session log
4. `/monitoring` loads live monitoring dashboard (requires auth; unauthenticated visit shows public shell)

### Examinee flow — PASS

1. `/login` → `examinee01` / `pass001` → `/examinee`
2. Four available exams listed with “Start exam” actions
3. “Proctoring Demo Exam” → pre-exam modal → `/examinee/exam/1/setup`
4. Setup wizard renders (Briefing → Camera → Identity → Launch steps)

**Not fully automated:** Camera permission, identity enrollment, and live CV frame streaming require real webcam access in a user-controlled browser session.

---

## Warnings and non-blocking issues

### Security / configuration

| Issue | Severity | Detail |
|-------|----------|--------|
| Short JWT signing key | Medium (dev) | `InsecureKeyLengthWarning`: HMAC key is 23 bytes; RFC 7518 recommends ≥32 for HS256. Default `DJANGO_SECRET_KEY` in dev is too short. |
| npm audit | Medium | 8 vulnerabilities (1 low, 2 moderate, 5 high). Several tied to `xlsx` (SheetJS) with **no fix available** via npm. |

### Documentation drift

| Issue | Location | Detail |
|-------|----------|--------|
| Seed account mismatch | Root `README.md` | README lists `user02` / `pass002`; `generate_seed_csv.py` and `seed_db` output use `examinee01` / `pass001`. |
| Test count outdated | Root `README.md` | Says “32 tests”; actual count is **50** (features + ai). |

### Frontend / build

| Issue | Severity | Detail |
|-------|----------|--------|
| Large JS bundle | Low | `index-*.js` ≈ 1.9 MB (555 KB gzip). Vite warns chunks > 500 KB. |
| Campus photo placeholder | Low | Login/setup backgrounds show “Campus Photo Placeholder” text when `school-campus.jpg` is missing or not loaded. |
| Vite CLI from PowerShell | Low | `npm run dev -- --host 127.0.0.1 --port 5173` can be misparsed by npm in PowerShell (args passed to `vite` as positional). Use `frontend/run-dev.cmd` or `npx vite --host 127.0.0.1 --port 5173`. |

### Test hygiene

| Issue | Detail |
|-------|--------|
| Error response assertions | Several tests still assert flat `response.data` keys. Only department test was updated; consider a shared `validation_details(response)` helper for future-proofing. |
| Avatar fixtures | Other upload tests (e.g. question attachments) use minimal PNG headers; may break if Pillow validation tightens. |

---

## Suggested improvements

### High priority

1. **Align README seed accounts** with `generate_seed_csv.py` / `seed_db` output (`examinee01` / `pass001`, list all demo admins/examiners).
2. **Lengthen dev JWT secret** to ≥32 bytes in `.env.example` and local `.env` to silence warnings and match production guidance.
3. **Add a shared test helper** for API error envelopes, e.g. `assert_validation_error(response, "department_id")`, and migrate remaining tests.

### Medium priority

4. **Replace or isolate `xlsx`** — evaluate `exceljs` or server-side export only; SheetJS advisories have no npm fix.
5. **Code-split frontend routes** — dynamic `import()` for examiner, reports, monitoring, exam-setup to reduce initial bundle.
6. **Add E2E smoke script** — Playwright/Cypress covering login → examiner dashboard → reports export headers (no webcam).
7. **Update README test section** — document 50 tests and list new suites (`departments`, WebSocket observer, identity flow).

### Low priority / polish

8. **Ship real campus branding asset** at `frontend/public/branding/school-campus.jpg` (placeholder text is visible on login).
9. **Normalize `npm run dev` script** in `package.json`:

   ```json
   "dev": "vite --host 127.0.0.1 --port 5173"
   ```

   Avoids npm flag forwarding issues across shells.

10. **CI gate** — run `manage.py test features ai core` + `npm run build` + `npm run test` on every PR.

---

## Files modified during this run

| File | Change |
|------|--------|
| `backend/features/authentication/tests/test_auth_api.py` | Valid Pillow JPEG in `_sample_avatar()` |
| `backend/features/exams/tests/test_departments_api.py` | Assert validation errors via error envelope |

---

## Reproduction commands

```powershell
# Backend tests
cd backend
$env:DB_ENGINE = "django.db.backends.sqlite3"
$env:OPENBLAS_NUM_THREADS = "1"
.\venv\Scripts\python.exe manage.py test features ai core

# Frontend
cd ..\frontend
npm run build
npm run test

# Dev servers (preferred)
cd ..
.\start-dev.cmd
# or individually:
# backend\run-api.cmd
# frontend\run-dev.cmd
```

---

## Conclusion

Knowing Eye is **merge-ready for continued feature work** from a regression standpoint. The only failures in automated testing were stale test fixtures/assertions, now corrected. Runtime behavior matches expectations for auth, exam management, reporting, and examinee onboarding UI.

Primary follow-ups: documentation accuracy, JWT secret length in dev, frontend bundle size, and dependency hygiene around `xlsx`.
