"""Merge results-data computed stats into chapter-data/07_8_data_analysis.json.

Run from repo root:
  python "docs/testing(UTAUT)/scripts/sync_results_to_chapter_data.py"
"""

from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
RD = BASE / "results-data"
CH = BASE / "chapter-data"
INST = BASE / "instrument-data"


def main() -> None:
    stats = json.loads((RD / "computed_descriptive_stats.json").read_text(encoding="utf-8"))
    pearson = json.loads((RD / "computed_pearson_correlation.json").read_text(encoding="utf-8"))
    all_items = []
    survey = json.loads((INST / "01_survey_questionnaire.json").read_text(encoding="utf-8"))
    for part in survey["parts"]:
        if "items" in part:
            all_items.extend(part["items"])
    items = {i["item_id"]: i for i in all_items}

    ch78 = json.loads((CH / "07_8_data_analysis.json").read_text(encoding="utf-8"))
    ch78["sample_size"] = stats.get("sample_size", 50)
    ch78["data_status"] = stats.get("status", "synced")

    pe_rows = []
    for iid in ["PE1", "PE2", "PE3", "PE4", "PE5"]:
        st = stats.get("by_item", {}).get(iid, {})
        pe_rows.append([
            iid,
            items[iid]["statement"],
            str(st.get("weighted_mean", "[WM]")),
            str(st.get("std_dev", "[SD]")),
            st.get("interpretation", "[Interpretation]"),
        ])
    pe_c = stats.get("by_construct", {}).get("PE", {})
    pe_rows.append(["", "Overall Weighted Mean", str(pe_c.get("weighted_mean", "")), str(pe_c.get("std_dev", "")), pe_c.get("interpretation", "")])
    ch78["table_7_9_pe"]["rows"] = pe_rows

    cons = []
    names = {
        "PE": "Performance Expectancy (PE)",
        "EE": "Effort Expectancy (EE)",
        "SI": "Social Influence (SI)",
        "FC": "Facilitating Conditions (FC)",
        "BI": "Behavioral Intention (BI)",
    }
    for i, (code, label) in enumerate(names.items(), 1):
        c = stats.get("by_construct", {}).get(code, {})
        cons.append([str(i), label, str(c.get("weighted_mean", "")), str(c.get("std_dev", "")), c.get("interpretation", "")])
    ov = stats.get("by_construct", {}).get("OVERALL", {})
    cons.append(["", "OVERALL WEIGHTED MEAN", str(ov.get("weighted_mean", "")), str(ov.get("std_dev", "")), ov.get("interpretation", "")])
    ch78["table_7_10_consolidated"]["rows"] = cons

    p_rows = []
    for row in pearson.get("rows", []):
        construct_label = row.get("construct", "").replace(" construct mean vs BI", "")
        name_map = {"PE": "Performance Expectancy (PE)", "EE": "Effort Expectancy (EE)", "SI": "Social Influence (SI)", "FC": "Facilitating Conditions (FC)"}
        label = name_map.get(construct_label[:2], construct_label)
        p_rows.append([
            label,
            str(row.get("pearson_r", "")),
            str(row.get("p_value", "")),
            row.get("significance", ""),
            row.get("decision", ""),
        ])
    ch78["table_7_11_pearson"]["rows"] = p_rows

    (CH / "07_8_data_analysis.json").write_text(json.dumps(ch78, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("OK: chapter-data/07_8_data_analysis.json updated from results-data.")


if __name__ == "__main__":
    main()
