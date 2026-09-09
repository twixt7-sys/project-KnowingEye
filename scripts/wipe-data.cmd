@echo off
REM ---------------------------------------------------------------------------
REM  Knowing Eye - full data wipe
REM  Permanently deletes every exam, session, and account (including admins),
REM  then recreates the bootstrap admin from backend\.env (SEED_ADMIN_*).
REM  Prompts for confirmation unless run with /y.
REM  Usage: scripts\wipe-data.cmd [/y]
REM ---------------------------------------------------------------------------

setlocal
set "ROOT=%~dp0.."
set DB_ENGINE=django.db.backends.sqlite3

set "PY=%ROOT%\backend\venv\Scripts\python.exe"
if not exist "%PY%" (
  echo [ERROR] Backend venv not found. Run start-setup.cmd first.
  exit /b 1
)

set "NOINPUT_FLAG="
if /i "%~1"=="/y" set "NOINPUT_FLAG=--noinput"

cd /d "%ROOT%\backend"
"%PY%" manage.py seed_db --flush %NOINPUT_FLAG%
