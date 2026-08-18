# Capstone Defense Revision — Implementation Plan

**Single source of truth for scope:**
[Capstone Defense Revision Directive](https://claude.ai/code/artifact/d31e70d0-6416-442a-92a6-f69b35a4ae29)
(the "**Directive**" throughout this document)

Scope per the Directive masthead: **5 working areas · 42 feedback items · 3 priority tiers**
(19 × P0, 13 × P1, 8 × P2).

This plan does not invent requirements. Every task below carries a citation back to the
Directive, and **nothing gets built that is not traceable to a Directive line item**. If a
task has no citation, it is out of scope for Capstone 2 revision work.

---

## 0. How to read this plan

### 0.1 Citation convention

Every task is tagged like this:

> `[D · A1 › Role-based access control · P0]`

| Token | Meaning |
|-------|---------|
| `D` | The Directive (the artifact linked above) — always the source |
| `A1`–`A5` | Directive Area 01–05 |
| `› Sub-heading` | The exact `h3` sub-section inside that Area |
| `P0/P1/P2` | Priority tag carried verbatim from the Directive |

**Rule for every contributor and every AI session:** before starting a task, re-open the
Directive at the cited Area and read the checklist items under that sub-heading. The
Directive wording is the acceptance criteria. This plan sequences the work; the Directive
defines *what done means*.

### 0.2 Definition of Done (applies to every task)

A task is done only when all four are true:

1. **Code** — implemented and merged.
2. **Test** — covered by an automated test, per `[D · A5 › Testing methodology]` which
   requires testing *during* development, not after.
3. **Doc** — the corresponding chapter section under `docs/documentation/` is updated in
   the same PR.
4. **Defense answer** — the task's "Panel answer" line (given per task below) can be
   spoken out loud in the room with a citation or a number behind it.

Item 4 is the one that failed at Capstone 1. `[D · A4 › Threshold justification]` —
*"are your threshold values based on research, or did the team just decide them?"*

### 0.3 What NOT to rebuild

Per `[D · What The Panel Liked]` — the CV concept, identity detection, and the
snapshot-over-continuous-video tradeoff already landed well, and the exam system was not
seen as the biggest problem. **Do not spend Capstone 2 re-litigating these.** Work on them
is limited to *justification and documentation*, not redesign.

---

## 1. Baseline audit — what the repo already has

The efficiency of this plan comes from not rebuilding what exists. Current state as of
branch `rbac-pbac-refactor`:

| Directive item | Repo state | Verdict |
|---|---|---|
| `[A1 › RBAC]` roles + permissions | `backend/core/security/` 3-tier engine (role guard / module access / action permission), `permissions_registry.py`, `PermissionChange` audit model | **Engine done** — extend, don't rebuild |
| `[A1 › RBAC]` 6 named roles | Only 4: `ADMIN / FACULTY / STUDENT_ASSISTANT / STUDENT` (`features/authentication/models.py:16`) | **Gap** — extend enum |
| `[A1 › Administrator responsibilities]` exam approval chain | `Exam.Status` = `draft / active / archived` only | **Gap** |
| `[A1 › Registration]` OTP / email verify | Only a UI component `shared/components/ui/input-otp.tsx`; no backend | **Gap** |
| `[A2]` design tokens | `frontend/src/styles/theme.css` "Observation Deck" light navy system, LCC green as signal | **Mostly there** — needs contrast audit |
| `[A2 › Institutional identity]` | `core/config/brand.ts` wired for Legacy College of Compostela + Wellness and Care Center; logos are SVG placeholders | **Gap** — real assets |
| `[A3 › Scheduling]` window | `Exam.available_from` / `available_until` exist | **Partial** — no derived state, no enforcement |
| `[A3 › Exam discovery]` categories | No `category` field anywhere | **Gap** |
| `[A3 › Dept & section]` multi-dept | `Exam.department` is a single FK | **Gap** |
| `[A3 › Dept & section]` cloning | Clone exists in `exams/services.py` + `builder-settings-tab.tsx` | **Done** |
| `[A3 › Question mgmt]` reordering | `builder/sortable-question-list.tsx` | **Done** |
| `[A3 › Question mgmt]` images | `QuestionAttachment` (image/pdf/audio) on questions | **Partial** — no image *answer choices* |
| `[A3 › Bulk import]` | `exams/lib/question-import-template.ts` + test | **Partial** — verify XLSX + validation |
| `[A4]` CV thresholds | `backend/ai/config/pipeline.yaml` — real numbers exist (`identity_match_threshold: 0.42`, `gaze_yaw_threshold_deg: 40`, weights, 60s/3-flag window) | **Values exist, zero citations** — the exact failure the panel named |
| `[A4 › Anomaly accumulation]` | `behavior/models.py` `BehaviorLog.score`, `Alert.severity`, `suspicious_pattern` window in YAML | **Partial** — no explicit Normal→Warning→Suspicious→Critical tiers |
| `[A4 › Capacity]` load testing | Nothing under `scripts/` or `backend/scripts/` | **Gap** |
| `[A5]` chapters | `docs/documentation/chapter1/` + `chapter2/` scaffolded | **Present** — content gaps |
| `[A5 › Testing]` | `docs/testing/testing(IEEE)` + `(UTAUT)` scaffolds | **Partial** |

**Headline:** the access-control engine and the exam builder are further along than the
Directive assumes. The real debt is **justification, measurement, and documentation**
(`A4` + `A5`), plus a handful of genuine feature gaps.

---

## 2. Sequencing strategy

### 2.1 Three parallel tracks

Running these serially wastes the calendar. Run three tracks concurrently:

| Track | Owner profile | Covers |
|---|---|---|
| **T-BE** Backend / data | Django, DRF, models | `A1`, `A3` |
| **T-FE** Interface | React, Tailwind, design | `A2`, `A3` UI |
| **T-RD** Research / documentation | Paper, citations, benchmarks | `A4` justification, `A5` |

**T-RD starts on day 1 and never stops.** This is a direct requirement of
`[D · A5 › Testing methodology · P0]` — *"testing runs continuously, before, during, and
after deployment."* If T-RD is treated as a write-up phase at the end, the same correction
gets issued again.

### 2.2 Dependency-ordered sprints

```
Sprint 1  ──►  Sprint 2  ──►  Sprint 3  ──►  Sprint 4  ──►  Sprint 5  ──►  Sprint 6
 Access &      Identity &     Exam           CV rigor &     Capacity &     Consolidate
 roles         readability    lifecycle      escalation     hardware       & deploy
 (A1)          (A2)           (A3)           (A4)           (A4)           (A5)

T-RD ══════════════════════════════════════════════════════════════════════════════►
     RRL · benchmarking · thresholds · dataset · algorithm comparison · WBS · testing
```

**Why this order:**

- **Sprint 1 first** because `[A1 › RBAC]` roles are an upstream dependency for
  `[A3 › Guidance-specific scope]` (question confidentiality), `[A3 › Administrator
  responsibilities]` (approval chain), `[A5 › Work breakdown]` (use-case diagrams must
  reflect the new roles), and every permission-gated screen in `A2`. Building UI against
  four roles and then re-doing it against six is the single biggest avoidable rework in
  this plan.
- **Sprint 2 second** because `[A2 › Readability & contrast]` establishes the token layer
  every subsequent screen in Sprint 3 is built on. Fixing contrast after building the
  exam-discovery UI means touching it twice.
- **Sprint 4 before Sprint 5** because you cannot load-test escalation logic that hasn't
  been defined yet.

---

## Sprint 1 — Access, Roles & Registration

> Directive source: **Area 01 — Authentication, Roles & Access Control**
> *"one administrator creates a bottleneck and makes the system vulnerable if that person
> is unavailable"*

### 1.1 Extend the role model to the six named roles

`[D · A1 › Role-based access control · P0]`

The Directive names them explicitly: **Administrator, Guidance Staff, Program Head,
Teacher/Exam Creator, Proctor, Examinee.**

Proposed mapping onto the existing enum (`features/authentication/models.py`):

| Directive role | Enum value | Action |
|---|---|---|
| Administrator | `ADMIN` | keep |
| Guidance Staff | `GUIDANCE_STAFF` | **new** |
| Program Head | `PROGRAM_HEAD` | **new** |
| Teacher / Exam Creator | `FACULTY` | keep, relabel |
| Proctor | `PROCTOR` | **new** (absorbs `STUDENT_ASSISTANT`) |
| Examinee | `STUDENT` | keep, relabel to "Examinee" in UI |

Files: `backend/features/authentication/models.py`, `migrations/`,
`backend/core/security/permissions_registry.py`, `backend/core/security/modules.py`,
`frontend/src/features/admin/components/manage-access-dialog.tsx`.

- Data migration must map every existing `STUDENT_ASSISTANT` row to `PROCTOR`.
- **Panel answer:** *"Six roles, named in our directive, each with an enumerated
  permission set — here is the matrix."*

### 1.2 Build the role × permission matrix

`[D · A1 › Role-based access control · P0]` — the Directive lists the required verbs:
*create, read, update, delete, approve, monitor, manage users, manage exams, view reports.*

- Extend `PERMISSIONS` in `permissions_registry.py` with the missing verb: **`exams.approve`**
  (currently absent — required by §1.3).
- Fill `ROLE_DEFAULT_ACTIONS` for the three new roles.
- Produce the matrix as a table in `docs/documentation/chapter2/03-system-design.html`.
- **Note for the paper:** `[D · A1]` says *"consider permission-based access if RBAC alone
  isn't dynamic enough."* The repo **already has this** — the 3-tier engine in
  `backend/core/security/` with per-user grant/deny overriding role defaults. This is a
  strength to present, not a gap to fill. Document it as the answer to that item.

### 1.3 Split administrative oversight from operations

`[D · A1 › Administrator responsibilities · P0]`

The Directive is specific: *stop making the administrator responsible for creating every
exam*; teachers/program heads create or submit; program heads review, revise, approve.

Extend `Exam.Status` (`backend/features/exams/models.py:40`):

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → PUBLISHED → CLOSED → ARCHIVED
                          └────────► REJECTED ──► (back to DRAFT)
```

- `exams.create` → Faculty / Guidance Staff
- `exams.approve` → Program Head / Administrator (**new permission from §1.2**)
- Add `Exam.submitted_by`, `approved_by`, `approved_at`, `rejection_note`.
- Add an `ExamApprovalEvent` audit row per transition — mirrors the existing
  `PermissionChange` audit pattern, so reuse that shape.
- **Panel answer:** *"Level 0 Administrator → Level 1 Program Head → operational roles,
  and the exam cannot go live without a Level 1 approval event in the audit log."*
  (`[D · A1]` asks for exactly this hierarchy.)

### 1.4 Simplify registration

`[D · A1 › Registration & verification · P0]`

- Strip signup to essential fields only.
- **Remove the required profile photo at signup** — make it optional, added later from
  the profile page (`frontend/src/features/profile/`). This is called out verbatim.
- Add password confirmation.
- Files: `frontend/src/features/auth/components/`,
  `backend/features/authentication/serializers.py`.

### 1.5 OTP + email verification

`[D · A1 › Registration & verification · P0]`

The repo has the OTP *input component* (`shared/components/ui/input-otp.tsx`) and no
backend. Build:

- `EmailVerification` model: user, token, purpose, `expires_at`, `consumed_at`, attempt
  counter.
- Endpoints: request-OTP, verify-OTP, resend (rate-limited).
- Email delivery via Django's email backend; console backend in dev.
- **The Directive asks a design question, not just an implementation one:** *"decide
  exactly where OTP sits in the registration flow, and make the flow visually clear."*
  Produce a flow diagram — register → OTP sent → verify → account active — and put it in
  `docs/documentation/chapter2/03-system-design.html`. Do not skip the diagram; it is the
  deliverable the Directive actually names.

### Sprint 1 exit criteria

- [ ] Six roles live, with a migration and a permission matrix table in the paper
- [ ] Exam approval chain enforced end-to-end with an audit trail
- [ ] Registration has no mandatory photo, and has OTP + email verification
- [ ] Use-case diagrams updated (also serves `[D · A5 › Work breakdown]`)
- [ ] Access/security tests added (`[D · A5 › Testing methodology]` — "during development")

---

## Sprint 2 — Institutional Identity & Readability

> Directive source: **Area 02 — UI / UX Redesign**, described as *"the single largest
> volume of feedback"*
> *"poor contrast, an overly dark theme, no institutional identity, and a generic,
> template-generated look"*

### 2.1 Contrast audit and token correction

`[D · A2 › Readability & contrast · P0]`

The Directive lists four specific targets: overall text/background contrast, button /
disabled-state / input-field contrast, gray-on-gray elimination, and status states
distinguishable at a glance.

- Audit every pair in `frontend/src/styles/theme.css` against **WCAG AA** (4.5:1 body,
  3:1 large text and UI boundaries). Record actual ratios in a table — a measured number
  per token is what makes this defensible.
- Highest-risk tokens on inspection: `--muted-foreground: #566481` on `--muted: #dfe6f1`,
  and `--input-background: rgba(19,39,67,0.05)` for field boundaries. Verify these first.
- Disabled states are named explicitly in the Directive — audit them, don't assume.
- **Panel answer:** *"Every token pair is measured; here is the ratio table and the AA
  threshold."*

### 2.2 Pull back from the dark theme

`[D · A2 › Tone & theme · P1]`

`theme.css` already documents a **light** "Observation Deck" navy system, so the dark-heavy
appearance the panel saw may be the dark-mode default rather than the palette itself.

- Confirm what the panel actually saw before changing colors — check the default in
  `core/providers/theme-provider.tsx`. If light is not the default, **that alone may
  resolve this item.**
- Rebuild visual hierarchy for *"real classroom conditions"* — assume projector glare and
  low-end monitors, which is a stronger constraint than a designer's laptop.

### 2.3 Legacy College identity

`[D · A2 › Institutional identity · P0]`

`core/config/brand.ts` is already wired for *Legacy College of Compostela* and the
*Wellness and Care Center*, but every asset is an SVG placeholder.

- Replace `frontend/public/branding/`: `app-logo.svg`, `institution-logo.svg`,
  `department-logo.svg`, `school-campus.svg` with real institutional assets.
- Align the accent ramp with official LCC colors; `theme.css` already recasts LCC green as
  the safe/pass signal — decide deliberately whether that stays, and be ready to defend it.
- `[D · A2]` also demands: *"redesign obviously templated / generated components"* and
  *"make every layout decision intentional and defensible in the room."* Do a component
  sweep for default shadcn/Tremor styling that was never customized — the panel spotted
  this once and will look again.

### 2.4 Dashboard organization

`[D · A2 › Dashboard organization · P2]`

Placement/hierarchy review, better sort/search/filter surfaces, decongest cramped views,
consistent status colors. P2 — do it, but not ahead of Sprint 3.
**Efficiency note:** the search/filter/sort work here overlaps `[D · A3 › Exam discovery ·
P0]`. Build the filter/sort UI primitives **once**, in Sprint 3, and reuse them here.

### Sprint 2 exit criteria

- [ ] WCAG AA contrast ratio table, all pairs passing, published in the paper
- [ ] Real Legacy College assets in place; no placeholder SVGs remain
- [ ] Templated-component sweep complete
- [ ] UI tests / visual checks added

---

## Sprint 3 — Exam Lifecycle & LMS Parity

> Directive source: **Area 03 — Exam Management & LMS Behavior**
> *"Don't reinvent the LMS examination workflow — benchmark it."*

### 3.1 LMS benchmarking — do this FIRST in the sprint

`[D · A3 › LMS benchmarking · P0]`

The Directive is blunt: *study Google Forms, Jotform, and comparable LMS platforms
**before finalizing** the exam-creation workflow.* Doing it after the build inverts the
instruction and wastes the finding.

- The Directive supplies the exact matrix. Reproduce its 8 rows verbatim: question
  creation flow · drag-and-drop reordering · question types supported · randomization /
  shuffling · search & filtering · scheduling / publishing · question bank behavior ·
  results workflow.
- Fill all four columns including the **Knowing Eye** column (currently all `?` in the
  Directive).
- Output lands in `docs/documentation/chapter2/02-system-analysis.html`.
- **Any Sprint 3 design decision that contradicts the benchmark must be justified in
  writing.** That written justification is the panel answer.

Owner: **T-RD**, delivered before T-BE/T-FE start §3.2 onward.

### 3.2 Exam discovery

`[D · A3 › Exam discovery · P0]`

- Add an `ExamCategory` model (no `category` field exists today) + FK/M2M on `Exam`.
  Given `[D · A3 › Guidance-specific scope]`, seed with Guidance categories — psychological,
  mental/abstract, behavioral/character — not academic subjects.
- Server-side search / filter / sort on the exam list endpoint
  (`backend/features/exams/repositories.py`, `views.py`), with pagination.
- Frontend filter bar built as a **reusable primitive** — reused by Sprint 2 §2.4 and by
  the reports screens.
- Rationale from the Directive: *"don't rely on cards alone once volume grows."*

### 3.3 Scheduling window and exam codes

`[D · A3 › Scheduling & exam codes · P0]`

`available_from` / `available_until` already exist but are not enforced or surfaced.

- Derived state — the Directive names all four: **Upcoming / Active / Closed / Expired.**
  Compute from the window + `Exam.status`; expose on the serializer; do not store it.
- **Enforce** the deadline server-side. Block session start after close. A client-side-only
  check will not survive the security questioning.
- Exam-code generation (dept abbreviation + year) already exists via `Department.abbreviation`
  — make the field **read-only in the builder** (`builder-settings-tab.tsx`) per *"lock it
  from accidental edits"*, while `title` stays independently editable.

### 3.4 Multi-department & section assignment

`[D · A3 › Department & section assignment · P1]`

- `Exam.department` FK → **M2M** `departments`, for shared / general-ed exams. Migration
  must preserve existing single-department rows.
- Section-level assignment with per-group schedules — extend `ExamAssignment`.
- **Cloning already exists** (`exams/services.py`, `builder-settings-tab.tsx`) — verify it
  covers questions, sections, and pools, then mark this Directive line **done** and say so.

### 3.5 Question management

`[D · A3 › Question management · P1]`

- Drag-and-drop reordering: **already built** (`builder/sortable-question-list.tsx`) —
  verify and claim it.
- **Lock question editing once an exam is in progress.** Not built. Gate on
  "any `ExamSession` exists in progress for this exam." The Directive's reasoning —
  *"students may already be answering"* — is the panel answer.
- **Images in answer choices**, not just question bodies. `QuestionAttachment` covers the
  question; the `options` JSONField does not carry media. Extend the option shape to
  `{ text, image }`. The Directive ties this to Guidance content: *"abstract/psychological
  items need image-based options."*

### 3.6 Bulk import

`[D · A3 › Bulk import · P1]`

`exams/lib/question-import-template.ts` exists. Close the gaps the Directive names:

- XLSX **and** CSV, with a downloadable template.
- Row validation on: question type, choices, correct answer, ordering, **media references**.
- Document template columns with an example row and the accepted question types.

### 3.7 Guidance-specific scope

`[D · A3 › Guidance-specific scope · P1]`

- Restrict question access so confidential content stays inside the Guidance Office —
  implement via the Sprint 1 permission layer (`exams.read` scoped by role), not ad hoc.
- The Directive raises a **design question worth answering explicitly**: *"re-examine
  whether 'department' should be a primary exam attribute at all, given Guidance's process
  is broader than one academic department."* §3.2 (categories) and §3.4 (M2M) together
  demote department from primary key-attribute to one facet among several. State that as
  the deliberate answer.

### 3.8 Results

`[D · A3 › Results · P1]`

- **Hold essay results for manual grading** — do not auto-release an exam containing essay
  items. Gate release on grading completion (`features/exams/components/grader/` exists).
- Email notification on results release (reuse the Sprint 1 email infrastructure).
- Per-exam results / warnings / terminations / exportable reports for admins and proctors
  (`backend/features/reports/`).

### Sprint 3 exit criteria

- [ ] Benchmarking matrix complete and in the paper, all four columns
- [ ] Categories + search/filter/sort live
- [ ] Window enforced server-side, four states surfaced, code locked
- [ ] Multi-department M2M migrated; question editing locked during active sessions
- [ ] Image answer choices; XLSX/CSV import validated
- [ ] Essay results held for grading

---

## Sprint 4 — CV Rigor: Parameters, Thresholds, Escalation

> Directive source: **Area 04 — Computer Vision & Monitoring**, *"the panel's most
> technical line of questioning"*
> *"are your threshold values based on research, or did the team just decide them?"*

**This is the highest-risk sprint.** `backend/ai/config/pipeline.yaml` already contains real
numbers — `identity_match_threshold: 0.42`, `gaze_yaw_threshold_deg: 40`,
`gaze_pitch_threshold_deg: 35`, `posture_shoulder_tilt_max: 0.18`,
`no_face_grace_seconds: 2.0`, a 60s/3-flag suspicious window, and per-signal weights. Every
one of those was chosen by the team. **That is precisely the thing the panel challenged.**
The work here is mostly *justification*, and the values may well survive unchanged.

### 4.1 Parameter specification table

`[D · A4 › Define every CV parameter · P0]`

The Directive names the seven parameters — **face presence, identity match, head-facing
camera, upper-body visibility, head movement, eye gaze, posture** — and the exact six
columns to document each with:

```
what it measures → why it matters → normal vs. suspicious range
                 → detecting algorithm → threshold → action on breach
```

Build this as a **7-row × 6-column table**, each row cross-referenced to the YAML key it
controls. Note that *upper-body visibility* and *head movement* have no obvious dedicated
key in `pipeline.yaml` today — either map them to existing pose signals or add them.

Deliverable: `docs/documentation/chapter2/03-system-design.html` **and** an expanded
comment block in `backend/ai/config/pipeline.yaml` so the citation lives next to the value.

### 4.2 Threshold justification

`[D · A4 › Threshold justification · P0]`

Four Directive requirements:

1. Define "anomaly" precisely, per parameter.
2. **Base thresholds on cited research, not internal judgment.** For each YAML value:
   find literature, cite it, and either keep the value (with the citation) or move it to
   the cited value and note the change.
3. Make **Normal → Suspicious → Anomalous** explicit tiers, not a binary flag.
4. **Factor in duration and frequency, not single-frame events, to cut false positives.**
   The `no_face_grace_seconds: 2.0` and 60s/3-flag window already do this — document them
   as the answer to this exact item.

Owner: **T-RD**, working directly against the YAML. Nothing else in Sprint 4 can be
defended until this exists.

### 4.3 Anomaly accumulation model

`[D · A4 › Anomaly accumulation model · P0]`

The Directive specifies the ladder: **Normal → Warning → Suspicious → Critical → Action**,
replacing *"one head turn = anomaly."*

- Formalize the tiers in code. `behavior/models.py` has `BehaviorLog.score` and
  `Alert.severity` (low/medium/high) — map severity onto the Directive's four-tier ladder
  rather than inventing a parallel scheme.
- Count repeated occurrences of the same signal (face missing ×1, ×2, ×3…).
- **Weight combined signals higher than one isolated signal** — `pipeline.yaml` already has
  `metric_weights` and per-flag `weights`; make the combination rule explicit and testable.
- Define what happens at each tier: notify → warn → pause → proctor intervention →
  terminate. Wire terminate to the existing `sessions.terminate` permission.
- **Unit-test the escalation ladder** with synthetic event streams. This is the cheapest,
  most convincing demo you can put in front of the panel.

### 4.4 Dataset methodology

`[D · A4 › Dataset methodology · P0]`

- Data source, collection method, sample size.
- Cleaning, annotation, labeling process.
- **Train/test split stated and justified** — the Directive notes the panel asked this
  directly (70/30 vs 80/20). Give the number *and* the reason.
- Home: `backend/ai/training/` + a methodology section in Chapter 2.

### 4.5 Algorithm comparison

`[D · A4 › Algorithm comparison · P0]`

- Benchmark the current stack against **at least one alternative each** — the Directive
  names the incumbents: YOLOv8 and MediaPipe. (`pipeline.yaml` also shows `arcface /
  buffalo_l` for embeddings — include it.)
- Compare **accuracy, speed, resource cost**.
- State why the selected algorithm best fits *these* requirements. "It's what we started
  with" is not an answer.
- Run on the actual dataset from §4.4; publish the numbers.

### 4.6 Snapshot monitoring & proctor dashboard

`[D · A4 › Snapshot monitoring & proctor dashboard · P1]`

- Document that monitoring uses **periodic snapshots over WebSockets, not continuous
  video**, and why (bandwidth/processing cost). Per `[D · What The Panel Liked]` this
  tradeoff was **already accepted** — this is a writing task, not a redesign.
- State snapshot frequency (`target_fps: 5` in YAML), trigger, and **retention policy**.
  Retention has privacy implications for minors — do not leave it unspecified.
- **Proctor locator**: a flagged student must be findable *physically* — seat/room/station
  identifier on the alert, not just a list row. Requires a seat-assignment field; ties to
  the floor-plan diagram in `[D · A5 › Work breakdown]`.
- **Pin the camera-preview widget** so it doesn't move on scroll
  (`frontend/src/features/monitoring/`). Small fix, explicitly named.

### 4.7 Browser-side deterrents

`[D · A4 › Browser-side deterrents · P2]`

- Disable right-click / selection / copy where appropriate; tab-switch detection
  (`Exam.max_tab_switches` already exists); consider fullscreen.
- **Document these as deterrents, not absolute security.** The Directive warns explicitly:
  *"don't overclaim in the paper."* Getting caught overclaiming here costs more than the
  feature is worth.

---

## Sprint 5 — Capacity, Hardware & Load Testing

> Directive source: **Area 04**, *"'It's web-based' is not a technical requirements
> section — camera processing still has real hardware demands."*

### 5.1 Technical requirements specification

`[D · A4 › Camera & hardware requirements · P0]` — the Directive gives the three layers and
the fields for each:

| Layer | Must specify (verbatim from the Directive) |
|---|---|
| Camera | position, angle, distance, field of view, min./recommended resolution, lighting |
| Client device | RAM, processor, OS, browser, camera, internet requirement |
| Server | CPU, RAM, storage, network, hosting environment, concurrent-user target |

Every field gets a number. Derive the camera fields from the CV pipeline's actual input
constraints (`preprocessing.max_width: 640`) and from §5.2 measurements — not from
guesswork, which is the same mistake as §4.2.

### 5.2 Load testing

`[D · A4 › Capacity & performance · P0]`

Nothing exists under `scripts/` today. Build it:

- Harness (Locust or k6) under `scripts/load/`, driving both the REST API and the
  **WebSocket snapshot channel** — the WS path is the one that actually breaks, and it is
  the one nobody tests by accident.
- Ladder exactly as the Directive specifies: **5 → 10 → 20 → 30 → 50 → 100** concurrent users.
- Measure at each step: **response time, CPU, RAM, network, error rate.**
- **Answer the question the Directive says to answer directly:** *can the system handle
  ~30 in a room, and ~100 overall?* One sentence, with the table behind it. Establish max
  simultaneous examinees per room and per server.

This produces the numbers that §5.1 needs, so §5.2 runs first if the calendar is tight.

---

## Sprint 6 — Documentation, Testing Model & Deployment

> Directive source: **Area 05 — Documentation & Research**
> *"Chapters 1–2 need to be defensible on their own before Capstone 2 begins."*

Most of this content is produced by **T-RD during Sprints 1–5**. Sprint 6 consolidates; it
does not start from zero. If Sprint 6 is where the writing begins, the plan has failed.

### 6.1 Related literature

`[D · A5 › Related literature · P0]`

- Add literature on facial detection/recognition, head pose, eye gaze, posture, and
  behavioral anomaly detection in exam monitoring → `docs/documentation/chapter1/04-rrl.html`.
- **Cite the source for every technical claim** — the Directive notes the panel asked
  directly where claims came from.
- Build the explicit chain the Directive names:
  `literature → factor → parameter → algorithm → measurement → threshold`.
  This is the same chain as §4.1/§4.2 — write it once, reference it in both chapters.

### 6.2 Continuous testing model

`[D · A5 › Testing methodology · P0]` — flagged in the Directive as a **major correction**.
The four phases, verbatim:

| Phase | Activities |
|---|---|
| During development | unit, integration, functional, CV, UI, performance, access/security testing |
| Before deployment | pre-deployment validation, readiness check, fix critical issues |
| During deployment | real-world results, performance measurement, user feedback, live fixes |
| After deployment | analyze results, document findings, final revisions |

Rewrite `docs/documentation/chapter2/04-system-testing.html` around this table, and align
`docs/testing/testing(IEEE)` and `testing(UTAUT)` to it. **The Definition of Done in §0.2
of this plan is the mechanism** that makes "during development" true rather than claimed —
point at it in the paper.

### 6.3 Work breakdown & system design

`[D · A5 › Work breakdown & system design · P1]`

- **Rebuild the WBS around Agile sprints** (design → develop → test → sprint → repeat), not
  sequential phases. This plan's six-sprint structure is that WBS — import it via
  `scripts/import_wbs_from_csv.py`.
- **Physical / floor-plan diagram**: examinee seating, camera placement, proctor position,
  network layout. Feeds the proctor locator in §4.6 — same seat identifiers, one model.
- Update use-case diagrams for the new RBAC roles (delivered in Sprint 1; verify here).

### 6.4 Deployment plan

`[D · A5 › Deployment plan (Capstone 2) · P1]`

- Pre-deployment validation before going live with the Guidance Office.
- **A roughly six-week actual deployment window** — the Directive gives the duration; put
  it on the calendar with dates, not as an aspiration.
- Collect deployment results, log issues, fix, document outcomes for the final paper.
- Home: `docs/deployment.md`.

---

## 3. Full traceability matrix

All 42 Directive items → sprint. Use this to confirm nothing was dropped.

### P0 — 19 items, must fix before the next defense

`[D · Priority Backlog › P0]`

| # | Directive item | Sprint | Status hint from audit |
|---|---|---|---|
| 1 | RBAC & permissions | 1 | Engine exists; extend to 6 roles |
| 2 | Admin scope split | 1 | New approval chain |
| 3 | Registration simplification | 1 | Remove photo requirement |
| 4 | OTP / verification | 1 | UI only; backend missing |
| 5 | Contrast & readability | 2 | Measure `theme.css` |
| 6 | Legacy College identity | 2 | Placeholders → real assets |
| 7 | De-genericize UI | 2 | Component sweep |
| 8 | Exam search/filter/sort | 3 | Missing |
| 9 | Exam scheduling window | 3 | Fields exist; unenforced |
| 10 | LMS benchmarking | 3 (first) | Matrix supplied by Directive |
| 11 | CV parameter definitions | 4 | 7×6 table |
| 12 | Threshold justification | 4 | Values exist, citations don't |
| 13 | Anomaly accumulation model | 4 | Partial in YAML + `behavior/` |
| 14 | Dataset methodology | 4 | Missing |
| 15 | Algorithm comparison | 4 | Missing |
| 16 | Camera/hardware spec | 5 | Missing |
| 17 | Capacity/load testing | 5 | No harness at all |
| 18 | Continuous testing model | 6 (+ all) | Enforced by §0.2 DoD |
| 19 | RRL + citations | 6 (+ all) | Chapter 1 gap |

### P1 — 13 items

`[D · Priority Backlog › P1]`

| Directive item | Sprint | Note |
|---|---|---|
| Multi-department exams | 3 | FK → M2M |
| Exam cloning | 3 | **Already built** — verify & claim |
| Question reordering/locking | 3 | Reorder built; locking missing |
| Image-based questions | 3 | Attachments yes; option images no |
| Bulk import templates | 3 | Partial |
| Guidance-specific scope | 3 | Ties to categories + permissions |
| Results / essay grading | 3 | Hold auto-release |
| Snapshot documentation | 4 | Writing task only |
| Proctor locator | 4 | Needs seat model |
| Fixed camera widget | 4 | Small CSS fix |
| Agile WBS | 6 | This plan *is* the WBS |
| Floor plan diagram | 6 | Shares seat model with locator |
| 6-week deployment plan | 6 | Calendar it |

### P2 — 8 items

`[D · Priority Backlog › P2]`

| Directive item | Sprint |
|---|---|
| Dashboard hierarchy | 2 |
| Status indicator design | 2 |
| Browser deterrents | 4 |
| Report filtering/export | 3 |
| Result email notification | 3 |
| Use-case diagram refresh | 1 / 6 |
| Interaction polish | 2 |
| Additional CV optimization | 4 |

---

## 4. Efficiency notes — where the leverage is

1. **Do not rebuild the security engine.** `backend/core/security/` already implements the
   three-tier RBAC + PBAC model the Directive asks for, including the per-user grant/deny
   dynamism `[D · A1]` raises as a contingency. Extending the enum and registries is days;
   rebuilding is weeks.
2. **Build the filter/sort primitive once.** It satisfies `[D · A3 › Exam discovery · P0]`,
   `[D · A2 › Dashboard organization · P2]`, and the P2 report-filtering item.
3. **Seat identifiers serve two items at once** — the proctor locator
   `[D · A4 › Snapshot monitoring]` and the floor-plan diagram
   `[D · A5 › Work breakdown]`. Model it once.
4. **The email pipeline serves three items** — OTP `[D · A1]`, result notification
   `[D · A3 › Results]`, and approval notifications `[D · A1 › Administrator
   responsibilities]`. Build it in Sprint 1.
5. **Sprint 4 is mostly writing, not coding.** The numbers already exist in
   `pipeline.yaml`. Budget T-RD hours, not T-BE hours — and start the literature search in
   Sprint 1 so citations are ready when Sprint 4 opens.
6. **Run §5.2 load testing before §5.1 hardware spec.** The spec's numbers come from the
   measurements.
7. **Claim what is already done.** Cloning, drag-and-drop reordering, snapshot architecture,
   and the PBAC layer are finished work that maps onto Directive line items. Presenting them
   as answered items is free credit — provided the documentation exists to back the claim.

---

## 5. Standing risks

| Risk | Directive basis | Mitigation |
|---|---|---|
| Thresholds stay uncited and the same question returns | `[D · A4 › Threshold justification]` — quoted challenge | T-RD owns §4.2 from week 1; no Sprint 4 sign-off without citations |
| Testing slips back to a post-deployment activity | `[D · A5 › Testing methodology]` — the "major correction" | §0.2 Definition of Done blocks merge without a test |
| Sprint 3 build precedes benchmarking | `[D · A3 › LMS benchmarking]` — *"before finalizing"* | §3.1 is a hard gate on the rest of Sprint 3 |
| Role rework cascades into UI | Sprint ordering | Sprint 1 lands roles before any Sprint 2/3 screen is built |
| Time spent re-litigating accepted decisions | `[D · What The Panel Liked]` | CV concept, identity detection, snapshot tradeoff, and the exam system are **documentation-only** — no redesign |

---

*This plan is derived entirely from the
[Capstone Defense Revision Directive](https://claude.ai/code/artifact/d31e70d0-6416-442a-92a6-f69b35a4ae29).
When this plan and the Directive disagree, the Directive wins — update this plan, not the
scope.*
