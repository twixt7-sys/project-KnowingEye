@echo off
REM Run the Django backend with full ASGI (WebSockets enabled via Daphne).
cd /d "%~dp0"
set DB_ENGINE=django.db.backends.sqlite3
set OPENBLAS_NUM_THREADS=1
set OMP_NUM_THREADS=1
set MKL_NUM_THREADS=1
set NODE_OPTIONS=

set "PYTHON=python"
if exist "%~dp0venv\Scripts\python.exe" set "PYTHON=%~dp0venv\Scripts\python.exe"

echo Starting Knowing Eye API (ASGI) on http://0.0.0.0:8000/
echo Local:     http://127.0.0.1:8000/
echo Network:   http://192.168.254.190:8000/
echo WebSocket: ws://192.168.254.190:8000/ws/monitoring/{session-id}/?token=...
"%PYTHON%" manage.py migrate --noinput
"%PYTHON%" -m daphne -b 0.0.0.0 -p 8000 core.config.asgi:application
