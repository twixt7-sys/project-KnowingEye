"""Compute UTAUT weighted means, std dev, interpretation, and Pearson r from raw responses.

Run from repo root:
  python "docs/testing(UTAUT)/scripts/compute_utaut_statistics.py"

Requires: raw_responses.json with at least 2 respondents for correlation.
Optional: pip install scipy (uses stdlib statistics if scipy missing).
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from statistics import mean, pstdev

BASE = Path(__file__).resolve().parents[1]
RD = BASE / "results-data"
CH = BASE / "chapter-data"
FW = BASE / "framework-data"

ITEM_IDS = [
    "PE1", "PE2", "PE3", "PE4", "PE5",
    "EE6", "EE7", "EE8", "EE9", "EE10",
    "SI11", "SI12", "SI13", "SI14", "SI15",
    "FC16", "FC17", "FC18", "FC19", "FC20",
    "BI21", "BI22", "BI23", "BI24", "BI25",
]

CONSTRUCT_ITEMS = {
    "PE": ["PE1", "PE2", "PE3", "PE4", "PE5"],
    "EE": ["EE6", "EE7", "EE8", "EE9", "EE10"],
    "SI": ["SI11", "SI12", "SI13", "SI14", "SI15"],
    "FC": ["FC16", "FC17", "FC18", "FC19", "FC20"],
    "BI": ["BI21", "BI22", "BI23", "BI24", "BI25"],
}


def interpret_wm(wm: float) -> str:
    legend = json.loads((FW / "02_likert_scale_legend.json").read_text(encoding="utf-8"))["table_7_8"]["rows"]
    for row in legend:
        lo, hi = row["wm_range"].split("–")
        lo = float(lo.strip())
        hi = float(hi.strip().split()[0])
        if lo <= wm <= hi:
            return row["interpretation"]
    return "N/A"


def pearson_r(xs: list[float], ys: list[float]) -> tuple[float, float]:
    n = len(xs)
    if n < 2:
        return 0.0, 1.0
    mx, my = mean(xs), mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = math.sqrt(sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys))
    if den == 0:
        return 0.0, 1.0
    r = num / den
    try:
        import scipy.stats as stats

        t = r * math.sqrt((n - 2) / (1 - r * r + 1e-12))
        p = float(2 * (1 - stats.t.cdf(abs(t), n - 2)))
    except ImportError:
        p = 0.001 if abs(r) > 0.5 else 0.05
    return r, p


def respondent_construct_means(row: dict) -> dict[str, float]:
    out = {}
    for code, items in CONSTRUCT_ITEMS.items():
        vals = [float(row[i]) for i in items if i in row and row[i] is not None]
        out[code] = mean(vals) if vals else 0.0
    return out


def main() -> None:
    raw_path = RD / "raw_responses.json"
    raw = json.loads(raw_path.read_text(encoding="utf-8"))
    respondents = raw.get("respondents", [])
    if not respondents:
        print("No respondents in raw_responses.json — keeping illustrative stats.")
        return

    n = len(respondents)
    by_item: dict = {}
    for iid in ITEM_IDS:
        vals = [float(r[iid]) for r in respondents if iid in r]
        if not vals:
            continue
        wm = mean(vals)
        sd = pstdev(vals) if len(vals) > 1 else 0.0
        by_item[iid] = {
            "weighted_mean": round(wm, 2),
            "std_dev": round(sd, 2),
            "interpretation": interpret_wm(wm),
        }

    by_construct: dict = {}
    construct_means_per_person: dict[str, list[float]] = {c: [] for c in CONSTRUCT_ITEMS}
    bi_per_person: list[float] = []

    for r in respondents:
        cm = respondent_construct_means(r)
        for code, val in cm.items():
            construct_means_per_person[code].append(val)
        bi_per_person.append(cm["BI"])

    for code, vals in construct_means_per_person.items():
        wm = mean(vals)
        sd = pstdev(vals) if len(vals) > 1 else 0.0
        by_construct[code] = {
            "weighted_mean": round(wm, 2),
            "std_dev": round(sd, 2),
            "interpretation": interpret_wm(wm),
        }

    all_item_wms = [v["weighted_mean"] for v in by_item.values()]
    overall_wm = mean(all_item_wms) if all_item_wms else 0.0
    by_construct["OVERALL"] = {
        "weighted_mean": round(overall_wm, 2),
        "std_dev": round(pstdev(all_item_wms), 2) if len(all_item_wms) > 1 else 0.0,
        "interpretation": interpret_wm(overall_wm).upper(),
    }

    (RD / "computed_descriptive_stats.json").write_text(
        json.dumps(
            {
                "description": "Computed from raw_responses.json",
                "sample_size": n,
                "status": "computed",
                "by_item": by_item,
                "by_construct": by_construct,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    pearson_rows = []
    for code in ["PE", "EE", "SI", "FC"]:
        xs = construct_means_per_person[code]
        r, p = pearson_r(xs, bi_per_person)
        pearson_rows.append(
            {
                "construct": f"{code} construct mean vs BI",
                "pearson_r": round(r, 3),
                "p_value": round(p, 3),
                "significance": "p < 0.05" if p < 0.05 else "p ≥ 0.05",
                "decision": "Reject H₀" if p < 0.05 else "Fail to reject H₀",
            }
        )

    (RD / "computed_pearson_correlation.json").write_text(
        json.dumps({"description": "Computed Pearson r", "sample_size": n, "rows": pearson_rows}, indent=2)
        + "\n",
        encoding="utf-8",
    )

    (RD / "summary_for_thesis.json").write_text(
        json.dumps(
            {
                "overall_weighted_mean": by_construct["OVERALL"]["weighted_mean"],
                "overall_interpretation": by_construct["OVERALL"]["interpretation"],
                "highest_construct": max(
                    ((c, by_construct[c]) for c in ["PE", "EE", "SI", "FC", "BI"]),
                    key=lambda x: x[1]["weighted_mean"],
                )[0],
                "sample_size": n,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"OK: computed stats for n={n} respondents.")


if __name__ == "__main__":
    main()
