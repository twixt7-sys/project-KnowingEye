# Manual Checklists — Knowing Eye

*Copy-pasteable tick-box checklists for what isn't automated yet. Run these
before any capstone demo or defense, and after any change to permissions,
sessions, or the monitoring pipeline.*

## 1. Release smoke checklist

- [ ] `GET /api/monitoring/health/` returns 200 and shows the expected
      `pipeline_mode` (`production` if `requirements-cv.txt` is installed, else
      `stub` — confirm which before trusting anything else on this list)
- [ ] Login as `admin`, `examinee02` — both succeed, both return the expected role
- [ ] Admin dashboard loads with no console errors
- [ ] Create a draft exam, add at least one of each question type (multiple
      choice, true/false, short answer, essay)
- [ ] Submit exam for review, approve as a PROGRAM_HEAD account, publish
- [ ] Log in as a STUDENT, start the exam, complete the setup wizard (rules →
      camera → identity enrollment → ready)
- [ ] Answer all questions, submit
- [ ] Confirm the session appears in reports with a computed score
- [ ] Export a session report as CSV and as PDF — both download and open
- [ ] Resolve an alert from the admin monitoring dashboard using the `/resolve/`
      action (not a generic PATCH — see §2)

## 2. RBAC / authorization matrix — the highest-value manual pass

**This is the pass that would have caught findings A-1, A-2, and A-3.** For
every row, use the *lowest-privileged* role that can reach the resource at
all, and try every verb the route supports — not just the one the frontend
sends.

| Endpoint | Verb | As session owner (STUDENT) | As unrelated STUDENT | As ADMIN |
|---|---|---|---|---|
| `/api/sessions/{id}/` | GET | ✅ allowed | ❌ should be denied | ✅ allowed |
| `/api/sessions/{id}/` | PATCH (generic, not a named action) | ❌ **should be denied — currently allowed, see finding A-2** | ❌ denied | ✅ allowed |
| `/api/sessions/{id}/` | DELETE | ❌ **should be denied — currently allowed, see finding A-1** | ❌ denied | needs a policy decision |
| `/api/behavior/alerts/{id}/` | PATCH `{"resolved": true}` | ❌ **should be denied — currently allowed, see finding A-3** | ❌ denied | ✅ allowed |
| `/api/behavior/alerts/{id}/resolve/` | POST | ❌ denied (correctly enforced today) | ❌ denied | ✅ allowed |
| `/api/reports/export/csv/`, `/export/pdf/` | GET | scoped to own data (no leak) but **no `reports.export` check today — finding A-6** | scoped to own data | ✅ allowed |
| `/api/exams/{id}/sections/`, `/pools/` | GET | ❌ **should require exam visibility — currently open, finding A-7** | ❌ should be denied, currently allowed | ✅ allowed |
| `/api/exams/{id}/sections/`, `/pools/` | POST | ❌ denied (correctly enforced today) | ❌ denied | ✅ allowed |
| `/api/auth/users/{id}/permissions/` | GET/PUT | ❌ denied | ❌ denied | ✅ allowed only |

Repeat this table for `GUIDANCE_STAFF`, `PROGRAM_HEAD`, `FACULTY`, and
`PROCTOR` against the endpoints relevant to each role's module grants
(`core/security/modules.py` lists all 12 modules — check each role's default
set in `ROLE_DEFAULT_ACTIONS`).

## 3. Exam lifecycle walk

- [ ] FACULTY creates a draft exam (verify: cannot be created by PROCTOR or STUDENT)
- [ ] FACULTY adds questions individually and via bulk CSV import
- [ ] FACULTY attempts to submit with zero questions → rejected
- [ ] FACULTY submits for review → status becomes `pending`
- [ ] A *different* FACULTY account cannot edit or delete this exam (ownership check)
- [ ] PROGRAM_HEAD can find the exam awaiting approval — **currently this has
      no discovery UI; you must navigate to the exam directly (finding E-1).
      File this as a known gap when this check fails to find a page.**
- [ ] PROGRAM_HEAD rejects with a note → status returns to editable, note is visible to FACULTY
- [ ] PROGRAM_HEAD approves → FACULTY can now publish
- [ ] Published exam respects `available_from`/`available_until` scheduling window
- [ ] STUDENT cannot start the exam before `available_from`
- [ ] STUDENT completes exam, essay questions are held for manual grading (session status `pending_review`)
- [ ] FACULTY grades the essay via Speed Grader
- [ ] Results-release email fires once grading completes and `results_release_at` has passed
- [ ] Attempting a second session beyond `max_attempts` is rejected

## 4. Monitoring / WebSocket walk

- [ ] Confirm pipeline mode via `/api/monitoring/health/` **before starting**
- [ ] Confirm identity backend: with only `requirements-core.txt` +
      `requirements-cv.txt` installed, expect `appearance` fallback, not
      `arcface` — see finding A-5. Document which backend was active for any
      demo or recorded metric.
- [ ] Enroll a reference face during exam setup
- [ ] Start exam-taking; confirm the WebSocket connects (`status: live` in the
      proctoring dock) rather than falling back to REST polling
- [ ] Cover the camera / step out of frame → `no_face` event logged, alert
      raised after the grace period in `pipeline.yaml`
- [ ] Have a second person enter frame → `multiple_faces` event
- [ ] Look away past the yaw/pitch threshold → `looking_away` event (confirm
      this actually fires — finding A-4 notes a code path that can silently
      suppress it on error)
- [ ] Switch browser tabs → `tab_hidden`/`tab_visible` `SessionLog` entries
- [ ] Attempt right-click and copy on exam question text → blocked; attempt the
      same inside the answer textarea → allowed (this is the intended
      carve-out, not a bug)
- [ ] Attempt to trigger `fullscreen_exit` → **currently nothing emits this
      event from the frontend; expect no log entry (finding E-3)**
- [ ] Admin monitoring dashboard shows the live session and its alerts in
      real time
- [ ] Terminate a session as PROCTOR/ADMIN → session status becomes `terminated`

## 5. Cross-browser / responsive pass

- [ ] Chrome, Firefox, and Safari (or WebKit via Playwright if available) —
      login, dashboard, exam-taking, monitoring
- [ ] Mobile viewport (< 768px) — sidebar collapses to drawer, exam-taking
      remains usable, camera permission prompt appears correctly
- [ ] Keyboard-only navigation through the 6 hand-rolled modals listed in
      finding E-4 — expect no focus trap and no Escape-to-close; note where
      this breaks a workflow entirely vs. is merely inconvenient
- [ ] Screen reader spot-check on the Settings and Users admin pages — expect
      missing accessible names on unlabeled `<label>` elements (finding E-4)

## 6. Before every capstone defense — verification pass

- [ ] Re-run `grep -rniE "yolo" README.md REPOSITORY_GUIDE.md docs/` and confirm
      every remaining hit has been corrected or is properly caveated (finding B-1)
- [ ] Re-count backend tests (`find backend -name 'test*.py' -not -path
      '*/venv/*' -exec grep -h 'def test_' {} + | wc -l`) and use that number,
      not whatever the last doc said (finding B-4)
- [ ] Re-read `docs/todo` §6 against §4 and resolve which is authoritative
      before quoting either to the panel (finding B-3)
- [ ] Confirm the load test in `02-test-plan.md` §7 has been run and has a
      number to answer "can it handle ~30/room, ~100 total?" (finding C-7)
