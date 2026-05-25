@echo off
REM Knowing Eye — start backend + frontend (Windows)
set ROOT=%~dp0
set DB_ENGINE=django.db.backends.sqlite3

start "Knowing Eye API" cmd /k "cd /d %ROOT%backend && set DB_ENGINE=%DB_ENGINE% && python manage.py runserver 127.0.0.1:8000"
timeout /t 3 /nobreak >nul
start "Knowing Eye UI" cmd /k "cd /d %ROOT%frontend && npm run build && cd dist && python -m http.server 5173 --bind 127.0.0.1"
echo.
echo Backend:  http://127.0.0.1:8000/
echo Frontend: http://127.0.0.1:5173/  (production build via serve)
echo Dev HMR:  cd frontend ^&^& npm run dev
echo API base: http://127.0.0.1:8000/api/
echo.
echo Seed data (if needed): cd backend ^&^& python manage.py seed_db --noinput
pause
