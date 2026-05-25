# Test Case Evidence — LCC-OSAS Production (lcc-osas.com)

Captured: **2026-05-22**  
Environment: **Production** — https://lcc-osas.com  
Tester: Automated browser smoke + manual verification via Cursor IDE browser

## Folder structure

| Path | Contents |
|------|----------|
| `screenshots/` | PNG evidence mapped to WBS-* test case IDs |
| `logs/` | Execution logs, endpoint probes, Pest output |

## Screenshots index

| File | Test Case ID | Result | Description |
|------|--------------|--------|-------------|
| WBS-GEN-001_landing_page.png | WBS-GEN-001 | Pass | Public landing page loads |
| WBS-AUTH-001_login_portal.png | WBS-AUTH-001 | Pass | Institutional login page |
| WBS-AUTH-002_invalid_login_error.png | WBS-AUTH-002 | Pass | Invalid password shows error (no session) |
| WBS-AUTH-003_admin_login_dashboard.png | WBS-AUTH-001 / WBS-SEC | Pass | Admin redirected to dashboard |
| WBS-DSH-001_admin_dashboard.png | WBS-DSH-001 | Pass | Dashboard analytics (1110+ students, charts) |
| WBS-STU-002_admin_student_records.png | WBS-STU-001 | Pass | Student records table (paginated) |
| WBS-VIO-001_admin_violations.png | WBS-VIO-001 | Pass | Violation registry module |
| WBS-CON-002_admin_concerns.png | WBS-CON-002 | Pass | Admin concerns / help desk (resolved ticket visible) |
| WBS-ADM-001_admin_account_management.png | WBS-ADM-001 | Pass | Account directory (1115 users) |
| WBS-VAL-001_profile_validation.png | WBS-VAL-001 | Pass | Profile validation queue (pending/approved/rejected stats) |
| WBS-NOT-001_notifications_panel.png | WBS-NOT-001 | Pass | In-app notifications + Reverb (WebSocket 101) |
| WBS-STU-001_student_my_profile.png | WBS-STU (student) | Pass | Student my-profile (verified, BSIT) |
| WBS-CON-001_student_concerns_tab.png | WBS-CON-001 | Pass | Student concerns tab (empty state) |
| WBS-PROF-001_profiling_route_note.png | WBS-PROF-001 | **Fail** | Direct GET `/osas/student/profiling` returned **405** on production |

## Logs index

| File | Description |
|------|-------------|
| `test_execution_log_production_2026-05-22.txt` | Human-readable execution summary |
| `production_integration_network_2026-05-22.json` | Key XHR/WebSocket endpoints observed when admin session active |
| `production_public_endpoints_2026-05-22.json` | Unauthenticated endpoint probe |
| `pest-automated-test-log.txt` | Local `php artisan test` output (schema mismatch; not production) |

## Security note

Test accounts were provided for this run. **Do not commit passwords** to the repository. Rotate production passwords after thesis evidence collection.

## Related docs

- Chapter 7 text: `docs/generative_outputs/section_7_*.txt`
- Defect log template: `docs/testing(IEEE)/document-data/05_defect_bug_report_log.json`
- IEEE Doc 2 test cases: `docs/testing(IEEE)/document-data/02_test_cases_document.json`
