# Kervy's QA Workspace — Knowing Eye

*Author: Kervy Cadiente, System Architect, acting as QA / capstone reviewer.
Everything in this folder was verified against the actual code and by
actually running the actual commands, on 2026-09-06 (commit `e3a64bf`, branch
`kervy`) — not copied forward from another document. Where I couldn't verify
something (an install failed, a command wasn't available), that's stated
explicitly rather than assumed.*

## Why this folder exists

The system was built almost entirely by Twixt Jasley Tamera. My role going
into Capstone 2 is QA and review, not development — so before I can do that
job, I need (1) an honest map of a system I didn't write, and (2) the QA
artifacts a BSIT panel expects, which turned out to be almost entirely
missing: `docs/testing/testing(IEEE)/` and `testing(UTAUT)/` are each one
README and one bootstrap script that generates 19 placeholder test cases with
no real steps. This folder is what actually exists in their place.

## Start here

| I want to... | Go to |
|---|---|
| Understand the system before touching anything | `01-system-brief.md` |
| Know how to actually run the tests | `02-test-plan.md` §3, or `01-system-brief.md` §6 |
| See the full test-case matrix | `03-test-cases.csv` |
| See what the panel's directive requires vs. what's actually true | `04-traceability-matrix.csv` |
| See the defects found in this pass, ready to hand to Twixt | `05-defect-log.csv` |
| Read the prioritised findings with evidence | `06-qa-findings.md` |
| Run a manual pass (RBAC, exam lifecycle, monitoring) | `07-manual-checklists.md` |
| Find supporting screenshots/logs | `evidence/` |

## Read this first: three things are more urgent than test-plan process

1. **An examinee can delete their own proctoring evidence, edit their own
   session status, and clear their own cheating alerts — right now, through
   the public API.** Findings A-1, A-2, A-3 in `06-qa-findings.md`. These are
   small fixes (restrict which HTTP verbs three viewsets accept) but they
   defeat the product's entire premise until fixed. Talk to Twixt about these
   before anything else in this folder.
2. **The docs claim YOLOv8 is implemented. It never was.** Finding B-1. The
   team caught this once and fixed four pages; six more references remain,
   including two marked 100% complete. A panel that greps the repo for "YOLO"
   will find this in seconds.
3. **Identity verification isn't running as ArcFace/FaceNet under the
   documented setup — it silently degrades to a 16×16 grayscale comparison.**
   Finding A-5, confirmed live in this pass. This is the system's headline
   anti-impersonation claim.

## Headline numbers (verified this pass, not asserted from a prior doc)

| Metric | Number | How verified |
|---|---|---|
| Backend tests, `features core shared` | **163/163 pass** | Live run: fresh Python 3.12 venv, `requirements-core.txt` + `requirements-cv.txt` |
| Backend `ai` tests | **0/4 execute** | `ModuleNotFoundError: pytest` — this suite has never run under the project's own test command |
| Total backend `def test_` across 19 files | **167** | Direct `grep -c` count, not the "140+"/"142" figures in other docs |
| Frontend unit tests | **32/33 pass** | Live run — 1 fails on CSV-header test drift (DEF-002) |
| Frontend type errors | **12, across 8 files** | This codebase has never had `typescript` installed as a dependency — this is its first-ever typecheck |
| Findings logged | **12 Group A/B (Critical/High priority), 7 Group C, 9 Group D, 7 Group E** | See `06-qa-findings.md` |
| Defects filed | **16**, in `05-defect-log.csv` | 6 map to Group A (integrity), 3 to Group C (verification gap), 5 to Group D (secrets/hygiene), 2 to Group C test-infra |
| Requirements traced | **44 rows**, `04-traceability-matrix.csv` | Every row's `claimed_status` was independently re-checked against code, not copied from `docs/todo` |

## What "verified" means in this folder

Every claim in `06-qa-findings.md` and `04-traceability-matrix.csv` was
confirmed by one of:
- reading the exact file:line cited, in this pass, and
- where practical, actually running the code (a fresh venv install, a live
  Python REPL call against `ai.adapter`/`IdentityVerifier`, the real test
  suites, a real `tsc` typecheck).

Nothing here is repeated from `README.md`, `REPOSITORY_GUIDE.md`, or
`docs/general/System_Consistency_Report_2026-09.md` without independent
confirmation — those documents are themselves shown to drift from the code in
both directions (over- *and* under-claiming; see finding B-5). That's the
whole reason this folder exists: **verification over assertion.**

## What this folder is *not*

Per scope agreed before starting: this is a QA/test-engineering workspace, not
a manuscript gap-tracker or a panel-defense slide deck. Pure writing tasks
(RRL citations, dataset methodology narrative, algorithm-comparison prose)
stay in `docs/todo` §5 and aren't duplicated here — except where they're also
testing deliverables (the load test) or claim-verification findings (the YOLO
and identity-backend findings), which are QA work by definition.

No application code was changed to produce this folder.
