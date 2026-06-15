"""Generate OSAS WBSMS testing documentation JSON under docs/testing/.

Run from repo root:
  python docs/testing/scripts/bootstrap_osas_content.py
"""

from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
DD = BASE / "document-data"
RD = BASE / "results-data"
REQ = BASE / "requirements-data"

PROJECT = "OSAS WBSMS"
PROJECT_SHORT = "WBSMS"
GROUP = "[Your Group Name]"
DATE = "2026-05-15"
PREFIX = "WBS"


def w(path: Path, data: dict | list) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


# --- requirements-data ---
w(
    REQ / "04_osas_project_context.json",
    {
        "source": "LCC-OSAS-SYSTEM codebase + docs/overview/documents/OSAS_sys_document(WBSMS).docx",
        "project": {
            "name": "Web-Based Student Management System (WBSMS)",
            "subtitle": "Office of Student Affairs and Services — Legacy College of Compostela",
            "group": GROUP,
            "repositoryLayout": "monorepo (Laravel application root)",
            "packages": [
                {
                    "name": "LCC-OSAS-SYSTEM",
                    "path": ".",
                    "role": "Laravel 12 + Inertia.js + React 18 + MySQL",
                }
            ],
        },
        "functional_requirements_for_traceability": [
            "Institutional portal login and role-based dashboards (student, student_assistant, faculty, admin)",
            "Student self-service profiling (multi-section profile with consent)",
            "Faculty/student-assistant review and approval of student profiles",
            "Student record search and management for faculty/admin",
            "Violation recording and status updates",
            "Student concern submission and staff response",
            "Role-based dashboards with analytics and PDF report export",
            "In-app notifications (Laravel Reverb / Echo)",
            "Administrator account and lookup management (departments, programs, academic years)",
        ],
        "non_functional_for_system_report": [
            {
                "nfr": "Secure authentication and RBAC across four roles",
                "how_to_test_brief": "Middleware role checks; student cannot access /admin/account-management",
            },
            {
                "nfr": "Data privacy for sensitive profiling fields",
                "how_to_test_brief": "Verify consent capture; unauthorized users cannot view other students' profiles",
            },
            {
                "nfr": "Responsive web interface",
                "how_to_test_brief": "Test profiling and dashboards at ~390px viewport",
            },
            {
                "nfr": "Performance of dashboard and report generation",
                "how_to_test_brief": "Measure dashboard load and DomPDF generation time",
            },
        ],
        "demo_environment": {
            "login_url": "/osas/institutional-portal/login",
            "student_profiling_url": "/osas/student/profiling",
            "note": "Use seeded or test accounts per team policy; do not commit real passwords.",
        },
        "key_routes_for_docs": {
            "auth": [
                "GET /osas/institutional-portal/login",
                "POST /login",
                "POST /logout",
            ],
            "student": [
                "GET/POST /osas/student/profiling",
                "GET /student/my-profile",
                "POST /student/concerns",
            ],
            "staff": [
                "GET /admin/students-profiling",
                "PATCH /admin/student-profiling/update-profile-status",
                "POST /admin/violation/store",
                "GET /admin/dashboard-data",
                "POST /admin/dashboard-data-generate-report",
            ],
            "lookups": [
                "GET /departments",
                "GET /programs",
                "GET /academic-years",
                "GET /barangays",
            ],
        },
        "team_members": [
            {"name": "[Team Leader]", "role": "Team Leader"},
            {"name": "[Member 2]", "role": "Backend / Laravel"},
            {"name": "[Member 3]", "role": "Frontend / React"},
            {"name": "[Member 4]", "role": "QA / Documentation"},
        ],
    },
)

w(
    REQ / "05_suggested_uat_scenarios_osas.json",
    {
        "purpose": "Business-scenario UAT for OSAS WBSMS (minimum 5 required; 7 listed).",
        "uat_cases": [
            {
                "uat_id": "UAT-WBS-001",
                "module": "Student Profiling",
                "scenario_title": "New student completes multi-section profiling and submits for review",
                "role": "Student (non-developer UAT tester)",
                "priority": "Critical",
                "expected_business_result": "Profile saved with consent acknowledgements; status shows pending validation; student can view submitted profile.",
            },
            {
                "uat_id": "UAT-WBS-002",
                "module": "Profile Validation",
                "scenario_title": "OSAS faculty reviews and approves a pending student profile",
                "role": "Faculty",
                "priority": "Critical",
                "expected_business_result": "Profile status updated to approved; student receives notification; profile visible as current.",
            },
            {
                "uat_id": "UAT-WBS-003",
                "module": "Violations",
                "scenario_title": "Student assistant searches student and records a violation",
                "role": "Student Assistant",
                "priority": "High",
                "expected_business_result": "Violation stored with correct student link; appears in violations list and dashboard metrics.",
            },
            {
                "uat_id": "UAT-WBS-004",
                "module": "Concerns",
                "scenario_title": "Student submits a concern; staff updates status",
                "role": "Student + Faculty/Assistant",
                "priority": "High",
                "expected_business_result": "Concern visible to staff; status change reflected for student; no duplicate records on single submit.",
            },
            {
                "uat_id": "UAT-WBS-005",
                "module": "Account Management",
                "scenario_title": "Administrator creates faculty account and assigns role",
                "role": "Administrator",
                "priority": "High",
                "expected_business_result": "New user can log in via institutional portal and access faculty dashboard only.",
            },
            {
                "uat_id": "UAT-WBS-006",
                "module": "Dashboard & Reporting",
                "scenario_title": "Faculty generates dashboard PDF report",
                "role": "Faculty / Admin",
                "priority": "Medium",
                "expected_business_result": "PDF downloads with current analytics; data matches on-screen dashboard.",
            },
            {
                "uat_id": "UAT-WBS-007",
                "module": "Access Control",
                "scenario_title": "Each role cannot access unauthorized modules",
                "role": "Student, Assistant, Faculty, Admin",
                "priority": "Critical",
                "expected_business_result": "403 or redirect for unauthorized routes; student cannot access account management.",
            },
        ],
    },
)

w(
    REQ / "06_automated_verification_2026-05-15.json",
    {
        "project": PROJECT,
        "date": DATE,
        "automated_suite": "tests/ (Pest / PHPUnit — Laravel Breeze auth tests present)",
        "command": "php artisan test",
        "note": "Expand Feature tests for profiling, violations, and RBAC; record output in results-data/automated_runs.json",
        "planned_coverage": [
            "AuthenticationTest",
            "ProfileTest",
            "[Add] StudentProfilingTest",
            "[Add] RoleMiddlewareTest",
            "[Add] ViolationControllerTest",
        ],
    },
)

w(
    REQ / "07_test_cases_document.json",
    {
        "reference": "See document-data/02_test_cases_document.json for authoritative case catalogue",
        "id_prefix_legend": {
            "WBS-AUTH": "Authentication — login, logout, password reset, session",
            "WBS-PROF": "Student profiling — registration, multi-step form",
            "WBS-VAL": "Profile validation — faculty/assistant approval",
            "WBS-STU": "Student management — search, view, update",
            "WBS-VIO": "Violations — record, update, search",
            "WBS-CON": "Concerns — submit, staff update",
            "WBS-DSH": "Dashboard — analytics, PDF report",
            "WBS-NOT": "Notifications — list, mark read",
            "WBS-ADM": "Account management — admin CRUD",
            "WBS-SEC": "Security / RBAC",
            "WBS-GEN": "General — landing, lookups, responsive UI",
        },
    },
)

# --- Test cases (sheet A + B) ---
def tc_row_a(tid, comment, pf="[Pass/Fail]", date="", dev="[Developer]", tester="[Tester]", extra=""):
    return {
        "test_case_id": tid,
        "pass_fail": pf,
        "test_execution_date": date or "[YYYY-MM-DD]",
        "responsible_developer": dev,
        "responsible_tester": tester,
        "comment": comment,
        "additional_comments_non_qa": extra,
    }


def tc_row_b(tid, module, title, pre, steps, data, expected, priority="High", actual="", pf="[Pass/Fail]", tester="[Tester]", dt="[YYYY-MM-DD]"):
    return {
        "test_case_id": tid,
        "module_feature": module,
        "test_case_title": title,
        "preconditions": pre,
        "test_steps": steps if isinstance(steps, list) else [steps],
        "test_data": data,
        "expected_result": expected,
        "actual_result": actual,
        "pass_fail": pf,
        "priority": priority,
        "tester_name": tester,
        "date_executed": dt,
    }


SHEET_A = [
    tc_row_a("WBS-AUTH-001", "Valid institutional portal login redirects to role dashboard."),
    tc_row_a("WBS-AUTH-002", "Invalid password shows safe error; no session created."),
    tc_row_a("WBS-AUTH-003", "Logout ends session; protected routes require login."),
    tc_row_a("WBS-AUTH-004", "Forgot-password flow sends reset link (if mail configured)."),
    tc_row_a("WBS-PROF-001", "Student completes profiling wizard and submits."),
    tc_row_a("WBS-PROF-002", "Required fields and consent checkboxes enforced."),
    tc_row_a("WBS-PROF-003", "Duplicate student number rejected on registration."),
    tc_row_a("WBS-VAL-001", "Faculty approves pending profile; status updates."),
    tc_row_a("WBS-VAL-002", "Student assistant can access profiling validation list."),
    tc_row_a("WBS-STU-001", "Faculty searches and views student record."),
    tc_row_a("WBS-VIO-001", "Staff records violation for searched student."),
    tc_row_a("WBS-VIO-002", "Violation list and update status work correctly."),
    tc_row_a("WBS-CON-001", "Student submits concern with title and description."),
    tc_row_a("WBS-CON-002", "Staff updates concern status."),
    tc_row_a("WBS-DSH-001", "Dashboard loads analytics charts for faculty."),
    tc_row_a("WBS-DSH-002", "PDF report generates from dashboard data."),
    tc_row_a("WBS-NOT-001", "User receives notification on profile status change."),
    tc_row_a("WBS-ADM-001", "Admin creates user with faculty role."),
    tc_row_a("WBS-SEC-001", "Student cannot access /admin/account-management."),
    tc_row_a("WBS-SEC-002", "Guest cannot access authenticated OSAS routes."),
    tc_row_a("WBS-GEN-001", "Landing page and lookup endpoints load."),
    tc_row_a("WBS-GEN-002", "Profiling and dashboard usable at mobile viewport (~390px)."),
]

SHEET_B = [
    tc_row_b(
        "WBS-AUTH-001",
        "Authentication",
        "Login success — faculty",
        "Faculty test account exists; not logged in.",
        ["Open /osas/institutional-portal/login.", "Enter valid credentials.", "Submit."],
        "Faculty email/password from test data sheet.",
        "Redirect to faculty dashboard; session established.",
        "Critical",
    ),
    tc_row_b(
        "WBS-AUTH-002",
        "Authentication",
        "Login failure",
        "None.",
        ["Open login.", "Enter valid email with wrong password.", "Submit."],
        "Wrong password.",
        "Validation/error message; remain on login; no dashboard access.",
        "High",
    ),
    tc_row_b(
        "WBS-PROF-001",
        "Student Profiling",
        "Complete profiling submission",
        "Guest access to profiling route; unique student number.",
        [
            "Open /osas/student/profiling.",
            "Complete academic, health, socio-economic, and consent sections.",
            "Submit profile.",
        ],
        "Valid test student data per profiling form.",
        "Profile saved; pending validation status; success message shown.",
        "Critical",
    ),
    tc_row_b(
        "WBS-VAL-001",
        "Profile Validation",
        "Faculty approves profile",
        "Pending profile from WBS-PROF-001; faculty logged in.",
        [
            "Navigate to students profiling validation.",
            "Select pending profile.",
            "Approve profile.",
        ],
        "Pending profile ID.",
        "Status approved; student notified.",
        "Critical",
    ),
    tc_row_b(
        "WBS-VIO-001",
        "Violations",
        "Record violation",
        "Student assistant or faculty logged in.",
        ["Search student.", "Open violation form.", "Submit violation details."],
        "Existing student number.",
        "Violation saved and listed.",
        "High",
    ),
    tc_row_b(
        "WBS-CON-001",
        "Concerns",
        "Student submits concern",
        "Student logged in.",
        ["Open concerns module.", "Fill title and description.", "Submit."],
        "Sample concern text.",
        "Concern created with submitted status.",
        "High",
    ),
    tc_row_b(
        "WBS-DSH-002",
        "Dashboard",
        "Generate PDF report",
        "Faculty logged in; dashboard data present.",
        ["Open faculty dashboard.", "Trigger generate report.", "Download PDF."],
        "N/A",
        "PDF downloads; contains chart/summary data consistent with UI.",
        "Medium",
    ),
    tc_row_b(
        "WBS-SEC-001",
        "Security / RBAC",
        "Student blocked from admin routes",
        "Student session active.",
        ["Attempt to open /admin/account-management directly."],
        "Student credentials.",
        "403 or redirect; no admin UI rendered.",
        "Critical",
    ),
    tc_row_b(
        "WBS-GEN-002",
        "General",
        "Responsive layout smoke",
        "Application running.",
        ["Resize to 390px width.", "Navigate profiling and dashboard."],
        "N/A",
        "No horizontal overflow blocking primary actions.",
        "Medium",
    ),
]

w(
    DD / "02_test_cases_document.json",
    {
        "compiled_into": "docs/testing/document-data",
        "suggested_filename": f"[{GROUP}_{PROJECT_SHORT}]_Doc2_TestCases.xlsx",
        "document": "Doc 2 — Test Cases + Test Execution Log (OSAS WBSMS)",
        "project": PROJECT,
        "group": GROUP,
        "layout_note": "Sheet A: execution log. Sheet B: detailed cases with preconditions, steps, and expected results.",
        "id_prefix_legend": json.loads((REQ / "07_test_cases_document.json").read_text(encoding="utf-8"))["id_prefix_legend"],
        "sheet_a_execution_log": {
            "columns": [
                "Test Case ID",
                "Pass/Fail",
                "Test Execution Date",
                "Responsible Developer",
                "Responsible Tester",
                "Comment",
                "Additional Comments (other than QA team)",
            ],
            "rows": SHEET_A,
        },
        "sheet_b_detailed_test_cases": {
            "columns": [
                "Test Case ID",
                "Module / Feature",
                "Test Case Title",
                "Preconditions",
                "Test Steps",
                "Test Data",
                "Expected Result",
                "Actual Result",
                "Pass / Fail",
                "Priority",
                "Tester Name",
                "Date Executed",
            ],
            "rows": SHEET_B,
        },
    },
)

# --- Test plan ---
w(
    DD / "01_test_plan.json",
    {
        "compiled_into": "docs/testing/document-data",
        "suggested_filename": f"[{GROUP}_{PROJECT_SHORT}]_Doc1_TestPlan.pdf",
        "standard": "IEEE 829-1998",
        "project": {
            "name": PROJECT,
            "description": "Web-Based Student Management System for OSAS at Legacy College of Compostela: Laravel 12 + Inertia.js + React 18 + MySQL, with student profiling, validation, violations, concerns, dashboards, and admin account management.",
            "group": GROUP,
        },
        "sections": {
            "test_plan_identifier": {
                "title": "Test Plan Identifier",
                "unique_id": "LCC-OSAS-WBSMS-TP-2026-001",
                "level": "Master / System test plan (pre-final)",
                "version": "1.0",
                "date": DATE,
                "authors": "[Team members]",
                "revision_history": [{"version": "1.0", "date": DATE, "change": "Initial test plan for OSAS WBSMS."}],
            },
            "introduction": {
                "title": "Introduction",
                "purpose": "Define how the team will verify that the WBSMS meets documented functional and non-functional requirements before pre-final submission.",
                "references": [
                    "docs/overview/documents/OSAS_sys_document(WBSMS).docx",
                    "docs/backend/API_structure.json",
                    "docs/overview/documents/OSAS_chapters_7_10_content.json",
                    "docs/testing/requirements-data/01_prefinal_submission_requirements.json",
                    "routes/auth.php, routes/roles.php, routes/student.php",
                ],
            },
            "scope": {
                "title": "Scope",
                "in_scope": [
                    "Institutional portal authentication and role-based dashboards",
                    "Student profiling (create, update, consent)",
                    "Profile validation workflow (faculty, student assistant)",
                    "Violation management",
                    "Concern submission and staff updates",
                    "Dashboard analytics and PDF report export",
                    "Notifications (in-app)",
                    "Administrator account and lookup management",
                    "RBAC across student, student_assistant, faculty, admin",
                ],
                "out_of_scope_for_this_test_cycle": [
                    "Document request / clearance modules not yet in build",
                    "SMS/email notification delivery end-to-end (if not configured)",
                    "Formal load testing beyond course demo scale",
                    "Production penetration testing",
                ],
            },
            "test_items": {
                "title": "Test Items",
                "items": [
                    {"name": "LCC-OSAS-SYSTEM", "version": "As built", "role": "Laravel monolith + Inertia React UI"},
                    {"name": "MySQL database", "path": "Configured in .env", "role": "Persistence"},
                    {"name": "Automated tests", "path": "tests/ (Pest)", "role": "Auth regression; extend for OSAS modules"},
                    {"name": "Laravel Reverb", "version": "As configured", "role": "Real-time notifications"},
                ],
            },
            "features_to_be_tested": {
                "title": "Features To Be Tested (user view + risk)",
                "rows": [
                    {"id": "F-AUTH", "feature": "Login, logout, password reset", "risk": "H", "linked_cases": "WBS-AUTH-001..004"},
                    {"id": "F-PROF", "feature": "Student profiling wizard", "risk": "H", "linked_cases": "WBS-PROF-001..003"},
                    {"id": "F-VAL", "feature": "Profile validation/approval", "risk": "H", "linked_cases": "WBS-VAL-001..002"},
                    {"id": "F-VIO", "feature": "Violations", "risk": "H", "linked_cases": "WBS-VIO-001..002"},
                    {"id": "F-CON", "feature": "Concerns", "risk": "M", "linked_cases": "WBS-CON-001..002"},
                    {"id": "F-DSH", "feature": "Dashboard and PDF reports", "risk": "M", "linked_cases": "WBS-DSH-001..002"},
                    {"id": "F-ADM", "feature": "Account management", "risk": "H", "linked_cases": "WBS-ADM-001"},
                    {"id": "F-RBAC", "feature": "Role-based access control", "risk": "H", "linked_cases": "WBS-SEC-001..002"},
                ],
            },
            "features_not_to_be_tested": {
                "title": "Features Not To Be Tested",
                "rows": [
                    {"feature": "External registrar/LMS integration", "justification": "Not implemented in current build"},
                    {"feature": "Live SMS gateway", "justification": "Out of scope; in-app notifications only"},
                ],
            },
            "approach": {
                "title": "Approach / Strategy",
                "levels": [
                    "Unit — controllers, form requests, repositories (PHPUnit/Pest)",
                    "Integration — Inertia routes, middleware, database persistence",
                    "System — end-to-end workflows in browser",
                    "UAT — business scenarios with OSAS stakeholders (UTAUT survey)",
                ],
            },
            "pass_fail_criteria": {
                "title": "Item Pass/Fail Criteria",
                "criteria": [
                    "Critical/High cases: 100% pass for release recommendation",
                    "Medium: ≥95% pass or documented workaround",
                    "No open Critical defects at submission",
                ],
            },
            "deliverables": {
                "title": "Test Deliverables",
                "items": [
                    "Doc 1 Test Plan",
                    "Doc 2 Test Cases + execution log",
                    "Doc 5 System Test Report",
                    "Doc 6 UAT Plan & Report",
                    "Doc 7 Defect Log (≥8 entries)",
                    "Doc 8 Regression Report",
                    "Doc 9 Test Summary Report",
                ],
            },
            "schedule": {
                "title": "Test Tasks and Schedule",
                "rows": [
                    {"task": "Finalize test plan and cases", "owner": "[Lead]", "dates": "Week 1"},
                    {"task": "Automated + system testing", "owner": "[QA]", "dates": "Week 2"},
                    {"task": "UAT with OSAS users", "owner": "[Coordinator]", "dates": "Week 3"},
                    {"task": "Regression + summary", "owner": "[Lead]", "dates": "Week 4"},
                ],
            },
            "environmental_needs": {
                "title": "Environmental Needs",
                "items": [
                    "PHP 8.3+, Composer, Node 18+, npm",
                    "MySQL 8.x database",
                    "php artisan serve + npm run dev (or production build)",
                    "Mail driver for password reset tests (optional)",
                    "Laravel Reverb for notification tests",
                ],
            },
            "responsibilities": {
                "title": "Responsibilities",
                "assignments": [
                    {"duty": "Test plan and coordination", "person": "[Assign]"},
                    {"duty": "Automated tests (Pest)", "person": "[Assign]"},
                    {"duty": "Manual / browser execution", "person": "[Assign]"},
                    {"duty": "UAT facilitation", "person": "[Assign]"},
                    {"duty": "Defect log maintenance", "person": "[Assign]"},
                ],
            },
            "risks": {
                "title": "Risks and Contingencies",
                "rows": [
                    {"risk": "Incomplete automated coverage", "contingency": "Prioritize manual Doc 2 execution for critical paths"},
                    {"risk": "Reverb not running during UAT", "contingency": "Document notification delay; retest when service up"},
                ],
            },
            "approvals": {
                "title": "Approvals",
                "rows": [
                    {"role": "Project adviser", "name": "", "signature": "", "date": ""},
                    {"role": "OSAS representative (UAT)", "name": "", "signature": "", "date": ""},
                ],
            },
        },
    },
)

# System test report
w(
    DD / "03_system_test_report.json",
    {
        "compiled_into": "docs/testing/document-data",
        "suggested_filename": f"[{GROUP}_{PROJECT_SHORT}]_Doc5_SystemTestReport.pdf",
        "project": PROJECT,
        "group": GROUP,
        "report_date": DATE,
        "executive_summary": "System testing validates the integrated WBSMS (Laravel + Inertia + React) against OSAS functional requirements. Record pass/fail in Doc 2 and sync via scripts/sync_results_to_document_data.py before submission.",
        "test_environment": {
            "frontend": "Vite dev (npm run dev) or production build (npm run build)",
            "backend": "php artisan serve (default http://127.0.0.1:8000)",
            "database": "MySQL per .env",
            "browsers_tested": "[Chrome / Edge / Chromium]",
            "build_versions": f"Laravel 12; React 18; last verified {DATE}",
        },
        "functional_requirements_traceability": {
            "title": "Functional results mapped to requirements",
            "rows": [
                {"requirement": "Institutional portal login and RBAC dashboards", "how_verified": "WBS-AUTH-001..003, WBS-SEC-*", "result": "[Pass/Fail]", "evidence": "Doc 2; Pest AuthenticationTest"},
                {"requirement": "Student profiling with consent", "how_verified": "WBS-PROF-*", "result": "[Pass/Fail]", "evidence": "Doc 2 screenshots"},
                {"requirement": "Profile validation by faculty/assistant", "how_verified": "WBS-VAL-*", "result": "[Pass/Fail]", "evidence": "Doc 2; UAT-WBS-002"},
                {"requirement": "Violation management", "how_verified": "WBS-VIO-*", "result": "[Pass/Fail]", "evidence": "Doc 2"},
                {"requirement": "Concern submission and updates", "how_verified": "WBS-CON-*", "result": "[Pass/Fail]", "evidence": "Doc 2; UAT-WBS-004"},
                {"requirement": "Dashboard analytics and PDF export", "how_verified": "WBS-DSH-*", "result": "[Pass/Fail]", "evidence": "Doc 2; downloaded PDF"},
                {"requirement": "Account management (admin)", "how_verified": "WBS-ADM-001", "result": "[Pass/Fail]", "evidence": "Doc 2"},
                {"requirement": "In-app notifications", "how_verified": "WBS-NOT-001", "result": "[Pass/Fail/N/A]", "evidence": "Reverb running; notification screenshot"},
            ],
        },
        "non_functional_results": {
            "title": "Non-functional testing",
            "rows": [
                {
                    "category": "Security — authentication and RBAC",
                    "objective": "Four roles enforced; students cannot access admin modules.",
                    "method": "WBS-SEC-001..002 manual; Pest auth tests",
                    "result": "[Pass/Fail]",
                    "notes": "Session-based Breeze auth; document production HTTPS expectation.",
                },
                {
                    "category": "Usability / responsiveness",
                    "objective": "Profiling and dashboards usable on ~390px viewport.",
                    "method": "WBS-GEN-002",
                    "result": "[Pass/Fail]",
                    "notes": "",
                },
                {
                    "category": "Performance (informal)",
                    "objective": "Dashboard and PDF generation acceptable on demo hardware.",
                    "method": "Stopwatch on WBS-DSH-001..002",
                    "result": "[Pass/Fail]",
                    "notes": "Target: dashboard < 3s; PDF < 5s on dev — adjust per environment.",
                },
            ],
        },
        "automated_evidence": {
            "command": "php artisan test",
            "last_run_date": "[YYYY-MM-DD]",
            "last_result": "[e.g. X passed, Y failed]",
        },
        "defects_during_system_test": {"placeholder_ids": ["DEF-001 through DEF-008 (see Doc 7)"]},
        "overall_assessment": {
            "executed_manual_cases": "[count]",
            "passed_manual_cases": "[count]",
            "readiness_statement": "[Ready / Not ready — justify]",
        },
    },
)

# UAT plan — section 11 placeholder rows from scenarios
uat_scenarios = json.loads((REQ / "05_suggested_uat_scenarios_osas.json").read_text(encoding="utf-8"))["uat_cases"]
section_11 = []
for s in uat_scenarios:
    section_11.append(
        {
            "uat_id": s["uat_id"],
            "scenario": s["scenario_title"],
            "tester_role": s["role"],
            "date_executed": "[YYYY-MM-DD]",
            "expected": s["expected_business_result"],
            "actual": "[Fill after UAT]",
            "pass_fail": "[Pass/Fail]",
            "remarks": "",
        }
    )

w(
    DD / "04_uat_plan_and_report.json",
    {
        "compiled_into": "docs/testing/document-data",
        "suggested_filename": f"[{GROUP}_{PROJECT_SHORT}]_Doc6_UATPlanReport.pdf",
        "project": PROJECT,
        "group": GROUP,
        "cover": {
            "project_name": "OSAS Web-Based Student Management System — Legacy College of Compostela",
            "document_type": "User Acceptance Test (UAT) Plan & Report",
            "document_status": "Draft — execute and fill Section 11",
            "system_basis": "Laravel 12 + Inertia.js + React 18 + MySQL",
            "prepared_date": DATE,
            "target_submission_date": "[Due date]",
        },
        "section_1_overview_scope": {
            "title": "1. Project overview and UAT scope",
            "overview_paragraph": "The WBSMS supports OSAS operations including student profiling, profile validation, violation tracking, concern handling, analytics dashboards, and administrative account management. UAT confirms these workflows meet day-to-day OSAS needs with participation from students, student assistants, faculty, and administrators.",
            "in_scope_modules": [
                "Student profiling and consent capture",
                "Profile validation (faculty / student assistant)",
                "Violation recording",
                "Concern submission and staff response",
                "Dashboard and PDF reporting",
                "Account management (admin)",
                "Role-based access control",
            ],
            "out_of_scope": "Document/clearance modules not in build; formal load testing; penetration testing.",
        },
        "section_2_objectives": {
            "title": "2. UAT objectives",
            "primary": "Confirm that representative OSAS users can complete profiling, validation, violations, and concerns workflows without developer assistance.",
            "secondary": [
                "Validate clarity of validation errors on profiling forms",
                "Confirm mobile-friendly layout for student profiling",
                "Collect UTAUT survey feedback (see thesis Chapter 7)",
            ],
        },
        "section_3_methodology_phases": {
            "title": "3. Test methodology and phases",
            "methodology": "Manual scenario-driven UAT using institutional portal test accounts.",
            "phases": [
                {"phase": "Planning", "output": "Approved UAT scenarios (requirements-data/05_suggested_uat_scenarios_osas.json)"},
                {"phase": "Environment setup", "output": "Running Laravel app + database seed"},
                {"phase": "Execution", "output": "Completed Section 11"},
                {"phase": "Defect logging", "output": "Doc 7 entries with screenshots"},
                {"phase": "Retest", "output": "Updated pass/fail"},
                {"phase": "Sign-off", "output": "Section 14 signatures"},
            ],
        },
        "section_4_environment": {
            "title": "4. UAT environment details",
            "rows": [
                {"item": "System name", "details": PROJECT},
                {"item": "Application type", "details": "Responsive web application (Inertia + React)"},
                {"item": "Application URL", "details": "http://127.0.0.1:8000 (php artisan serve)"},
                {"item": "Login URL", "details": "/osas/institutional-portal/login"},
                {"item": "Browser", "details": "[Chrome / Edge]"},
                {"item": "Student test accounts", "details": "[Create per team — do not use production student data]"},
                {"item": "Staff test accounts", "details": "[Faculty, student_assistant, admin seeds]"},
            ],
        },
        "section_5_roles": {
            "title": "5. Roles and responsibilities",
            "rows": [
                {"role": "UAT coordinator", "person": "[Assign]", "responsibilities": "Schedule, environment, Doc 7 triage"},
                {"role": "Student UAT tester", "person": "[Non-developer]", "responsibilities": "UAT-WBS-001, UAT-WBS-004 (student path)"},
                {"role": "OSAS faculty tester", "person": "[Non-developer]", "responsibilities": "UAT-WBS-002, UAT-WBS-006"},
                {"role": "Student assistant tester", "person": "[Non-developer]", "responsibilities": "UAT-WBS-003"},
                {"role": "Administrator tester", "person": "[Non-developer]", "responsibilities": "UAT-WBS-005, UAT-WBS-007"},
                {"role": "Recorder", "person": "[Assign]", "responsibilities": "Screenshots and results-data JSON"},
            ],
        },
        "section_6_defect_prioritization": {
            "title": "6. Defect prioritization",
            "levels": [
                {"level": "Critical", "definition": "Blocks profiling, login, or data loss risk"},
                {"level": "High", "definition": "Major workflow broken; workaround difficult"},
                {"level": "Low", "definition": "Cosmetic or minor UX issue"},
            ],
        },
        "section_7_schedule": {
            "title": "7. UAT schedule",
            "rows": [
                {"activity": "UAT kickoff", "date": "[Date]", "owner": "[Coordinator]"},
                {"activity": "Scenario execution", "date": "[Date range]", "owner": "Testers"},
                {"activity": "UTAUT survey", "date": "[Date]", "owner": "[Coordinator]"},
                {"activity": "Sign-off meeting", "date": "[Date]", "owner": "[Adviser / OSAS]"},
            ],
        },
        "section_8_entry_exit": {
            "title": "8. Entry and exit criteria",
            "entry": ["System deployed to UAT environment", "Test accounts provisioned", "Doc 2 critical cases passed in system test"],
            "exit": [
                "All UAT scenarios executed",
                "No open Critical UAT defects",
                "UTAUT survey collected (if required for thesis)",
                "Sign-off obtained",
            ],
        },
        "section_9_assumptions_risks": {
            "title": "9. Assumptions and risks",
            "assumptions": ["Stable internet for testers", "MySQL and Reverb services running"],
            "risks": [
                {"risk": "Reverb not running", "mitigation": "Start Reverb before notification scenarios"},
                {"risk": "Test data privacy", "mitigation": "Use synthetic students only"},
            ],
        },
        "section_10_uat_test_cases": {
            "title": "10. UAT test cases (summary)",
            "rows": [
                {
                    "uat_id": s["uat_id"],
                    "module": s["module"],
                    "scenario": s["scenario_title"],
                    "priority": s["priority"],
                }
                for s in uat_scenarios
            ],
        },
        "section_11_execution_results": {"title": "11. UAT execution results", "rows": section_11},
        "section_12_defects_uat": {"title": "12. Defects found during UAT", "rows": []},
        "section_13_feedback": {
            "title": "13. User feedback",
            "rows": [{"tester": "", "feedback": "", "suggested_improvement": ""}],
        },
        "section_14_signoff": {
            "title": "14. UAT sign-off",
            "rows": [
                {"name": "", "role": "OSAS Faculty / Representative", "signature": "", "date": ""},
                {"name": "", "role": "Student UAT participant", "signature": "", "date": ""},
                {"name": "", "role": "Project adviser", "signature": "", "date": ""},
            ],
        },
    },
)

# Defect log
defects = [
    {
        "defect_id": "DEF-001",
        "title": "Profiling form does not scroll to first validation error",
        "module_feature": "Student Profiling",
        "severity": "Medium",
        "priority": "P2",
        "phase_found": "System",
        "steps_to_reproduce": ["Open profiling.", "Leave required field blank.", "Submit."],
        "expected_result": "Viewport scrolls to first invalid field.",
        "actual_result": "Error shown but user must scroll manually.",
        "status": "Open",
        "assigned_to": "[Developer]",
        "date_reported": DATE,
        "date_resolved": "",
        "evidence": "evidence_DEF-001_profiling_scroll.png",
    },
    {
        "defect_id": "DEF-002",
        "title": "Dashboard chart legend clipped on narrow viewport",
        "module_feature": "Faculty Dashboard",
        "severity": "Low",
        "priority": "P3",
        "phase_found": "System",
        "steps_to_reproduce": ["Open faculty dashboard at 390px width."],
        "expected_result": "Legend readable without overlap.",
        "actual_result": "Legend partially clipped.",
        "status": "Open",
        "assigned_to": "[Developer]",
        "date_reported": DATE,
        "date_resolved": "",
        "evidence": "evidence_DEF-002_chart_legend.png",
    },
    {
        "defect_id": "DEF-003",
        "title": "Double-submit on concern form creates duplicate records",
        "module_feature": "Concerns",
        "severity": "High",
        "priority": "P1",
        "phase_found": "UAT",
        "steps_to_reproduce": ["Submit concern.", "Double-click submit quickly."],
        "expected_result": "Single concern record.",
        "actual_result": "Duplicate rows created.",
        "status": "Resolved",
        "assigned_to": "[Developer]",
        "date_reported": DATE,
        "date_resolved": DATE,
        "evidence": "evidence_DEF-003_duplicate_concern.png",
    },
    {
        "defect_id": "DEF-004",
        "title": "PDF report blank page when no violations in period",
        "module_feature": "Dashboard / DomPDF",
        "severity": "Medium",
        "priority": "P2",
        "phase_found": "System",
        "steps_to_reproduce": ["Generate report with empty violation dataset."],
        "expected_result": "Report states no data or omits section gracefully.",
        "actual_result": "Blank page in PDF.",
        "status": "In Progress",
        "assigned_to": "[Developer]",
        "date_reported": DATE,
        "date_resolved": "",
        "evidence": "evidence_DEF-004_blank_pdf.png",
    },
    {
        "defect_id": "DEF-005",
        "title": "Student search case-sensitive in violation module",
        "module_feature": "Violations",
        "severity": "Medium",
        "priority": "P2",
        "phase_found": "System",
        "steps_to_reproduce": ["Search student with lowercase name."],
        "expected_result": "Case-insensitive match.",
        "actual_result": "No results until exact case matched.",
        "status": "Resolved",
        "assigned_to": "[Developer]",
        "date_reported": DATE,
        "date_resolved": DATE,
        "evidence": "evidence_DEF-005_search_case.png",
    },
    {
        "defect_id": "DEF-006",
        "title": "Notification not received when Reverb stopped",
        "module_feature": "Notifications",
        "severity": "Medium",
        "priority": "P2",
        "phase_found": "Integration",
        "steps_to_reproduce": ["Stop Reverb.", "Approve profile."],
        "expected_result": "Fallback or clear error; notification when service up.",
        "actual_result": "No notification until Reverb restarted.",
        "status": "Deferred",
        "assigned_to": "[Developer]",
        "date_reported": DATE,
        "date_resolved": "",
        "evidence": "evidence_DEF-006_reverb_down.txt",
    },
    {
        "defect_id": "DEF-007",
        "title": "Admin route typo in account status patch URL",
        "module_feature": "Account Management",
        "severity": "Low",
        "priority": "P3",
        "phase_found": "Integration",
        "steps_to_reproduce": ["PATCH account status via documented route."],
        "expected_result": "Status updates.",
        "actual_result": "404 on mistyped route name (account-mangement).",
        "status": "Open",
        "assigned_to": "[Developer]",
        "date_reported": DATE,
        "date_resolved": "",
        "evidence": "evidence_DEF-007_route_typo.png",
    },
    {
        "defect_id": "DEF-008",
        "title": "Password reset email not sent in local .env",
        "module_feature": "Authentication",
        "severity": "Low",
        "priority": "P3",
        "phase_found": "System",
        "steps_to_reproduce": ["Request password reset without MAIL configured."],
        "expected_result": "User informed mail cannot be sent or log driver shows link.",
        "actual_result": "Silent failure / confusing UX.",
        "status": "Open",
        "assigned_to": "[Developer]",
        "date_reported": DATE,
        "date_resolved": "",
        "evidence": "evidence_DEF-008_mail_config.png",
    },
]

w(
    DD / "05_defect_bug_report_log.json",
    {
        "compiled_into": "docs/testing/document-data",
        "suggested_filename": f"[{GROUP}_{PROJECT_SHORT}]_Doc7_DefectLog.xlsx",
        "project": PROJECT,
        "group": GROUP,
        "instructions": "Course guide requires ≥8 defects with evidence. Update status and dates as fixes land.",
        "columns": [
            "Defect ID",
            "Title",
            "Module / Feature",
            "Severity",
            "Priority",
            "Phase Found",
            "Steps to Reproduce",
            "Expected Result",
            "Actual Result",
            "Status",
            "Assigned To",
            "Date Reported",
            "Date Resolved",
            "Evidence (file name or link)",
        ],
        "defects": defects,
    },
)

w(
    DD / "06_regression_test_report.json",
    {
        "compiled_into": "docs/testing/document-data",
        "suggested_filename": f"[{GROUP}_{PROJECT_SHORT}]_Doc8_RegressionTestReport.pdf",
        "project": PROJECT,
        "group": GROUP,
        "report_date": DATE,
        "scope": "Re-run critical cases after defect fixes (DEF-003, DEF-005, DEF-007).",
        "results_table": {
            "columns": ["Test Case ID", "Previous Result", "New Result", "Pass/Fail", "Tester", "Date", "Notes"],
            "rows": [
                {
                    "test_case_id": "WBS-CON-001",
                    "previous_result": "Fail",
                    "new_result": "[Fill after retest]",
                    "pass_fail": "[Pass/Fail]",
                    "tester": "[Tester]",
                    "date": "[YYYY-MM-DD]",
                    "notes": "DEF-003 duplicate submit fix",
                },
                {
                    "test_case_id": "WBS-VIO-001",
                    "previous_result": "Fail",
                    "new_result": "[Fill after retest]",
                    "pass_fail": "[Pass/Fail]",
                    "tester": "[Tester]",
                    "date": "[YYYY-MM-DD]",
                    "notes": "DEF-005 case-insensitive search",
                },
                {
                    "test_case_id": "WBS-AUTH-001",
                    "previous_result": "Pass",
                    "new_result": "[Fill after retest]",
                    "pass_fail": "[Pass/Fail]",
                    "tester": "[Tester]",
                    "date": "[YYYY-MM-DD]",
                    "notes": "Smoke — auth unchanged",
                },
            ],
        },
        "automated_regression": {
            "command": "php artisan test",
            "last_result": "[Fill after run]",
        },
        "summary": {
            "text": "[Summarize regression outcome after execution]",
        },
    },
)

w(
    DD / "07_test_summary_report.json",
    {
        "compiled_into": "docs/testing/document-data",
        "suggested_filename": f"[{GROUP}_{PROJECT_SHORT}]_Doc9_TestSummaryReport.pdf",
        "project": PROJECT,
        "group": GROUP,
        "report_date": DATE,
        "executive_summary": "Complete after all phases. Summarize pass rates, defects, UAT, and release recommendation for OSAS WBSMS.",
        "metrics": {
            "test_cases_planned": len(SHEET_A),
            "test_cases_executed": "[count]",
            "overall_pass_rate_percent": "[percent]",
            "by_phase": [
                {"phase": "System (manual Doc 2)", "executed": "[n]", "passed": "[n]", "pass_rate": "[%]"},
                {"phase": "System (automated Pest)", "executed": "[n]", "passed": "[n]", "pass_rate": "[%]"},
                {"phase": "UAT", "executed": "7", "passed": "[n]", "pass_rate": "[%]"},
                {"phase": "Regression", "executed": "[n]", "passed": "[n]", "pass_rate": "[%]"},
            ],
            "defects": {
                "total_logged": len(defects),
                "fixed": "[n]",
                "deferred": "[n]",
                "remaining_open": "[n]",
                "severity_breakdown": {"Critical": "0", "High": "1", "Medium": "4", "Low": "3"},
            },
        },
        "phase_summary": {
            "rows": [
                {"phase": "System testing", "outcome": "[Pass/Fail]", "reference": "Doc 5"},
                {"phase": "UAT", "outcome": "[Pass/Fail]", "reference": "Doc 6"},
                {"phase": "Regression", "outcome": "[Pass/Fail]", "reference": "Doc 8"},
            ]
        },
        "outstanding_issues": {
            "rows": [{"defect_id": "DEF-006, DEF-008", "justification_if_deferred": "[Fill]", "risk": "[Low/Medium]"}]
        },
        "lessons_learned": {
            "bullets": [
                "Align Pest Feature tests with WBS-* case IDs for traceability.",
                "Keep results-data JSON synced before generating Office documents.",
                "Start Laravel Reverb before notification UAT scenarios.",
            ]
        },
        "recommendation": {
            "selection": "[Approved / Conditional / Not approved]",
            "rationale": "[Fill after testing complete]",
        },
    },
)

w(
    DD / "manifest.json",
    {
        "project": PROJECT,
        "group": GROUP,
        "compiled_date": DATE,
        "sync_script": "python docs/testing/scripts/sync_results_to_document_data.py",
        "generated_office_documents": "Run: python docs/testing/document-data/generate_documents.py — outputs under docs/testing/documents/",
        "results_capture": "docs/testing/results-data/",
        "source_notes": "Adapted from docs/testing(unmodified)/ for LCC-OSAS-SYSTEM WBSMS.",
        "documents": [
            {"order": 1, "file": "01_test_plan.json", "deliverable": "Test Plan", "course_doc": "Doc 1"},
            {"order": 2, "file": "02_test_cases_document.json", "deliverable": "Test Cases Document", "course_doc": "Doc 2"},
            {"order": 3, "file": "03_system_test_report.json", "deliverable": "System Test Report", "course_doc": "Doc 5"},
            {"order": 4, "file": "04_uat_plan_and_report.json", "deliverable": "UAT Plan & Report", "course_doc": "Doc 6"},
            {"order": 5, "file": "05_defect_bug_report_log.json", "deliverable": "Defect / Bug Report Log", "course_doc": "Doc 7"},
            {"order": 6, "file": "06_regression_test_report.json", "deliverable": "Regression Test Report", "course_doc": "Doc 8"},
            {"order": 7, "file": "07_test_summary_report.json", "deliverable": "Test Summary Report", "course_doc": "Doc 9"},
        ],
        "not_included_by_user_request": ["Unit Test Report (Doc 3)", "Integration Test Report (Doc 4)"],
    },
)

# --- results-data ---
(RD / "evidence").mkdir(parents=True, exist_ok=True)
(RD / "evidence" / ".gitkeep").write_text("", encoding="utf-8")

w(
    RD / "manifest.json",
    {
        "title": "OSAS WBSMS testing — results-data hub",
        "project": PROJECT,
        "group": GROUP,
        "purpose": "Record execution outcomes and evidence paths. Sync into document-data via scripts/sync_results_to_document_data.py.",
        "directories": {
            "requirements_data": "../requirements-data/",
            "document_data": "../document-data/",
            "office_documents": "../documents/",
            "sync_script": "../scripts/sync_results_to_document_data.py",
        },
        "files_in_this_folder": [
            {"file": "manifest.json", "role": "This index"},
            {"file": "source_map.json", "role": "Inputs and generated artifacts"},
            {"file": "browser_smoke_run_2026-05-15.json", "role": "Browser session narrative log"},
            {"file": "doc2_execution_log_results.json", "role": "Doc2 Sheet A execution results"},
            {"file": "doc2_detailed_case_results.json", "role": "Doc2 Sheet B actuals"},
            {"file": "uat_execution_results.json", "role": "UAT session results"},
            {"file": "regression_run_results.json", "role": "Regression pass results"},
            {"file": "summary_metrics.json", "role": "Metrics for Doc 9"},
            {"file": "automated_runs.json", "role": "php artisan test log"},
            {"file": "office_artifacts_status.json", "role": "Track .docx/.xlsx generation status"},
        ],
    },
)

w(
    RD / "source_map.json",
    {
        "base": "docs/testing",
        "requirements_data": {
            "path": "requirements-data",
            "files": [
                "01_prefinal_submission_requirements.json",
                "02_uat_template_structure.json",
                "03_test_plan_ieee829_template_structure.json",
                "04_osas_project_context.json",
                "05_suggested_uat_scenarios_osas.json",
                "06_automated_verification_2026-05-15.json",
                "07_test_cases_document.json",
            ],
        },
        "document_data": {
            "path": "document-data",
            "files": [
                "manifest.json",
                "01_test_plan.json",
                "02_test_cases_document.json",
                "03_system_test_report.json",
                "04_uat_plan_and_report.json",
                "05_defect_bug_report_log.json",
                "06_regression_test_report.json",
                "07_test_summary_report.json",
                "generate_documents.py",
            ],
        },
        "documents": {
            "path": "documents",
            "note": "Generated Office files after running generate_documents.py",
            "expected_artifacts": [
                {"filename": f"{GROUP}_{PROJECT_SHORT}_Doc1_TestPlan.docx", "course_doc": "Doc 1"},
                {"filename": f"{GROUP}_{PROJECT_SHORT}_Doc2_TestCases.xlsx", "course_doc": "Doc 2"},
                {"filename": f"{GROUP}_{PROJECT_SHORT}_Doc5_SystemTestReport.docx", "course_doc": "Doc 5"},
                {"filename": f"{GROUP}_{PROJECT_SHORT}_Doc6_UATPlanReport.docx", "course_doc": "Doc 6"},
                {"filename": f"{GROUP}_{PROJECT_SHORT}_Doc7_DefectLog.xlsx", "course_doc": "Doc 7"},
                {"filename": f"{GROUP}_{PROJECT_SHORT}_Doc8_RegressionTestReport.docx", "course_doc": "Doc 8"},
                {"filename": f"{GROUP}_{PROJECT_SHORT}_Doc9_TestSummaryReport.docx", "course_doc": "Doc 9"},
            ],
        },
    },
)

w(
    RD / "doc2_execution_log_results.json",
    {
        "description": "Fill after test execution; run sync script to merge into document-data/02.",
        "columns": json.loads((DD / "02_test_cases_document.json").read_text(encoding="utf-8"))["sheet_a_execution_log"]["columns"],
        "rows": [],
        "last_sync": None,
    },
)

w(
    RD / "doc2_detailed_case_results.json",
    {"description": "Detailed case actuals keyed by test_case_id.", "rows": [], "last_sync": None},
)

w(
    RD / "uat_execution_results.json",
    {
        "description": "UAT execution results.",
        "source_scenarios": "../requirements-data/05_suggested_uat_scenarios_osas.json",
        "rows": [],
        "last_sync": None,
    },
)

w(
    RD / "regression_run_results.json",
    {
        "description": "Regression after fixes.",
        "related_defects": ["DEF-003", "DEF-005"],
        "rows": [],
        "last_sync": None,
    },
)

w(
    RD / "summary_metrics.json",
    {
        "description": "Mirrors Doc9 after sync.",
        "test_cases_planned": len(SHEET_A),
        "test_cases_executed": None,
        "overall_pass_rate_percent": None,
        "last_sync": None,
    },
)

w(
    RD / "automated_runs.json",
    {
        "runs": [
            {
                "date": DATE,
                "tool": "Pest / PHPUnit",
                "command": "php artisan test",
                "backend": {
                    "path": "tests/",
                    "evidence_path": "docs/testing/results-data/evidence/pest-log.txt",
                },
                "result": "[Fill: e.g. 10 passed]",
            }
        ]
    },
)

w(
    RD / "browser_smoke_run_2026-05-15.json",
    {
        "project": PROJECT,
        "date": DATE,
        "base_url": "http://127.0.0.1:8000",
        "sessions": [
            {
                "note": "Template session log — replace with real browser smoke steps and screenshots.",
                "routes_checked": [
                    "/",
                    "/osas/institutional-portal/login",
                    "/osas/student/profiling",
                ],
            }
        ],
    },
)

w(
    RD / "office_artifacts_status.json",
    {
        "artifacts": [
            {
                "path": f"docs/testing/documents/{GROUP}_{PROJECT_SHORT}_Doc1_TestPlan.docx",
                "course_doc": "Doc 1",
                "results_status": "not_generated",
                "notes": "Run generate_documents.py after filling JSON",
            },
            {
                "path": f"docs/testing/documents/{GROUP}_{PROJECT_SHORT}_Doc2_TestCases.xlsx",
                "course_doc": "Doc 2",
                "results_status": "not_generated",
                "notes": "",
            },
            {
                "path": f"docs/testing/documents/{GROUP}_{PROJECT_SHORT}_Doc5_SystemTestReport.docx",
                "course_doc": "Doc 5",
                "results_status": "not_generated",
                "notes": "",
            },
            {
                "path": f"docs/testing/documents/{GROUP}_{PROJECT_SHORT}_Doc6_UATPlanReport.docx",
                "course_doc": "Doc 6",
                "results_status": "not_generated",
                "notes": "",
            },
            {
                "path": f"docs/testing/documents/{GROUP}_{PROJECT_SHORT}_Doc7_DefectLog.xlsx",
                "course_doc": "Doc 7",
                "results_status": "not_generated",
                "notes": "",
            },
            {
                "path": f"docs/testing/documents/{GROUP}_{PROJECT_SHORT}_Doc8_RegressionTestReport.docx",
                "course_doc": "Doc 8",
                "results_status": "not_generated",
                "notes": "",
            },
            {
                "path": f"docs/testing/documents/{GROUP}_{PROJECT_SHORT}_Doc9_TestSummaryReport.docx",
                "course_doc": "Doc 9",
                "results_status": "not_generated",
                "notes": "",
            },
        ]
    },
)

print("OK: OSAS testing content generated under", BASE)
