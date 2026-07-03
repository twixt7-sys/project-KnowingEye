@echo off
REM Regenerate local HTTPS certs when your LAN IP changes.
REM Requires mkcert: winget install FiloSottile.mkcert
cd /d "%~dp0"
if not exist "certs" mkdir certs
mkcert -install
mkcert -cert-file certs\dev.pem -key-file certs\dev-key.pem 192.168.254.190 localhost 127.0.0.1
echo.
echo Certs written to frontend\certs\
echo Update VITE_API_BASE_URL in .env.local if your LAN IP changed.
echo For demo phones: install %%LOCALAPPDATA%%\mkcert\rootCA.pem as a trusted CA.
pause
