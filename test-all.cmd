@echo off
REM Run all automated test suites for Knowing Eye
setlocal
set "ROOT=%~dp0"
set DB_ENGINE=django.db.backends.sqlite3
set OPENBLAS_NUM_THREADS=1
set OMP_NUM_THREADS=1

echo.
echo === Backend (Django) ===
cd /d "%ROOT%backend"
python manage.py test features
if errorlevel 1 goto :fail

echo.
echo === Pipeline (pytest) ===
cd /d "%ROOT%pipeline_playground"
python -m pytest tests/ -q
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
