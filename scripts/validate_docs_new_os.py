#!/usr/bin/env python3
"""Validate docs-new Project OS imports, seeds, and doc paths."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "docs-new"
IMPORT_RE = re.compile(r"import\s+(?:[^'\"]+from\s+)?['\"]([^'\"]+)['\"]")

errors = []

for f in ROOT.glob("os/**/*.js"):
    text = f.read_text(encoding="utf-8")
    for m in IMPORT_RE.finditer(text):
        spec = m.group(1)
        if not spec.startswith("."):
            continue
        target = (f.parent / spec).resolve()
        if not target.exists():
            errors.append(f"MISSING IMPORT: {f.relative_to(ROOT)} -> {spec} ({target})")

for sf in (ROOT / "os/data/seed").glob("*.json"):
    try:
        json.loads(sf.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        errors.append(f"BAD JSON: {sf.name}: {e}")

idx = json.loads((ROOT / "os/data/seed/documents-index.json").read_text(encoding="utf-8"))
for ch in idx.get("chapters", []):
    for p in ch.get("pages", []):
        fp = ROOT / p["file"]
        if not fp.exists():
            errors.append(f"MISSING DOC: {p['file']}")

for rel in [
    "index.html",
    "os/app.js",
    "os/config/project.json",
    "os/core/schedule.js",
    "os/core/doc-content.js",
    "os/assets/charts/finish-line.js",
    "os/assets/template-images.js",
]:
    if not (ROOT / rel).exists():
        errors.append(f"MISSING FILE: {rel}")

wbs = json.loads((ROOT / "os/data/seed/wbs.json").read_text(encoding="utf-8"))
print(f"WBS nodes: {len(wbs.get('nodes', []))}")

if errors:
    print(f"\n{len(errors)} error(s):")
    for e in errors:
        print(" ", e)
    raise SystemExit(1)
print("All checks passed.")
