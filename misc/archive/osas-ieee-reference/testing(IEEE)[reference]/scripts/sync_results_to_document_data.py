"""Sync results-data into document-data for OSAS WBSMS testing pack.

Run from repo root:
  python docs/testing/scripts/sync_results_to_document_data.py

Populate EXEC, DETAILED, and UAT_DATA below (or in results-data JSON files)
after pytest / browser / UAT runs, then run this script.
"""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
RD = BASE / "results-data"
DD = BASE / "document-data"
REQ = BASE / "requirements-data"

DATE_DEFAULT = "2026-05-15"
TESTER_BROWSER = "IDE browser smoke"
TESTER_PEST = "Pest (php artisan test)"


# Sheet A execution log: test_case_id -> (pass_fail, date, developer, tester, extra_non_qa)
EXEC: dict[str, tuple[str, str, str, str, str]] = {
    # Example - uncomment and fill after runs:
    # "WBS-AUTH-001": ("Pass", DATE_DEFAULT, "[Dev]", TESTER_BROWSER, "Faculty login OK"),
}

# Sheet B detailed: test_case_id -> (actual, pass_fail, tester, date)
DETAILED: dict[str, tuple[str, str, str, str]] = {
    # "WBS-AUTH-001": ("Redirected to faculty dashboard.", "Pass", TESTER_BROWSER, DATE_DEFAULT),
}

# UAT: uat_id -> (pass_fail, actual, tester_role)
UAT_DATA: list[tuple[str, str, str, str]] = [
    # ("UAT-WBS-001", "Pass", "Profiling completed; pending status shown.", "Student tester"),
]


def main() -> None:
    doc2_path = DD / "02_test_cases_document.json"
    doc2 = json.loads(doc2_path.read_text(encoding="utf-8"))

    filled_a = []
    for row in doc2["sheet_a_execution_log"]["rows"]:
        tid = row["test_case_id"]
        if tid in EXEC:
            pf, dt, dev, tester, extra = EXEC[tid]
            filled_a.append(
                {
                    **row,
                    "pass_fail": pf,
                    "test_execution_date": dt,
                    "responsible_developer": dev,
                    "responsible_tester": tester,
                    "additional_comments_non_qa": extra,
                }
            )
        else:
            filled_a.append(row)

    (RD / "doc2_execution_log_results.json").write_text(
        json.dumps(
            {
                "description": "Execution log synced from sync script.",
                "columns": doc2["sheet_a_execution_log"]["columns"],
                "rows": filled_a,
                "last_sync": DATE_DEFAULT,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    detailed_rows = []
    for brow in doc2["sheet_b_detailed_test_cases"]["rows"]:
        tid = brow["test_case_id"]
        if tid in DETAILED:
            act, pf, tester, dt = DETAILED[tid]
            detailed_rows.append(
                {
                    "test_case_id": tid,
                    "actual_result": act,
                    "pass_fail": pf,
                    "tester_name": tester,
                    "date_executed": dt,
                }
            )
            brow["actual_result"] = act
            brow["pass_fail"] = pf
            brow["tester_name"] = tester
            brow["date_executed"] = dt

    (RD / "doc2_detailed_case_results.json").write_text(
        json.dumps(
            {"description": "Detailed case results.", "rows": detailed_rows, "last_sync": DATE_DEFAULT},
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    doc2["sheet_a_execution_log"]["rows"] = filled_a
    doc2_path.write_text(json.dumps(doc2, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    scen_path = REQ / "05_suggested_uat_scenarios_osas.json"
    scen_by_id = {
        c["uat_id"]: c for c in json.loads(scen_path.read_text(encoding="utf-8"))["uat_cases"]
    }

    uat_rows = []
    uat_doc_rows = []
    uat_doc = json.loads((DD / "04_uat_plan_and_report.json").read_text(encoding="utf-8"))
    expected_map = {r["uat_id"]: r for r in uat_doc["section_11_execution_results"]["rows"]}

    for uid, pf, actual, tester in UAT_DATA:
        title = scen_by_id.get(uid, {}).get("scenario_title", uid)
        uat_rows.append(
            {
                "uat_id": uid,
                "scenario_title": title,
                "tester_name_role": tester,
                "date_executed": DATE_DEFAULT,
                "actual_result": actual,
                "pass_fail": pf,
                "remarks": "Synced from sync_results_to_document_data.py",
            }
        )
        base = expected_map.get(uid, {})
        uat_doc_rows.append(
            {
                "uat_id": uid,
                "scenario": base.get("scenario", title),
                "tester_role": tester,
                "date_executed": DATE_DEFAULT,
                "expected": base.get("expected", scen_by_id.get(uid, {}).get("expected_business_result", "")),
                "actual": actual,
                "pass_fail": pf,
                "remarks": "Synced from results-data",
            }
        )

    if uat_rows:
        (RD / "uat_execution_results.json").write_text(
            json.dumps(
                {
                    "description": "UAT execution results.",
                    "source_scenarios": "../requirements-data/05_suggested_uat_scenarios_osas.json",
                    "rows": uat_rows,
                    "last_sync": DATE_DEFAULT,
                },
                indent=2,
                ensure_ascii=False,
            )
            + "\n",
            encoding="utf-8",
        )
        uat_doc["section_11_execution_results"]["rows"] = uat_doc_rows
        (DD / "04_uat_plan_and_report.json").write_text(
            json.dumps(uat_doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )

    passed = sum(1 for r in filled_a if r.get("pass_fail") == "Pass")
    total = len(filled_a)
    rate = round(100 * passed / total, 1) if total else 0

    (RD / "summary_metrics.json").write_text(
        json.dumps(
            {
                "description": "Summary metrics after sync.",
                "test_cases_planned": total,
                "test_cases_executed": str(passed) if EXEC else "[run tests first]",
                "overall_pass_rate_percent": str(rate) if EXEC else None,
                "last_sync": DATE_DEFAULT,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"OK: synced Doc2 ({len(EXEC)} EXEC overrides, {len(DETAILED)} DETAILED, {len(UAT_DATA)} UAT).")


if __name__ == "__main__":
    main()
