@echo off
REM Knowing Eye — double-click or run from Command Prompt: start.cmd
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if errorlevel 1 pause
