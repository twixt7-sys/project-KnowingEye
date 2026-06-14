@echo off
REM Vite dev server — safe for paths with spaces (uses script directory).
cd /d "%~dp0"
set NODE_OPTIONS=--max-old-space-size=4096
npm run dev -- --host 127.0.0.1 --port 5173
