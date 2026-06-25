"""Generate Knowing Eye UTAUT JSON pack."""

from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
PROJECT = "Knowing Eye"


def w(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


ITEMS = []
CONSTRUCTS = [
    ("PE", "Performance Expectancy", range(1, 6)),
    ("EE", "Effort Expectancy", range(6, 11)),
    ("SI", "Social Influence", range(11, 16)),
    ("FC", "Facilitating Conditions", range(16, 21)),
    ("BI", "Behavioral Intention", range(21, 26)),
]

for code, name, nums in CONSTRUCTS:
    for n in nums:
        ITEMS.append(
            {
                "item_number": n,
                "construct_code": code,
                "construct_name": name,
                "statement": f"[KE-{n:02d}] Item {n} - {name} for Knowing Eye proctored exams (Likert 1–5).",
            }
        )

w(
    BASE / "instrument-data" / "01_survey_questionnaire.json",
    {"project": PROJECT, "scale": "Likert 1–5", "items": ITEMS},
)

w(
    BASE / "respondent-data" / "01_uat_respondent_profile.json",
    {
        "project": PROJECT,
        "table_title": "Table 7.7 - Profile of Respondents (Knowing Eye UAT)",
        "roles": ["Exam Administrator", "Examinee", "Faculty Observer"],
        "target_sample_n": 50,
        "collected_n": 0,
        "note": "Update after field UAT; reference OSAS pack in testing(UTAUT)[reference]/",
    },
)

w(
    BASE / "chapter-data" / "07_6_utaut_framework.json",
    {
        "section": "7.6 Unified Theory of Acceptance and Use of Technology",
        "system_evaluated": PROJECT,
        "description": "UTAUT applied to acceptance of the Knowing Eye web-based examination platform with integrated behavioral monitoring.",
        "constructs": [c[1] for c in CONSTRUCTS],
    },
)

print(f"Wrote Knowing Eye UTAUT pack under {BASE}")
