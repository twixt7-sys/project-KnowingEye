# Knowing Eye - IEEE Testing Pack

Structured testing artifacts for the **Knowing Eye** examination platform (Django + React + `backend/ai/knowing_eye`), adapted from the OSAS reference pack archived in [`misc/archive/osas-ieee-reference/`](../../../misc/archive/osas-ieee-reference/).

## Folder layout

| Path | Purpose |
|------|---------|
| `requirements-data/` | Project context, UAT scenarios, IEEE templates |
| `document-data/` | Source JSON for test plan, cases, reports |
| `results-data/` | Execution results and evidence paths |
| `scripts/` | Bootstrap and sync helpers |
| `documents/` | Generated `.docx` / `.xlsx` (after `generate_documents.py`) |

## Quick start

```bash
# 1. Generate Knowing Eye JSON (replaces OSAS placeholders)
python docs/testing/testing(IEEE)/scripts/bootstrap_knowing_eye_content.py

# 2. Run backend unit tests
cd backend
set DB_ENGINE=django.db.backends.sqlite3
python manage.py test

# 3. Sync results into document JSON (edit scripts/sync_results_to_document_data.py)
python docs/testing/testing(IEEE)/scripts/sync_results_to_document_data.py

# 4. Generate Office files (requires python-docx, openpyxl)
pip install python-docx openpyxl
python docs/testing/testing(IEEE)/document-data/generate_documents.py
```

## Test case ID prefixes (Doc 2)

| Prefix | Module |
|--------|--------|
| `KE-AUTH` | Login, JWT, RBAC |
| `KE-EXAM` | Exam & question CRUD |
| `KE-SESS` | Session start / submit / scoring |
| `KE-MON` | Frame upload, pipeline health |
| `KE-BEH` | Behavior logs & alerts |
| `KE-RPT` | Reports & dashboard API |
| `KE-GEN` | Landing, responsive UI |

## Related docs

- [`docs/general/Project.json`](../../general/Project.json)
- [`docs/general/Implementation_Status_Summary.md`](../../general/Implementation_Status_Summary.md)
- [`backend/ai/training/TRAINING.md`](../../../backend/ai/training/TRAINING.md)
- Frozen OSAS example: [`testing(IEEE)[reference]/`](../testing(IEEE)[reference]/)
