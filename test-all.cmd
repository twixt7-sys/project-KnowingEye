@echo off
REM Run all automated test suites for Knowing Eye
setlocal
set "ROOT=%~dp0"
set DB_ENGINE=django.db.backends.sqlite3
set OPENBLAS_NUM_THREADS=1
set OMP_NUM_THREADS=1
set MKL_NUM_THREADS=1

set "PY=%ROOT%backend\venv\Scripts\python.exe"
if not exist "%PY%" (
  echo [ERROR] Backend venv not found. Run start-setup.cmd first.
  goto :fail
)

echo.
echo === Backend (Django: features, core, shared, ai) ===
cd /d "%ROOT%backend"
"%PY%" manage.py test features core shared ai --verbosity=1
if errorlevel 1 goto :fail

echo.
echo === Frontend (Vitest) ===
cd /d "%ROOT%frontend"
if not exist "node_modules\" (
  echo [ERROR] Frontend node_modules missing. Run start-setup.cmd or npm install.
  goto :fail
)
call npm test
if errorlevel 1 goto :fail

echo.
echo All test suites passed.
pause
exit /b 0

:fail
echo.
echo Tests failed.
pause
exit /b 1
