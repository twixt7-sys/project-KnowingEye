# Knowing Eye — start monitoring UI + API
# Run from this folder:  .\start.ps1
# Or double-click:      start.cmd

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

function Test-Command($Name) {
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command python)) {
    Write-Host "ERROR: Python is not installed or not on PATH." -ForegroundColor Red
    Write-Host "Install Python 3.10+ from https://www.python.org/downloads/ and enable 'Add to PATH'."
    exit 1
}

if (-not (Test-Path "$Root\.venv\Scripts\python.exe")) {
    Write-Host "Creating virtual environment..."
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$pip = "$Root\.venv\Scripts\python.exe"
Write-Host "Installing core dependencies (if needed)..."
& $pip -m pip install -q -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: pip install failed. See instructions.md" -ForegroundColor Red
    exit 1
}

Write-Host "Installing optional identity matching (face-recognition)..."
& $pip -m pip install -q -r requirements-identity.txt 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Skipped (dlib not installed). App runs without identity_match — see instructions.md" -ForegroundColor Yellow
}

$port = 8090
$inUse = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($inUse) {
    Write-Host ""
    Write-Host "WARNING: Port $port is already in use (another server may be running)." -ForegroundColor Yellow
    Write-Host "Open http://127.0.0.1:$port in your browser, or stop the other process and run again."
    Write-Host ""
}

Write-Host ""
Write-Host "Starting Knowing Eye at http://127.0.0.1:$port"
Write-Host "Press Ctrl+C to stop."
Write-Host ""

& "$Root\.venv\Scripts\python.exe" -m uvicorn api.main:app --host 127.0.0.1 --port $port

