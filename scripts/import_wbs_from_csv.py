#!/usr/bin/env python3
"""Import WBS nodes from misc/Knowing Eye Gantt Chart - Sheet1.csv into docs/os/data/seed/wbs.json."""
import csv
import json
import re
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "misc" / "Knowing Eye Gantt Chart - Sheet1.csv"
OUT_PATH = ROOT / "docs" / "os" / "data" / "seed" / "wbs.json"

STATUS_MAP = {
    "complete": "done",
    "pending": "in_progress",
    "not started": "todo",
}


def parse_date(raw: str):
    raw = (raw or "").strip()
    if not raw or raw == "-":
        return None
    for fmt in ("%m/%d/%y", "%m/%d/%Y", "%m/%d/%y".replace("/%y", "/%Y")):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    # e.g. 5/2/2026 without leading zero
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", raw)
    if m:
        mo, d, y = m.groups()
        y = int(y)
        if y < 100:
            y += 2000
        try:
            return datetime(int(y), int(mo), int(d)).strftime("%Y-%m-%d")
        except ValueError:
            return None
    return None


def parent_code(code: str):
    if "." not in code:
        return None
    return code.rsplit(".", 1)[0]


def level_from_code(code: str) -> int:
    return code.count(".") + 1


def main():
    rows = []
    with CSV_PATH.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        all_rows = list(reader)

    # Data starts after header row containing "Phase,Task Title"
    start = 0
    for i, row in enumerate(all_rows):
        joined = ",".join(row)
        if "Phase" in joined and "Task Title" in joined:
            start = i + 1
            break

    code_to_id = {}

    for row in all_rows[start:]:
        if len(row) < 12:
            continue
        code = (row[2] or "").strip()
        title = (row[3] or "").strip()
        if not code or not title:
            continue
        # skip non-WBS noise rows
        if not re.match(r"^[\d.]+$", code.replace(" ", "")):
            continue

        owner = (row[4] or "").strip()
        start_date = parse_date(row[5])
        end_date = parse_date(row[6])
        notes = (row[9] or "").strip()
        try:
            progress_pct = float((row[10] or "0").strip() or 0)
        except ValueError:
            progress_pct = 0
        status_raw = (row[11] or "Pending").strip().lower()
        status = STATUS_MAP.get(status_raw, "todo")

        node_id = f"WBS-{code}"
        code_to_id[code] = node_id
        pc = parent_code(code)
        parent_id = code_to_id.get(pc) if pc else None

        node = {
            "id": node_id,
            "code": code,
            "title": title,
            "parent_id": parent_id,
            "level": level_from_code(code),
            "owner": owner,
            "status": status,
            "progress": round(min(max(progress_pct / 100.0, 0), 1), 4),
            "deliverable": notes or "",
        }
        if start_date:
            node["start_date"] = start_date
        if end_date:
            node["end_date"] = end_date
        rows.append(node)

    OUT_PATH.write_text(json.dumps({"nodes": rows}, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(rows)} WBS nodes to {OUT_PATH}")


if __name__ == "__main__":
    main()
