# OSAS WBSMS — Testing Documentation Pack

Structured testing artifacts for the **Web-Based Student Management System** (LCC-OSAS-SYSTEM), mirroring `docs/testing(unmodified)/` but adapted to the current Laravel + Inertia + React codebase.

## Folder layout

| Path | Purpose |
|------|---------|
| `requirements-data/` | Course templates, OSAS project context, UAT scenarios |
| `document-data/` | Source JSON for Docs 1, 2, 5, 6, 7, 8, 9 (IEEE test plan, cases, reports) |
| `results-data/` | Execution results, evidence paths, metrics (fill after testing) |
| `scripts/` | Bootstrap and sync helpers |
| `documents/` | Generated `.docx` / `.xlsx` (after running `generate_documents.py`) |

## Quick start

1. **Edit team metadata** in `document-data/manifest.json` and `requirements-data/04_osas_project_context.json` (group name, members).

2. **Regenerate content** (optional, if you change modules):
   ```bash
   python docs/testing/scripts/bootstrap_osas_content.py
   ```

3. **Run tests** and record results:
   - Automated: `php artisan test`
   - Manual / browser: institutional portal at `/osas/institutional-portal/login`
   - UAT: scenarios in `requirements-data/05_suggested_uat_scenarios_osas.json`

4. **Sync results** into document JSON:
   - Add rows to `EXEC`, `DETAILED`, `UAT_DATA` in `scripts/sync_results_to_document_data.py`
   - Or edit `results-data/*.json` directly
   ```bash
   python docs/testing/scripts/sync_results_to_document_data.py
   ```

5. **Generate Office files** (requires `python-docx`, `openpyxl`):
   ```bash
   pip install python-docx openpyxl
   python docs/testing/document-data/generate_documents.py
   ```

## Test case ID prefixes (Doc 2)

| Prefix | Module |
|--------|--------|
| `WBS-AUTH` | Login, logout, password reset |
| `WBS-PROF` | Student profiling |
| `WBS-VAL` | Profile validation (faculty / assistant) |
| `WBS-STU` | Student records |
| `WBS-VIO` | Violations |
| `WBS-CON` | Concerns |
| `WBS-DSH` | Dashboard & PDF reports |
| `WBS-NOT` | Notifications |
| `WBS-ADM` | Account management |
| `WBS-SEC` | RBAC / security |
| `WBS-GEN` | Landing, lookups, responsive UI |

## Related project docs

- Thesis Ch. 7–10 draft: `docs/overview/documents/OSAS_chapters_7_10_content.json`
- API reference: `docs/backend/API_structure.json`
- Routes: `routes/auth.php`, `routes/roles.php`, `routes/student.php`

## Difference from `testing(unmodified)/`

The unmodified folder targets **FrinStore** (Vue + FastAPI). This pack targets **OSAS WBSMS** (Laravel 12, Inertia, React, MySQL, Reverb) with modules aligned to OSAS operations.
