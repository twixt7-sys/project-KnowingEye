@echo off
REM Serve the Knowing Eye Project OS locally over HTTP (Windows).
REM Opening index.html via file:// will NOT work - ES modules and fetch need HTTP.
setlocal
if "%PORT%"=="" set PORT=8080
cd /d "%~dp0"

echo --------------------------------------------------
echo  Knowing Eye - Project OS local preview
echo  Serving: %cd%
echo  URL:     http://localhost:%PORT%
echo --------------------------------------------------
echo.
echo One-time GitHub Pages setup:
echo   1. Push this repo to GitHub (branch: main).
echo   2. Settings - Pages - Source: GitHub Actions.
echo   3. Workflow .github/workflows/deploy.yml publishes docs-new/.
echo.

where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:%PORT%
  python -m http.server %PORT%
  goto :eof
)
where npx >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:%PORT%
  npx --yes serve -l %PORT%
  goto :eof
)
echo ERROR: Install Python 3 or Node.js (npx serve) to preview locally.
exit /b 1
