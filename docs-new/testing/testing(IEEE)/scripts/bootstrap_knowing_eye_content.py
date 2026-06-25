"""Generate Knowing Eye IEEE testing documentation JSON.

Run from repo root:
  python docs/testing/testing(IEEE)/scripts/bootstrap_knowing_eye_content.py
"""

from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
DD = BASE / "document-data"
RD = BASE / "results-data"
REQ = BASE / "requirements-data"

PROJECT = "Knowing Eye"
PREFIX = "KE"
GROUP = "Knowing Eye Capstone Group"
DATE = "2026-05-25"


def w(path: Path, data: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


MODULES = [
    ("AUTH", "Authentication & RBAC", ["KE-AUTH-001", "KE-AUTH-002", "KE-AUTH-003"]),
    ("EXAM", "Exam management", ["KE-EXAM-001", "KE-EXAM-002", "KE-EXAM-003"]),
    ("SESS", "Exam sessions", ["KE-SESS-001", "KE-SESS-002", "KE-SESS-003"]),
    ("MON", "Monitoring & frames", ["KE-MON-001", "KE-MON-002", "KE-MON-003"]),
    ("BEH", "Behavior & alerts", ["KE-BEH-001", "KE-BEH-002"]),
    ("RPT", "Reports & dashboard", ["KE-RPT-001", "KE-RPT-002"]),
    ("GEN", "Landing & UI", ["KE-GEN-001", "KE-GEN-002"]),
]


def build_test_cases() -> list[dict]:
    cases = []
    for _code, module, ids in MODULES:
        for tc_id in ids:
            cases.append(
                {
                    "test_case_id": tc_id,
                    "module": module,
                    "title": f"Verify {module.lower()} - {tc_id}",
                    "priority": "High",
                    "preconditions": "Backend running; seeded or test users available.",
                    "steps": ["Execute API/UI flow per test plan.", "Record actual result."],
                    "expected_result": "Behavior matches acceptance criteria in docs/general/Project.json.",
                    "test_type": "System",
                }
            )
    return cases


w(
    REQ / "04_knowing_eye_project_context.json",
    {
        "source": "docs/general/Project.json + docs/general/MAIN_DOCUMENT.docx",
        "project": {
            "name": "Knowing Eye",
            "subtitle": "Web-Based Examination Platform with Behavioral Monitoring",
            "group": GROUP,
            "institution": "Legacy College of Compostela - Institute of Information Technology",
            "repositoryLayout": "monorepo (Django backend + React frontend + backend/ai/knowing_eye)",
            "packages": [
                {"name": "backend", "path": "backend/", "role": "Django 6 + DRF + JWT + CV pipeline"},
                {"name": "frontend", "path": "frontend/", "role": "React 18 + Vite + TypeScript"},
                {"name": "ai", "path": "backend/ai/knowing_eye/", "role": "CV/AI BehaviorPipeline"},
            ],
        },
        "functional_requirements_for_traceability": [
            "Role-based login (ADMIN, EXAMINEE)",
            "Exam CRUD and question management",
            "Session start, timer, answer submission, scoring",
            "Webcam frame upload and AI behavior analysis",
            "Behavior logs and compliance alerts",
            "Administrative reports and session summaries",
        ],
        "non_functional_for_system_report": [
            {"nfr": "Real-time monitoring latency", "how_to_test_brief": "POST /api/monitoring/frame/ under load"},
            {"nfr": "RBAC", "how_to_test_brief": "Examinee cannot access admin report endpoints"},
            {"nfr": "Privacy of webcam data", "how_to_test_brief": "Frames processed server-side; no public media URLs"},
        ],
        "demo_environment": {
            "api_base": "http://localhost:8000/api",
            "frontend_url": "http://localhost:5173",
            "pipeline_health": "http://localhost:8000/api/monitoring/health/",
            "note": "Use seed_db management command; do not commit real passwords.",
        },
        "key_routes_for_docs": {
            "auth": ["POST /api/auth/token/", "POST /api/auth/register/"],
            "exams": ["GET/POST /api/exams/", "GET /api/exams/{id}/"],
            "sessions": ["POST /api/sessions/start/", "POST /api/sessions/{id}/submit/"],
            "monitoring": ["POST /api/monitoring/frame/", "GET /api/monitoring/health/"],
            "behavior": ["GET /api/behavior/logs/", "GET /api/behavior/alerts/"],
            "reports": ["GET /api/reports/summary/", "GET /api/reports/sessions/{id}/"],
        },
        "team_members": [
            {"name": "Saturnino C. Ancog III", "role": "Team"},
            {"name": "Khrisha Marie O. Cavan", "role": "Team"},
            {"name": "Kervy N. Cadiente", "role": "Team"},
            {"name": "Twixt Jasley J. Tamera", "role": "Team"},
        ],
    },
)

w(
    REQ / "05_suggested_uat_scenarios_knowing_eye.json",
    {
        "purpose": "Business-scenario UAT for Knowing Eye examination platform.",
        "uat_cases": [
            {
                "uat_id": "UAT-KE-001",
                "module": "Exam delivery",
                "scenario_title": "Examinee completes a timed exam with webcam monitoring",
                "role": "Examinee",
                "priority": "Critical",
                "expected_business_result": "Session submitted; score recorded; behavior logs present.",
            },
            {
                "uat_id": "UAT-KE-002",
                "module": "Proctoring",
                "scenario_title": "Administrator reviews session report with alerts",
                "role": "Administrator",
                "priority": "Critical",
                "expected_business_result": "Report shows responses, behavior summary, unresolved alerts.",
            },
            {
                "uat_id": "UAT-KE-003",
                "module": "Exam management",
                "scenario_title": "Administrator publishes exam with questions",
                "role": "Administrator",
                "priority": "High",
                "expected_business_result": "Exam status active; examinee can start session.",
            },
        ],
    },
)

w(
    DD / "manifest.json",
    {
        "project": PROJECT,
        "document_prefix": "LCC_KE",
        "group": GROUP,
        "date": DATE,
        "documents": [
            {"id": 1, "file": "LCC_KE_Doc1_TestPlan.docx", "title": "Test Plan (IEEE 829)"},
            {"id": 2, "file": "LCC_KE_Doc2_TestCases.xlsx", "title": "Test Cases"},
            {"id": 5, "file": "LCC_KE_Doc5_SystemTestReport.docx", "title": "System Test Report"},
            {"id": 6, "file": "LCC_KE_Doc6_UATPlanReport.docx", "title": "UAT Plan and Report"},
            {"id": 7, "file": "LCC_KE_Doc7_DefectLog.xlsx", "title": "Defect / Bug Log"},
            {"id": 8, "file": "LCC_KE_Doc8_RegressionTestReport.docx", "title": "Regression Test Report"},
            {"id": 9, "file": "LCC_KE_Doc9_TestSummaryReport.docx", "title": "Test Summary Report"},
        ],
    },
)

w(
    DD / "02_test_cases_document.json",
    {
        "project": PROJECT,
        "test_case_prefix": PREFIX,
        "test_cases": build_test_cases(),
    },
)

w(
    RD / "summary_metrics.json",
    {
        "project": PROJECT,
        "last_updated": DATE,
        "automated": {
            "framework": "Django TestCase",
            "command": "python manage.py test",
            "status": "pending_execution",
        },
        "totals": {"planned": len(build_test_cases()), "executed": 0, "passed": 0, "failed": 0},
    },
)

w(
    RD / "manifest.json",
    {
        "project": PROJECT,
        "evidence_dirs": ["results-data/evidence/screenshots", "results-data/evidence/logs"],
        "note": "Populate after test runs; OSAS reference pack is in testing(IEEE)[reference]/",
    },
)

print(f"Wrote Knowing Eye IEEE pack under {BASE}")
