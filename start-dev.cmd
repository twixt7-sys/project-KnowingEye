@echo off
REM ---------------------------------------------------------------------------
REM  Knowing Eye - development bootstrap (Windows)
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

echo Backend (ASGI):   http://127.0.0.1:8000/  (proxied via Vite HTTPS)
echo Frontend (HMR):   https://127.0.0.1:5173/  ^|  https://192.168.254.190:5173/
echo API base:         https://192.168.254.190:5173/api/
echo WebSocket route:  wss://192.168.254.190:5173/ws/monitoring/{session-id}/?token=...
echo Health check:     https://192.168.254.190:5173/api/monitoring/health/
echo.
echo Other devices on Wi-Fi: open https://192.168.254.190:5173/
echo   Camera requires HTTPS. On phones, install mkcert root CA if you see cert warnings.
echo   Root CA file: %%LOCALAPPDATA%%\mkcert\rootCA.pem
echo.
echo First time?        Run start-setup.cmd once before using this script.
echo.
pause
