# Knowing Eye — System & Documentation Consistency Report

*Generated: 2026-09-04. Scope: (1) move the bootstrap admin credentials into an
environment file, (2) reconcile the documentation and the "project OS" dashboard
with the current state of the system, (3) cross-check the codebase against the
**Capstone Defense Revision Directive** to confirm how much is actually
implemented, and (4) surface remaining problems in the docs or the system.*

Companion to [Implementation_Status_Summary.md](./Implementation_Status_Summary.md)
(canonical status) and the panel-defense directive artifact (5 areas · 42 items).

---

## 1. Changes made in this pass

### 1.1 Admin credentials moved to the environment

The bootstrap administrator used to be a plaintext row in the committed
`backend/seed_data/users.csv` (`admin` / `adminpass`). It is now provisioned by
`manage.py seed_db` from environment variables, so the password no longer lives
in version control.

| File | Change |
|------|--------|
| `backend/core/config/settings/base.py` | New `SEED_ADMIN` dict read via `decouple` (`SEED_ADMIN_USERNAME/EMAIL/PASSWORD/FIRST_NAME/LAST_NAME`), with dev-only defaults. |
| `backend/core/management/commands/seed_db.py` | New `ensure_admin()` step (runs first, pins the admin to `id=1` because exam/session seeds reference `created_by_id=1`); `load_users()` now skips blank/`#` comment rows. |
| `backend/seed_data/users.csv` | Admin row removed; replaced with a comment pointing to the env vars. |
| `backend/.env` | Real `SEED_ADMIN_*` values (gitignored — stays out of git). |
| `backend/.env.example` | Placeholder `SEED_ADMIN_*` block (`change-me` password) for fresh clones. |

**Verified:** re-ran `seed_db --noinput` → admin re-provisioned at `id=1`, role
`ADMIN`; `POST /api/auth/token/` for `admin`/`adminpass` → `200`. Full backend
suite (**142 tests**) still green.

### 1.2 Documentation reconciled with the system

| File | Was | Now |
|------|-----|-----|
| `README.md` | Seed `user02`/`pass002`; "32 tests" | `examinee02`/`pass002` + env-admin note; "140+ tests" with feature breakdown |
| `REPOSITORY_GUIDE.md` | Roles `ADMIN`/`EXAMINEE`; "Registration always creates EXAMINEE"; `user02`; "32 tests" | Six roles + PBAC; "creates `STUDENT`"; env-admin note; "140+ tests" |
| `docs/general/Implementation_Status_Summary.md` | "Last updated 2026-07-05"; "23 tests"; `user02` | 2026-09-04; "140+ tests"; `examinee02` + env-admin note |
| `docs/os/data/seed/project.json` | `version_label` "June 2026" | "September 2026 · post defense-directive sprints (1-4) + consistency pass" |

### 1.3 Bugs fixed earlier this session (PR #2)

- Settings page rendered in the public layout (missing `/settings` in
  `EXAMINER_PREFIXES`).
- 20 seeded examinees carried the legacy `EXAMINEE` role string and were
  misrouted into the Examiner workspace.

---

## 2. Directive cross-reference — how much is implemented

Legend: **✅ Implemented** (code present + verified) · **◐ Partial** ·
**📄 Documentation deliverable** (code may exist; the manuscript artifact is the
gap) · **❌ Not found / not done**.

### Area 1 — Authentication, Roles & Access Control
| Item (priority) | Status | Evidence |
|-----------------|:------:|----------|
| RBAC, replace single-admin (P0) | ✅ | `authentication/models.py` `Role` (6 roles) |
| No casual admin sharing → PBAC + audit (P0) | ✅ | `core/security/` (`permissions_registry`, `service`), `PermissionChange` model |
| Roles defined (Admin/Guidance/Program Head/Faculty/Proctor/Examinee) (P0) | ✅ | `Role.choices` |
| Per-role permissions (P0) | ✅ | `core/security/modules.py`, `permissions_registry.py` |
| Admin scope split — teachers create, program heads approve (P0) | ✅ | `FACULTY` role, `User.can_approve_exams()` |
| Registration simplified, photo optional (P0) | ✅ | Register page (photo optional — verified in smoke test) |
| OTP verification (P0) | ✅ | `authentication/otp_service.py`, `EmailVerification`, migration `0008`, `test_otp_verification.py` |
| Email verification + password confirm (P0) | ✅ | auth serializers/views |

### Area 2 — UI / UX Redesign
| Item | Status | Evidence |
|------|:------:|----------|
| Contrast / readability (P0) | ✅ | Sprint 2 "institutional identity & readability"; design system v2 |
| Pull back dark theme (P1) | ✅ | Light default theme (verified in smoke test) |
| Legacy College identity / branding (P0) | ✅ | `frontend/public/branding/*`, campus background |
| De-genericize templated components (P0) | ✅ | Sprint 2 refactor |
| Dashboard org, sort/search/filter (P2) | ✅ | Exam list search + filter + sort (verified) |

### Area 3 — Exam Management & LMS
| Item | Status | Evidence |
|------|:------:|----------|
| Exam categories (P0) | ✅ | `Category` model, migrations `0012`/`0013` (Psychological, Mental/Abstract, Behavioral seeded) |
| Search / filter / sort (P0) | ✅ | exams views + dashboard |
| Scheduling window open/close (P0) | ✅ | `available_from` / `available_until` + index |
| Auto exam-code (dept+year), locked, title separate (P0) | ✅ | `exams/services.py`, verified `IIT-2026-F` in smoke test |
| Multi-department assignment (P1) | ✅ | `departments` M2M on `Exam` |
| Section-level assignment / per-group schedules (P1) | ◐ | `ExamAssignment` roster exists; explicit per-section scheduling not confirmed |
| Exam cloning / duplication (P1) | ✅ | "duplicate exam" (Impl. Status) |
| Question reorder (dnd) / edit / delete (P1) | ✅ | dnd-kit builder |
| Lock question editing once in progress (P1) | ✅ | Impl. Status "Integrity UX" |
| Image questions + image answer options (P1) | ✅ | `QuestionAttachment` (migration `0005`); verified in Add-question dialog |
| Bulk XLSX/CSV import + template (P1) | ✅ | "Download worksheet/.xlsx / CSV template / Upload" (verified in smoke test) |
| **LMS benchmarking table (Google Forms/Jotform)** (P0) | 📄 | **Manuscript deliverable — no comparison table found** |
| Guidance-specific content scope (P1) | ✅ | seeded Guidance categories |
| Essay held for manual grading (P1) | ✅ | `session/services.py` release-after-grading |
| Email notification on results release (P1) | ✅ | `session/services.py` `send_mail` |
| Per-exam results / warnings / export (P1) | ✅ | reports CSV **and** PDF export (verified `200`) |

### Area 4 — Computer Vision & Monitoring
| Item | Status | Evidence |
|------|:------:|----------|
| Anomaly accumulation model (Normal→Warning→Suspicious→Critical) (P0) | ✅ | `features/behavior/escalation.py`, `ai/knowing_eye/behavior/{temporal,scoring}.py` |
| Snapshot monitoring over WebSocket (P1) | ✅ | monitoring consumer; `KE_STORE_FRAMES=False` default |
| Define every CV parameter (measure/why/range/algo/threshold/action) (P0) | ◐ 📄 | Pipeline + `ai/config/pipeline.yaml` exist; the **documented parameter table** is the deliverable |
| Threshold justification from cited research (P0) | 📄 | Thresholds configurable; **research citations are the gap** (ties to Area 5) |
| Dataset methodology (source, size, split 70/30) (P0) | ❌ 📄 | No dataset methodology doc found |
| Algorithm comparison (YOLOv8/MediaPipe vs alternatives) (P0) | ❌ 📄 | No comparison table found |
| Camera / hardware requirements spec (P0) | ❌ 📄 | Not found as a spec section |
| Capacity / load testing 5→100 users (P0) | ❌ | Not executed — still backlog (`tasks.json` TASK-012); no results |
| Proctor locator for flagged student (P1) | ❌ | Not found in monitoring UI |
| Fixed camera-preview widget (no scroll drift) (P1) | ◐ | Not confirmed; verify on the exam-taking screen |
| Browser deterrents — right-click/copy/fullscreen (P2) | ◐ | Only tab-switch detection (`visibilitychange`) in `use-exam-taking.ts`; right-click/copy-block/fullscreen **not** implemented |

### Area 5 — Documentation & Research
| Item | Status | Evidence |
|------|:------:|----------|
| RRL on face/gaze/posture/anomaly detection (P0) | ◐ 📄 | `docs/documentation/chapter1/04-rrl.html`; depth still in progress (`tasks.json`) |
| Cite every technical claim (P0) | 📄 | In progress |
| Continuous testing methodology (P0) | 📄 | `chapter2/04-system-testing.html` exists — verify it frames testing as before/during/after deployment |
| Agile WBS (P1) | ◐ | `docs/os/data/seed/wbs.json` exists (outline-timeline framing) |
| Floor-plan / seating / camera-placement diagram (P1) | ❌ 📄 | Not found |
| Use-case diagram updated for RBAC roles (P1) | ◐ | `chapter2/graphs/use-case.json` exists — verify it reflects all six roles |
| 6-week deployment plan (P1) | 📄 | `docs/deployment.md` exists |

**Bottom line:** the **software** side of the directive is largely done — RBAC/PBAC,
OTP, the UI overhaul, and the entire exam-LMS feature set (categories, scheduling,
multi-department, image items, bulk import, grading, results email) are all
implemented and test-backed. The remaining work is concentrated in **research
rigor and manuscript deliverables** (Area 4 + Area 5) plus a few genuine feature
gaps (load testing, proctor locator, fixed camera widget, fuller browser
deterrents).

---

## 3. Problems & issues found

### 3.1 Documentation (fixed in this pass)
- Seed credentials were wrong everywhere (`user02` — that account does not
  exist; the seed is `examinee02`). Fixed in README, REPOSITORY_GUIDE, Impl. Status.
- REPOSITORY_GUIDE described a two-role model (`ADMIN`/`EXAMINEE`); the system has
  six roles + PBAC. Fixed.
- "Registration always creates EXAMINEE" — now `STUDENT`. Fixed.
- Test counts were stale (23 / 32 vs. the actual **142** backend tests). Fixed.

### 3.2 Documentation (flagged — needs your decision, not changed)
- **Project OS planning data is stale.** `docs/os/data/seed/{tasks,milestones,
  risks,wbs,gantt}.json` still describe the **June–July 2026 outline-submission**
  timeline and pre-date the defense-directive sprints. These carry real
  owners/dates/statuses, so I did **not** rewrite them unilaterally — refreshing
  them (task statuses → done, new milestones for Sprints 1–4, current dates) is a
  team-planning call. I can do it on your say-so.
- **Manuscript P0 gaps** (Area 4/5): LMS benchmarking table, CV dataset
  methodology, algorithm comparison, camera/hardware spec, and threshold
  citations are the items most likely to resurface at the next defense.
- `docs/database/` and `docs/backend/` JSON schemas may lag the live models
  (already warned in REPOSITORY_GUIDE "Common pitfalls").

### 3.3 System (flagged)
- **Load/capacity testing (P0) not executed** — no 5→100-user results exist; the
  panel asked directly whether the system handles ~30/room and ~100 overall.
- **Browser deterrents incomplete (P2)** — only tab-switch detection is wired;
  right-click / copy / text-selection blocking and fullscreen are absent. Make
  sure the manuscript doesn't overclaim here.
- **Proctor locator (P1)** and **fixed camera-preview widget (P1)** — not found;
  verify against the running exam-taking + monitoring screens.
- `backend/.env` (this machine) defaults `DB_ENGINE` to PostgreSQL; a fresh clone
  relies on `.env.example` (SQLite). Not a repo bug, but worth knowing when
  onboarding.

---

## 4. Suggested next steps
1. Decide whether to refresh the Project OS planning datasets (offer stands).
2. Prioritise the Area 4/5 manuscript deliverables (benchmarking, dataset,
   algorithm comparison, hardware spec, thresholds-with-citations).
3. Run the load test and record results (5 → 10 → 20 → 30 → 50 → 100).
4. Close the small UI gaps: proctor locator, fixed camera widget, and (if the
   paper claims them) the remaining browser deterrents.
