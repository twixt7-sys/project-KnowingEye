@echo off
cd /d "%~dp0"
set DB_ENGINE=django.db.backends.sqlite3
set OPENBLAS_NUM_THREADS=1
set OMP_NUM_THREADS=1
set NODE_OPTIONS=
echo Starting Knowing Eye API on http://127.0.0.1:8000/
python manage.py runserver 127.0.0.1:8000
