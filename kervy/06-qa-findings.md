# QA Findings — Knowing Eye

*Compiled by Kervy Cadiente, System Architect, acting as QA reviewer.
Every finding below was verified first-hand against the code at commit
`e3a64bf` (branch `kervy`) during this pass — none are copied from another
document without independent confirmation. Where I ran a command to confirm
something, the command and its output are noted.*

**Fair framing, up front:** the application code is genuinely well written.
Zero `any` types across 236 TypeScript files. One TODO-shaped comment in 195
Python files — and it's a docstring, not a defect marker. Zero `print()`
debugging. Zero commented-out code. A correctly-implemented three-tier
RBAC/PBAC engine with a full audit trail (`PermissionChange`). Clean, consistent
data migrations, including two data migrations that correctly guard against
replay on a fresh database. A legitimately sophisticated
WebSocket-with-REST-fallback proctoring pipeline. This is not a codebase in
trouble.

The problems below concentrate in **three seams**: DRF viewsets that expose
more HTTP verbs than intended, silent fallbacks in the CV/identity stack, and
the verification layer (tests, CI, documentation accuracy) around the code.
That distinction is what makes this a QA contribution, not a critique of a
groupmate's work.

Severity legend: **Critical** = exploitable now, defeats a core guarantee ·
**High** = real defect or major gap, not yet exploited/measured ·
**Med** = should fix before defense · **Low** = polish.

---

## Group A — Integrity defects in the running system (fix first)

These defeat the product's core premise: that exam sessions and their
proctoring evidence are trustworthy. All were verified by reading the exact
view, serializer, and model code — not inferred from behavior.

| ID | Sev | Finding | Evidence |
|----|-----|---------|----------|
| A-1 | **Critical** | **An examinee can delete their own proctoring evidence.** `ExamSessionViewSet` is a bare `viewsets.ModelViewSet` with `permission_classes = [IsAuthenticated]` and no `http_method_names` restriction. `get_queryset()` returns the student's own sessions when they lack the `sessions` module. So `DELETE /api/sessions/{id}/` succeeds for the session owner. Every child record cascades: `Response`, `SessionLog`, `BehaviorLog`, `Alert`, and `SessionIdentityReference` are all `on_delete=CASCADE` from `ExamSession`. A student under investigation can delete the entire evidence trail with one authenticated DELETE. | `backend/features/session/views.py:34,43,47-51`; cascades at `backend/features/session/models.py:256,403`, `backend/features/behavior/models.py:21,53`, `backend/features/monitoring/models.py:18` |
| A-2 | **Critical** | **An examinee can mutate their own session status via PATCH.** Same viewset. `ExamSessionListSerializer` (used by default on update) lists `status` in `fields` but its `read_only_fields = ['id', 'started_at']` omits it. `PATCH /api/sessions/{id}/ {"status":"completed"}` is accepted from the owner, bypassing `sessions.terminate` and every guard in `features/session/services.py`. | `backend/features/session/serializers.py:148` |
| A-3 | **Critical** | **An examinee can resolve (clear) their own behavior alerts.** `AlertViewSet.http_method_names = ["get","patch","post","head","options"]` and `permission_classes = [IsAuthenticated]`. `AlertSerializer` includes `"resolved"` in `fields` but its `read_only_fields` list omits it. `PATCH /api/behavior/alerts/{id}/ {"resolved":true}` succeeds for the alert's own session owner — the dedicated `/resolve/` action correctly checks `behavior.resolve`, but the plain PATCH endpoint doesn't. | `backend/features/behavior/views.py:27-34,44`; `backend/features/behavior/serializers.py:44-54` |
| A-4 | High | **The CV pipeline fails open on error, not closed.** `_yaw_pitch_from_transform` returns `(0.0, 0.0)` — i.e. "perfectly forward-facing" — inside a bare `except Exception`, which *suppresses* a `looking_away` flag instead of raising one. Separately, when MediaPipe fails to initialize, both face and pose detectors silently degrade to Haar-cascade heuristics with no log line — there is no runtime signal that "production" mode is actually running OpenCV, not MediaPipe. | `backend/ai/knowing_eye/detection/face_detector.py:153,82`; `pose_detector.py:48` (verified by reading source) |
| A-5 | High | **Identity verification silently degrades to something that isn't face recognition.** `requirements-identity.txt` (InsightFace/ArcFace) is referenced by neither `requirements.txt` nor `setup-venv.cmd`, so it is never installed by the documented setup path. `IdentityVerifier` then falls through its resolution chain to `appearance` — a **normalized 16×16 grayscale crop compared by cosine distance** (`_appearance_signature`), threshold `0.15`. Confirmed live: with only `requirements-core.txt` + `requirements-cv.txt` installed (the documented path), no ArcFace/InsightFace/dlib is present. The system's headline anti-impersonation feature, unless someone manually installs the optional requirements file, is a 256-value grayscale comparison. | `backend/ai/knowing_eye/recognition/identity.py:20-30,165-177`; confirmed by fresh `pip install -r requirements-core.txt -r requirements-cv.txt` in this pass, no `insightface`/`onnxruntime` present |
| A-6 | Med | **8 of 18 registered permissions are never enforced anywhere in the codebase**, including `reports.export`. Confirmed: `export_sessions_csv` and `export_sessions_pdf` are decorated only `@permission_classes([IsAuthenticated])` — no `security.can(request.user, "reports.export")` call exists in either function. Queryset scoping (`_session_queryset`) prevents cross-user data leakage, but `GET /api/auth/access-map/` advertises a capability the backend never actually gates. | `backend/features/reports/views.py:324-326,381-384`; `backend/core/security/permissions_registry.py:28,60,68,75` (permission declared, `grep` for its enforcement returns only the declaration and two test assertions of the *export endpoints*, never a `security.can` check) |
| A-7 | Med | `GET /api/exams/{pk}/sections/` and `GET /api/exams/{pk}/pools/` perform no permission check beyond `IsAuthenticated`, while their POST counterparts correctly assert `assert_can_modify_exam`. Exam structure is readable by any authenticated user who can guess or enumerate an exam ID. | `backend/features/exams/views.py:312-358` |
| A-8 | Med | **Login and registration have no dedicated throttle** — only the global `anon: 60/min` DRF default applies. No brute-force protection specific to `POST /api/auth/token/`. | `backend/core/config/settings/base.py:163-186` |

---

## Group B — Claim vs. reality (defense risk)

| ID | Sev | Finding | Evidence |
|----|-----|---------|----------|
| B-1 | **Critical** | **The docs claim YOLOv8 is implemented. It is not.** Confirmed: `grep -rn "yolo" backend --include='*.py' --include='*.txt'` (excluding venv) returns zero matches. `requirements-cv.txt` is `numpy`, `opencv-python-headless`, `Pillow`, `PyYAML`, `mediapipe` — no `ultralytics`. The team already caught this once and corrected four manuscript pages (`docs/todo` §4.5 records it) — but the claim survives, and in two cases is marked **complete**: | `README.md:13`; `REPOSITORY_GUIDE.md:13,99`; `docs/deployment.md:20,228,229`; `docs/general/workflow.tree:31,128,129,236,237` ("Integrate YOLO for face and posture detection **[DONE]**"); `docs/general/Study_Objectives.todo:61` ("YOLO for face and posture detection ... **100%**"); `docs/documentation/chapter1/01-background.html` |
| B-2 | High | **Two-role model still documented in five places** after README/REPOSITORY_GUIDE were fixed — including the formal FR list and the FR-01 traceability row inside the testing chapter itself. | `docs/documentation/chapter2/02-system-analysis.html:82`; `chapter2/04-system-testing.html` (FR-01 row); `docs/database/database_schema.json`; `docs/frontend/frontend_features.json`; `docs/general/Project.json` |
| B-3 | High | **`docs/todo` contradicts itself.** §4.1–4.5, 4.8, 4.9 are ticked `[x]` with written justifications (CV parameter definitions, threshold justification, anomaly accumulation, dataset methodology, algorithm comparison, snapshot documentation, proctor locator, fixed camera widget, browser deterrents). §6 — the *same items*, flattened into one priority backlog, as the file's own header says it should be — still shows all of them unchecked. Reading §1–5 says 5 P0s remain open; reading §6 says 11 do. | `docs/todo`, compare §4/§4.6/§4.7 against §6 |
| B-4 | Med | **Test counts drift across five different numbers**: 37 (`chapter2/02-system-analysis.html:104`, and hardcoded in `docs/os/modules/testing/module.js:5`), 50 (`misc/system-run-report-2026-07-02.md`), "140+" (README, REPOSITORY_GUIDE, Implementation_Status_Summary), 142 (consistency report), and the actual **167** `def test_` counted in this pass across 19 files. | direct count: `find backend -name 'test*.py' -not -path '*/venv/*' -exec grep -h 'def test_' {} + \| wc -l` → 167 |
| B-5 | Med | **The consistency report itself understates the system.** It states right-click/copy/selection blocking are "**not** implemented" — confirmed false: `FocusShell` guards `onContextMenu`/`onCopy`/`onCut` with a deliberate carve-out for editable fields. It also marks the proctor locator "Not found" — confirmed false: `seat_label` is modelled on `ExamAssignment`, rendered in `live-session-card.tsx`, and unit-tested. | claims at `docs/general/System_Consistency_Report_2026-09.md:111,113` vs. `frontend/src/features/session/components/taking/focus-shell.tsx:17-52`; `frontend/src/shared/types/api.ts:347-348`; `frontend/src/features/monitoring/components/live-session-card.tsx:77-78`; `backend/features/exams/tests/test_seat_label.py` |
| B-6 | Med | **Scope's source of truth is not in the repository.** The "Capstone Defense Revision Directive" — the document `docs/architecture/capstone-defense-revision-plan.md` calls authoritative ("when this plan and the Directive disagree, the Directive wins") — lives at an external URL. `docs/todo` is its only in-repo rendering, and it self-contradicts (B-3). A reviewer cannot audit scope from the repository alone. | `docs/architecture/capstone-defense-revision-plan.md` |

**B-1 and B-5 together are this section's thesis:** the documentation drifts in
*both* directions — overclaiming an algorithm the system never had (YOLO), and
underclaiming features that were actually shipped (deterrents, seat labels).
Neither error is safe to leave standing. **Nothing goes into
`04-traceability-matrix.csv` as "done" without independent verification against
the code** — that is the whole point of this exercise.

---

## Group C — The verification gap

| ID | Sev | Finding | Evidence |
|----|-----|---------|----------|
| C-1 | **Critical** | **Nothing type-checks the frontend, and there are real type errors waiting.** `typescript` is not a dependency of the frontend — absent from `package.json` and every entry in `package-lock.json`. `"build": "vite build"` has no `tsc -b` step; there is no `typecheck` script. So `"strict": true` in `tsconfig.app.json` has never actually run. **Confirmed live in this pass**: installing TypeScript 5.8.3 (a version compatible with the project's `erasableSyntaxOnly` option) and running `tsc -b --noEmit` surfaces **12 real errors across 8 files** — see `05-defect-log.csv` DEF-001 for the full list. Compounded by `@types/react` **19.2.14** floating transitively against a `react` **18.3.1** runtime. | `frontend/package.json:7`, `package-lock.json`; live run, this pass |
| C-2 | High | **The AI test suite has never run.** `ai/tests/test_pipeline.py` is the project's only pytest-style file (`import pytest`, `@pytest.fixture`, bare `def test_*`), but the project's test runner is Django's `manage.py test`, and `pytest` is in no requirements file. **Confirmed live**: `python manage.py test ai` → `ModuleNotFoundError: No module named 'pytest'`, 1 error, 0 tests actually run. `test-all.cmd` fails on the `ai` label for the same reason — these 4 tests have never executed in this project's own CI-equivalent script. | `backend/ai/tests/test_pipeline.py:6,12`; `test-all.cmd`; live run this pass, exit code non-zero |
| C-3 | High | **ESLint is configured but not installed.** `eslint.config.js` imports 5 packages (`@eslint/js`, `globals`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `typescript-eslint`) absent from the lockfile. The `lint` script runs Biome instead. All 7 `// eslint-disable-next-line react-hooks/exhaustive-deps` comments in the codebase are therefore inert — each marks a real dependency-array escape hatch that no installed tool checks. Biome, which does run, only *warns* on unused imports/variables (`biome check .` exits 0 regardless) and explicitly skips 48 files (`shared/components/ui/`) via `files.ignore`. | `frontend/eslint.config.js`; `frontend/biome.json:13,24` |
| C-4 | High | **Frontend test coverage is 1.8%.** 33 tests in 6 files / 391 lines against 21,771 lines of TS/TSX. Confirmed by live run: `npm test -- --run` → **32 passed, 1 failed** (see DEF-002), 33 total. Untested: every route, `ProtectedRoute`, `AuthProvider`, the 727-line `api-client.ts` (including its 401-refresh-and-retry path), `useMonitoring`, the entire exam-taking flow, and all 22 page components. No coverage tool is installed; `@testing-library/user-event` is absent, so interaction tests aren't even possible as currently configured. | live run this pass; `frontend/vite.config.ts:25-29` |
| C-5 | High | **No CI of any kind.** `.github/` was deleted in commit `8be635a` ("remove Actions workflow", switching GitHub Pages to branch-deploy) and never replaced with a test/lint workflow. `test-all.cmd` is manual and Windows-only. Nothing prevents a red commit from landing — which is a plausible reason findings A-1 through A-3 were never caught. | absence of `.github/` in the repository |
| C-6 | High | **Both formal test packs (`docs/testing/testing(IEEE)/` and `testing(UTAUT)/`) are empty scaffolds.** Each is one README plus one bootstrap script. The READMEs document four data folders (`requirements-data/`, `document-data/`, `results-data/`, `documents/`) and five scripts (`sync_results_to_document_data.py`, `document-data/generate_documents.py`, `compute_utaut_statistics.py`, `sync_results_to_chapter_data.py`, `generate_documents.py`) that **do not exist in this repo**. The one script present (`bootstrap_knowing_eye_content.py`) emits 19 placeholder test cases titled literally `"Verify authentication & rbac - KE-AUTH-001"` with generic, non-actionable steps, and still frames the system as `ADMIN`/`EXAMINEE`. IEEE Doc1–Doc9 (Test Plan, Test Cases, System Test Report, UAT Plan/Report, Defect Log, Regression Report, Summary Report) are all unwritten. Fully populated equivalents exist in this same repo — but only for the team's prior, unrelated capstone (OSAS) under `misc/archive/`. | `docs/testing/testing(IEEE)/README.md`, `testing(UTAUT)/README.md`; `docs/testing/testing(IEEE)/scripts/bootstrap_knowing_eye_content.py:39-55,76-77` |
| C-7 | High | **Load/capacity testing has never been executed.** The Capstone panel asked directly whether the system handles ~30 examinees per room and ~100 total; `docs/todo:219-222` records the exact procedure requested (5→10→20→30→50→100) and it remains unchecked. `RISK-005` in the project risk register tracks this as open. Git history shows Sprints 1–4 landed as commits; Sprints 5 (capacity/hardware) and 6 (docs/testing/deployment) have none. | `docs/todo:219-222`; `docs/os/data/seed/risks.json` (RISK-005); git log (no Sprint 5/6 commit) |
| C-8 | Med | **Test gaps map exactly onto Group A.** No test exercises `ExamSessionViewSet.update`/`.destroy`, no test PATCHes or POSTs `AlertViewSet` directly (only the `/resolve/` action is tested), and no test asserts `ai/adapter.py`'s stub-vs-production mode selection. The exact code paths that produced A-1, A-2, A-3 have zero test coverage. | backend test-file inventory; confirmed by grep for `client.delete\|client.patch` against `sessions/` and `behavior/alerts/` paths in `features/session/tests/` and `features/behavior/tests/` — no hits |
| C-9 | Med | **No `CONTRIBUTING.md`, branch policy, or commit-message convention.** The only branch in this repository is `kervy`, while every deployment doc (`docs/README.md`, GitHub Pages setup) instructs serving from `main`, which does not exist. Five commits in the project's history are titled only "major changes". | repo root; `docs/README.md` |

---

## Group D — Privacy, secrets & repository hygiene

| ID | Sev | Finding | Evidence |
|----|-----|---------|----------|
| D-1 | **Critical** | **`backend/db.sqlite3` is committed and contains real personal and biometric data.** It holds 44 real user rows (real Gmail addresses matching the team's own emails, plus password hashes), ~30 exam sessions, ~1,026 behavior logs, ~1,025 alerts, and **24 stored face-identity embeddings**. For a study whose own Chapter II describes participant consent and briefing procedures, committing subjects' biometric data to a public-reachable git history is a research-ethics problem, not only a hygiene one. The data is also stale — applied migrations in this file stop at `authentication.0003`, and 39 of its users still carry the legacy `role='EXAMINEE'` string. | `git ls-files \| grep db.sqlite3`; `backend/.gitignore:3` (rule exists, file predates it) |
| D-2 | **Critical** | **`backend/.env` secrets remain in git history.** Confirmed: `git log --all -- backend/.env` returns 5 commits (2026-04-22 → 2026-09-06). The most recent commit's own message ("Move admin credentials to env... Untrack backend/.env") treats untracking as closing the exposure — it does not; the file's prior contents (`DJANGO_SECRET_KEY`, DB password, `SEED_ADMIN_PASSWORD`) remain retrievable by anyone with read access to the repository's history. **The only real remedy is rotating those secrets.** History rewriting (`git filter-repo`/BFG) is a secondary, disruptive step that is the whole team's call, not something to do unilaterally. | `git log --all -- backend/.env` → 5 commits (confirmed this pass, contents not inspected) |
| D-3 | High | **24 plaintext passwords are committed**, and four of them are full administrators. `examiner1`–`examiner4` are seeded with role **`ADMIN`** in `backend/seed_data/users.csv`, each with a password equal to their username — despite names implying a proctor/faculty role, not admin. | `backend/seed_data/users.csv` |
| D-4 | High | **`backend/venv/` is committed** — 8,460 of 9,389 tracked files (90%), ~150 MB of Windows-only binaries (`cv2.pyd` alone is 85 MB), 49 tracked `.exe`/`.pyd`/`.dll` files. `.git` is 143 MB as a result. It also does not work: it is missing `daphne`, `rest_framework_simplejwt`, `decouple`, `mediapipe`, `PyYAML` — Django cannot even boot from it, which independently explains why the pipeline runs in stub mode for anyone who tries to use the committed venv as-is. `.gitignore` correctly lists `venv/`, but gitignore has no effect on files already tracked. | `git ls-files backend/venv \| wc -l` → 8460 (confirmed this pass) |
| D-5 | Med | **Face embeddings are stored unencrypted** as plain JSON with no retention policy and no deletion endpoint. | `backend/features/monitoring/models.py:18-26` |
| D-6 | Med | **`seed_db.ensure_admin()` re-applies `SEED_ADMIN_PASSWORD` on every run**, silently reverting any password an operator rotated by hand between seed runs. | `backend/core/management/commands/seed_db.py:102-103` |
| D-7 | Med | **MediaPipe model files download over plain HTTP-library `urlretrieve` with no checksum, no timeout, and no TLS pinning.** | `backend/ai/knowing_eye/detection/mp_models.py:29` |
| D-8 | Med | **Access JWTs travel in WebSocket query strings** (`?token=...`), which land in proxy/server access logs and browser history by default. Tokens are also kept in plain `localStorage` (readable by any XSS) rather than an `httpOnly` cookie. Logout is entirely client-side — no backend blacklist call — so a "logged out" refresh token stays valid server-side until its 7-day expiry. | `backend/features/monitoring/middleware.py:29-40`; `frontend/src/shared/lib/websocket.ts:8-21`, `token-store.ts:1-2`; `frontend/src/core/providers/auth-provider.tsx:135-139` |
| D-9 | Low | `backend/logs/knowing_eye.log` (536 KB, gitignored but committed anyway) ships in the repo; `start-dev.cmd`/`run-api.cmd` hardcode a developer's private LAN IP; `xlsx@0.18.5` (used for question import) carries known prototype-pollution/ReDoS advisories with no fixed release; `CORS_ALLOW_ALL_ORIGINS` defaults `True` in dev alongside `CORS_ALLOW_CREDENTIALS=True`; `CSRF_TRUSTED_ORIGINS` is never set in any settings file. | as cited |

---

## Group E — Product & accessibility gaps (compressed)

| ID | Sev | Finding |
|----|-----|---------|
| E-1 | High | **The exam-approval chain has no UI to find pending exams.** `approveExam`/`rejectExam` are wired into the exam builder and `GET /exams/pending-review/` exists in the API client, but nothing in the frontend calls it — no route, no page, no badge. A PROGRAM_HEAD has no way to discover what needs their approval; they must already know an exam's direct URL. Area 1's P0 item ("teachers create, program heads approve") is marked ✅ in the consistency report but is only half-reachable from the UI. |
| E-2 | Med | **The entire `behavior` frontend feature is unrendered.** `frontend/src/features/behavior/hooks/use-behavior.ts` is fully implemented (loads logs and alerts, resolves them) with **zero importers** — no component, no route consumes it. |
| E-3 | Med | **No fullscreen enforcement exists**, yet the backend declares `"fullscreen_exit"` as a valid `SessionLog.event_type` — a backend event type with no frontend emitter (`requestFullscreen` appears nowhere in `frontend/src`). |
| E-4 | Med | **6 hand-rolled modals bypass Radix `Dialog`** (no `role="dialog"`, no focus trap, no focus restore, no Escape-to-close), two of which dismiss on a backdrop `onClick` with no keyboard equivalent. Separately, **24 of 26 `<label>` elements outside `components/ui/` have no `htmlFor`**, so screen readers get no accessible name for those form fields. |
| E-5 | Low | **~2,900 lines of dead frontend code** (22 unused shadcn primitives, 2 orphaned pages, 11 unused barrel files, a duplicate `cn()` utility, two unrelated components both named `focus-shell`). Backend: `Question.save()` triggers an extra `UPDATE` on the parent exam every time, doubling writes during bulk CSV import; `ai/identity_store._CACHE` is an unbounded, process-global dict. |
| E-6 | Low | **The documentation site ships partially broken.** `docs/README.md` advertises 12 plugin modules; `docs/os/config/project.json` enables only 7 — Tasks, Risks, Architecture, Reports, and **Testing** are dead links on the live site. Running `python3 scripts/check_docs_assets.py` from the repo root reports 3 broken figure references (all three Chapter II Part A figures) and 5 missing team photos. Three overlapping documentation trees coexist (`docs/`, `docs-old/`, `misc/duplicate-docs/`) with nothing inside `docs-old/` marking it deprecated. |
| E-7 | Low | **Gantt chart data quality.** `misc/Knowing Eye Gantt Chart - Sheet1.csv` still lists the company name as "WBSMS Team" (the team's prior, unrelated capstone); the Project Manager's and System Architect's email addresses are swapped between their rows; "CURRENT DATE" (6/25/2026) is chronologically after "END DATE" (06/10/2026); the sheet has no Phase 3+ rows despite the header advertising P3/P4 progress percentages. |

---

## How to use this document

1. Read Group A first and decide with your groupmate whether to fix A-1/A-2/A-3
   before anything else — they're small, targeted changes (restrict
   `http_method_names`, widen two `read_only_fields` lists), but they affect
   shared behavior and need accompanying tests.
2. Use Group B to correct the manuscript before the next defense — B-1 in
   particular is a claim a panel can falsify by reading the requirements file.
3. Use Group C to decide what QA infrastructure to build next (this folder is
   part of that answer; CI and a real `typecheck` script are the highest-value
   remaining pieces).
4. Group D items D-1/D-2/D-4 need a team decision, not a unilateral fix —
   they affect what everyone has already cloned. Proposed remedies:
   - D-1: `git rm --cached backend/db.sqlite3`, add a real `.env`-driven seed
     flow for local dev (already exists — `seed_db`), rotate any credentials
     the exposed rows implied.
   - D-2: rotate `DJANGO_SECRET_KEY`, the database password, and
     `SEED_ADMIN_PASSWORD` immediately, regardless of whether history is
     rewritten.
   - D-4: `git rm -r --cached backend/venv`, confirm `.gitignore` catches it
     going forward, let every contributor rebuild their own venv.
5. Group E is ordinary backlog — feed it into whatever sprint tracking the
   team already uses (`docs/todo` §6 or the Project OS Kanban).
