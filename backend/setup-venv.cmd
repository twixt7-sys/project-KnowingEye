@echo off
REM One-time backend setup: virtualenv + staged pip install (shows progress)
cd /d "%~dp0"

if not exist "venv\Scripts\python.exe" (
  echo Creating virtual environment...
  python -m venv venv
  if errorlevel 1 (
    echo Failed to create venv. Is Python 3.10+ on PATH?
    pause
    exit /b 1
  )
)

set "PY=venv\Scripts\python.exe"
set PIP_NO_CACHE_DIR=1

echo.
echo [1/4] Upgrading pip...
"%PY%" -m pip install --upgrade pip
if errorlevel 1 goto :fail

echo.
echo [2/4] Core Django packages (fast)...
"%PY%" -m pip install -r requirements-core.txt
if errorlevel 1 goto :fail

echo.
echo [3/4] OpenCV + NumPy - LARGE download, often 5-15 minutes. Not frozen; wait for output...
"%PY%" -m pip install -r requirements-cv.txt
if errorlevel 1 goto :fail

echo.
echo [4/4] Production extras (PostgreSQL driver, gunicorn)...
"%PY%" -m pip install -r requirements-prod.txt
if errorlevel 1 goto :fail

echo.
echo Done. Activate with:  venv\Scripts\activate.bat
echo Then run:            python manage.py migrate
echo Or from repo root:   start-dev.cmd
echo.
pause
exit /b 0

:fail
echo.
echo pip install failed. Try each stage manually with verbose output:
echo   venv\Scripts\python.exe -m pip install -v -r requirements-core.txt
echo.
pause
exit /b 1
