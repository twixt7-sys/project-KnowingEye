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
echo [1/5] Upgrading pip...
"%PY%" -m pip install --upgrade pip
if errorlevel 1 goto :fail

echo.
echo [2/5] Core Django packages (fast)...
"%PY%" -m pip install -r requirements-core.txt
if errorlevel 1 goto :fail

echo.
echo [3/5] OpenCV + NumPy - LARGE download, often 5-15 minutes. Not frozen; wait for output...
"%PY%" -m pip install -r requirements-cv.txt
if errorlevel 1 goto :fail

echo.
echo [4/5] Production extras (PostgreSQL driver, whitenoise)...
"%PY%" -m pip install -r requirements-prod.txt
if errorlevel 1 goto :fail

echo.
echo [5/5] ArcFace identity matching (InsightFace + ONNX Runtime)...
echo       Without this, identity checks fall back to a crude pixel signature.
"%PY%" -m pip install -r requirements-identity.txt
if errorlevel 1 (
  echo WARNING: identity packages failed to install - identity matching will be inaccurate.
)

echo.
echo Done. Activate with:  venv\Scripts\activate.bat
echo Then run:            python manage.py migrate
echo Or from repo root:   start-dev.cmd
echo.
if /i not "%~1"=="--nopause" pause
exit /b 0

:fail
echo.
echo pip install failed. Try each stage manually with verbose output:
echo   venv\Scripts\python.exe -m pip install -v -r requirements-core.txt
echo.
if /i not "%~1"=="--nopause" pause
exit /b 1
