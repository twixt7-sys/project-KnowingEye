@echo off
REM ---------------------------------------------------------------------------
REM  Knowing Eye - rich demo data seed
REM  Adds a full demo dataset (all six roles, exams across the full create ->
REM  approve -> publish -> archive lifecycle, sectioned/pooled/roster-gated
REM  exams, and real completed exam attempts) via the actual exam/session
REM  services. Run against a freshly wiped database - see wipe-data.cmd.
REM  Prompts for confirmation unless run with /y.
REM  Usage: scripts\seed-demo.cmd [/y] [student-count]
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
set "STUDENTS=40"
if /i "%~1"=="/y" (
  set "NOINPUT_FLAG=--noinput"
  if not "%~2"=="" set "STUDENTS=%~2"
) else (
  if not "%~1"=="" set "STUDENTS=%~1"
)

cd /d "%ROOT%\backend"
"%PY%" manage.py seed_demo --students %STUDENTS% %NOINPUT_FLAG%
