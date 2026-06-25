#!/usr/bin/env python3
"""Check documentation HTML asset references and optional templates."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "docs-new"
errors = []
warnings = []

idx = json.loads((ROOT / "os/data/seed/documents-index.json").read_text(encoding="utf-8"))
for ch in idx.get("chapters", []):
    for p in ch.get("pages", []):
        fp = ROOT / p["file"]
        if not fp.exists():
            errors.append(f"MISSING DOC PAGE: {p['file']}")

href_re = re.compile(r"""(?:src|href)=["']([^"'#?]+)["']""")
for html in ROOT.glob("documentation/**/*.html"):
    text = html.read_text(encoding="utf-8", errors="ignore")
    base = html.parent
    for m in href_re.finditer(text):
        ref = m.group(1)
        if ref.startswith(("http://", "https://", "//", "data:", "#", "mailto:")):
            continue
        if ref.startswith("../../os/"):
            target = ROOT / ref.replace("../../", "")
        else:
            target = (base / ref).resolve()
        try:
            target.relative_to(ROOT.resolve())
        except ValueError:
            continue
        if not target.exists():
            errors.append(f"BROKEN ASSET: {html.relative_to(ROOT)} -> {ref}")

for name in ["adviser.png", "tm-1.png", "tm-2.png", "tm-3.png", "tm-4.png"]:
    if not (ROOT / "os/assets/people" / name).exists():
        warnings.append(f"MISSING template: os/assets/people/{name}")

for name in ["fig-2a1-org-chart.png", "fig-2a1b-wbs-summary.png", "fig-2a2-gantt.png"]:
    if not (ROOT / "documentation/chapter2/assets/figures" / name).exists():
        warnings.append(f"MISSING template: documentation/chapter2/assets/figures/{name}")

print(f"Errors: {len(errors)}")
for e in errors:
    print(" ", e)
print(f"Warnings (optional templates): {len(warnings)}")
for w in warnings:
    print(" ", w)
raise SystemExit(1 if errors else 0)
