@echo off
REM ---------------------------------------------------------------------------
REM  Knowing Eye — development bootstrap (Windows)
REM  Starts:
REM   * Django ASGI server (Daphne) with WebSocket support on :8000
REM   * Vite dev server on :5173 (HMR)
REM ---------------------------------------------------------------------------

setlocal
set "ROOT=%~dp0"
set OPENBLAS_NUM_THREADS=1
set OMP_NUM_THREADS=1
set MKL_NUM_THREADS=1

echo.
echo Starting Knowing Eye (paths with spaces are supported)...
echo.

start "Knowing Eye API (Daphne + ASGI)" cmd /k call "%ROOT%backend\run-api.cmd"

timeout /t 3 /nobreak >nul

start "Knowing Eye UI (Vite HMR)" cmd /k call "%ROOT%frontend\run-dev.cmd"

echo Backend (ASGI):   http://127.0.0.1:8000/
echo Frontend (HMR):   http://127.0.0.1:5173/
echo API base:         http://127.0.0.1:8000/api/
echo WebSocket route:  ws://127.0.0.1:8000/ws/monitoring/{session-id}/?token=...
echo Health check:     http://127.0.0.1:8000/api/monitoring/health/
echo.
echo First run seed:   cd backend ^&^& python manage.py seed_db --noinput
echo.
pause
