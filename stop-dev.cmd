@echo off
REM Stop Knowing Eye dev servers (Daphne on :8000, Vite on :5173)

echo Stopping Knowing Eye dev servers...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
  echo Killing PID %%a ^(port 8000^)
  taskkill /PID %%a /F >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
  echo Killing PID %%a ^(port 5173^)
  taskkill /PID %%a /F >nul 2>&1
)

echo Done. You can run start-dev.cmd again.
pause
