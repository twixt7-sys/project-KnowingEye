# Evidence

Screenshots, logs, and captured output supporting entries in
`03-test-cases.csv` and `05-defect-log.csv`.

## Naming convention

```
<test-case-or-defect-id>__<YYYY-MM-DD>__<pass|fail>.<ext>
```

Examples: `KE-SEC-001__2026-09-06__fail.png`, `DEF-004__2026-09-06__fail.log`.

Reference the file from the CSV `evidence` column as a relative path
(`evidence/KE-SEC-001__2026-09-06__fail.png`) so it stays a working link from
the repo root.

## What's already here

| File | Supports | What it shows |
|---|---|---|
| `tsc-output-2026-09-06.txt` | DEF-001, KE-GEN-004 | Full `tsc -b --noEmit` output — 12 real type errors, the first typecheck this codebase has ever had |
| `vitest-output-2026-09-06.txt` | DEF-002, KE-GEN-005 | `npm test -- --run` — 32 passed, 1 failed (CSV header drift) |
| `backend-tests-2026-09-06.log` | KE-GEN-001 and others | Full `manage.py test features core shared` run — 163/163 pass with `requirements-core.txt` + `requirements-cv.txt` installed |
| `pipeline-mode-2026-09-06.txt` | KE-MON-006, KE-MON-007, DEF-010 | Live confirmation that the CV pipeline reaches `production` mode but the identity backend falls back to `appearance` |

Screenshots for the manual checklists in `07-manual-checklists.md` (RBAC
matrix results, exam-lifecycle walk, monitoring walk) should be added here as
they're collected — none exist yet.
