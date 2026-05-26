@echo off
REM ---------------------------------------------------------------------------
REM  Knowing Eye — development bootstrap (Windows)
REM  Starts:
REM   * Django ASGI server (Daphne) with WebSocket support on :8000
REM   * Vite dev server on :5173 (HMR)
REM ---------------------------------------------------------------------------

setlocal
set ROOT=%~dp0
set DB_ENGINE=django.db.backends.sqlite3
set OPENBLAS_NUM_THREADS=1
set OMP_NUM_THREADS=1
set MKL_NUM_THREADS=1

REM Pick the project virtual environment if present, otherwise system python.
set PYTHON=python
if exist "%ROOT%backend\venv\Scripts\python.exe" set PYTHON=%ROOT%backend\venv\Scripts\python.exe

start "Knowing Eye API (Daphne + ASGI)" cmd /k ^
  "cd /d %ROOT%backend && set DB_ENGINE=%DB_ENGINE% && set OPENBLAS_NUM_THREADS=1 && set OMP_NUM_THREADS=1 && set MKL_NUM_THREADS=1 && %PYTHON% manage.py migrate --noinput && %PYTHON% -m daphne -b 127.0.0.1 -p 8000 core.config.asgi:application"

timeout /t 3 /nobreak >nul

start "Knowing Eye UI (Vite HMR)" cmd /k ^
  "cd /d %ROOT%frontend && set NODE_OPTIONS=--max-old-space-size=4096 && npm run dev -- --host 127.0.0.1 --port 5173"

echo.
echo Backend (ASGI):   http://127.0.0.1:8000/
echo Frontend (HMR):   http://127.0.0.1:5173/
echo API base:         http://127.0.0.1:8000/api/
echo WebSocket route:  ws://127.0.0.1:8000/ws/monitoring/{session-id}/?token=...
echo Health check:     http://127.0.0.1:8000/api/monitoring/health/
echo.
echo Seed data (first run): cd backend ^&^& %PYTHON% manage.py seed_db --noinput
pause
