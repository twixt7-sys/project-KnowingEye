#!/usr/bin/env bash
# Serve the Knowing Eye Project OS locally over HTTP.
# Opening index.html via file:// will NOT work - ES modules and fetch require HTTP.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8080}"

echo "──────────────────────────────────────────────"
echo " Knowing Eye - Project OS local preview"
echo " Serving: $ROOT"
echo " URL:     http://localhost:$PORT"
echo "──────────────────────────────────────────────"
echo
echo "One-time GitHub Pages setup:"
echo "  1. Push this repo to GitHub (branch: main)."
echo "  2. Settings → Pages → Build and deployment → Source: GitHub Actions."
echo "  3. The workflow at .github/workflows/deploy.yml publishes docs-new/."
echo

cd "$ROOT"
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server "$PORT"
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes serve -l "$PORT"
else
  echo "ERROR: Install Python 3 or Node.js (npx serve) to preview locally." >&2
  exit 1
fi
