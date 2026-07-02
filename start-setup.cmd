@echo off
REM ---------------------------------------------------------------------------
REM  Knowing Eye - first-time setup (Windows)
REM  Run once after cloning the repository:
REM   * Python virtualenv + backend dependencies
REM   * Database migrate + seed demo data
REM   * Frontend npm install + optional .env.local
REM  After this completes, use start-dev.cmd to run the app.
REM ---------------------------------------------------------------------------

setlocal
set "ROOT=%~dp0"
set OPENBLAS_NUM_THREADS=1
set OMP_NUM_THREADS=1
set MKL_NUM_THREADS=1
set DB_ENGINE=django.db.backends.sqlite3

echo.
echo ============================================================
echo  Knowing Eye - first-time setup
echo ============================================================
echo.

REM --- Prerequisites ---------------------------------------------------------

where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python was not found on PATH.
  echo         Install Python 3.10+ from https://www.python.org/downloads/
  echo         and enable "Add python.exe to PATH" during installation.
  goto :fail
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found on PATH.
  echo         Install the current LTS release from https://nodejs.org/
  goto :fail
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found on PATH.
  echo         Reinstall Node.js from https://nodejs.org/
  goto :fail
)

for /f "delims=" %%v in ('python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2^>nul') do set "PY_VER=%%v"
if not defined PY_VER (
  echo [ERROR] Could not determine the installed Python version.
  goto :fail
)
python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python 3.10+ is required. Found Python %PY_VER%.
  goto :fail
)
echo Python %PY_VER% detected.
for /f "delims=" %%v in ('node --version 2^>nul') do echo Node   %%v
for /f "delims=" %%v in ('npm --version 2^>nul') do echo npm    %%v
echo.

REM --- Backend ---------------------------------------------------------------

echo [1/4] Backend virtualenv and Python packages...
call "%ROOT%backend\setup-venv.cmd" --nopause
if errorlevel 1 goto :fail

set "PY=%ROOT%backend\venv\Scripts\python.exe"
if not exist "%PY%" (
  echo [ERROR] Backend venv was not created at backend\venv\
  goto :fail
)

echo.
echo [2/4] Database migrate...
cd /d "%ROOT%backend"
"%PY%" manage.py migrate --noinput
if errorlevel 1 goto :fail

echo.
echo [3/4] Seed demo users, exams, and sessions...
"%PY%" manage.py seed_db --noinput
if errorlevel 1 goto :fail

REM --- Frontend --------------------------------------------------------------

echo.
echo [4/4] Frontend npm install...
cd /d "%ROOT%frontend"
if not exist ".env.local" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env.local" >nul
    echo Created frontend\.env.local from .env.example
  )
)
call npm install
if errorlevel 1 goto :fail

REM --- Done ------------------------------------------------------------------

echo.
echo ============================================================
echo  Setup complete.
echo ============================================================
echo.
echo Next step: double-click start-dev.cmd (or run it from this folder).
echo.
echo   Backend:  http://127.0.0.1:8000/
echo   Frontend: http://127.0.0.1:5173/
echo.
echo Seed logins:
echo   Admin     admin / adminpass
echo   Examinee  examinee01 / pass001  (also examinee02 / pass002, ...)
echo   Examiner  examiner1 / examiner1
echo.
echo Optional: copy backend\.env.example to backend\.env for custom settings.
echo.
pause
exit /b 0

:fail
echo.
echo Setup did not finish. Fix the error above and run start-setup.cmd again.
echo.
pause
exit /b 1
