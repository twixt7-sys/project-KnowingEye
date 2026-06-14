# Knowing Eye — Production Deployment Guide

This document covers everything required to deploy the Knowing Eye platform in
a production environment that supports real-time WebSocket monitoring,
PostgreSQL persistence, and the full ML behavior pipeline.

---

## 1. Environment matrix

| Component  | Recommended                                          |
|------------|------------------------------------------------------|
| OS         | Ubuntu 22.04 LTS or Windows Server 2022              |
| Python     | 3.10 – 3.12                                          |
| Node       | 20 LTS                                               |
| Database   | PostgreSQL 15+                                       |
| Cache      | Redis 7 (Channels layer + DRF cache)                 |
| Web server | Nginx (TLS termination, static files, WS upgrade)    |
| ASGI       | Daphne or Uvicorn behind Nginx                       |
| GPU        | Optional — speeds up YOLO inference (CUDA 12+)      |

---

## 2. Backend — `backend/.env`

```dotenv
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=<generate-with: python -c "import secrets; print(secrets.token_urlsafe(60))">
DJANGO_ALLOWED_HOSTS=exam.example.com,api.exam.example.com

# PostgreSQL
DB_ENGINE=django.db.backends.postgresql
DB_NAME=knowing_eye
DB_USER=knowing_eye
DB_PASSWORD=<strong-password>
DB_HOST=postgres.internal
DB_PORT=5432
DB_CONN_MAX_AGE=60

# Redis (Channels + cache)
REDIS_URL=redis://redis.internal:6379/0

# CORS — list every domain that hosts the SPA
CORS_ALLOWED_ORIGINS=https://exam.example.com
CORS_ALLOW_ALL_ORIGINS=False

# JWT
JWT_ACCESS_TTL_MIN=30
JWT_REFRESH_TTL_DAYS=14

# Knowing Eye pipeline
KE_ENABLE_PIPELINE=True
KE_ALERT_THRESHOLD=80

# HSTS
SECURE_HSTS_SECONDS=31536000
```

When `DJANGO_DEBUG=False`, the settings file automatically enables
`SECURE_SSL_REDIRECT`, secure cookies, HSTS, X-Frame-Options DENY, and the
forwarded-proto SSL header.

---

## 3. Install dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# enable the full ML pipeline (mediapipe, ultralytics, yaml)
pip install mediapipe ultralytics PyYAML

# optional: production Channels backend
pip install channels-redis

# optional: ArcFace identity verification (InsightFace + ONNX Runtime)
pip install -r ../pipeline_playground/requirements-identity.txt
```

---

## 4. Database initialization

```bash
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
python manage.py seed_db --noinput   # optional: load demo content
```

---

## 5. Run the ASGI server

Daphne is bundled. Use a process manager (systemd, supervisord, Docker) to
keep it running.

```bash
daphne -b 0.0.0.0 -p 8000 --proxy-headers core.config.asgi:application
```

A unit file `/etc/systemd/system/knowing-eye-api.service`:

```ini
[Unit]
Description=Knowing Eye ASGI API
After=network.target postgresql.service redis.service

[Service]
WorkingDirectory=/srv/knowing-eye/backend
EnvironmentFile=/srv/knowing-eye/backend/.env
ExecStart=/srv/knowing-eye/backend/venv/bin/daphne -b 0.0.0.0 -p 8000 \
    --proxy-headers core.config.asgi:application
Restart=always
User=knowing-eye

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now knowing-eye-api
```

Scale horizontally with multiple Daphne workers; the Redis channel layer keeps
alert broadcasts in sync across them.

---

## 6. Frontend build

```bash
cd frontend
npm ci
echo "VITE_API_BASE_URL=https://api.exam.example.com/api" > .env.production
npm run build
# Result in frontend/dist — copy to /var/www/exam-eye/
```

---

## 7. Nginx reverse proxy

```nginx
upstream knowing_eye_api {
    server 127.0.0.1:8000;
    keepalive 32;
}

# SPA + API
server {
    listen 443 ssl http2;
    server_name exam.example.com;
    ssl_certificate     /etc/letsencrypt/live/exam.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/exam.example.com/privkey.pem;

    root /var/www/exam-eye;
    index index.html;

    # SPA fallback
    location / { try_files $uri /index.html; }

    # Static / media uploaded by Django
    location /media/  { alias /srv/knowing-eye/backend/media/; }
    location /static/ { alias /srv/knowing-eye/backend/staticfiles/; }

    location /api/ {
        proxy_pass http://knowing_eye_api;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://knowing_eye_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}

server {
    listen 80;
    server_name exam.example.com;
    return 301 https://$host$request_uri;
}
```

---

## 8. Smoke checks

```bash
curl https://exam.example.com/api/monitoring/health/
# → {"status":"ok","service":"knowing-eye-monitoring","pipeline_mode":"playground"}

# Browse the SPA, sign in with the seeded admin account,
# create an exam, start a student session and confirm WebSocket monitoring
# reports metrics + persists behaviour logs/alerts.
```

---

## 9. Observability

* Logs land in `backend/logs/knowing_eye.log` (RotatingFileHandler, 5 MB × 5).
* Health: `/api/monitoring/health/` is public and returns the pipeline mode.
* Metrics: counts surfaced by `/api/reports/summary/` and `/api/reports/timeseries/`.

---

## 10. Backup & disaster recovery

* `pg_dump knowing_eye` daily; encrypt + ship offsite.
* Tarball `backend/media/avatars/` and `backend/logs/` together with the DB.
* Container images are stateless — redeploying recreates the runtime.

---

## 11. Upgrading the AI pipeline

1. Place new YOLO weights under `pipeline_playground/training/runs/...`.
2. Update `pipeline_playground/config/pipeline.yaml` → `detection.yolo_model`.
3. Restart the API processes — the adapter reloads the pipeline on next call.

ArcFace is configured in `pipeline_playground/config/pipeline.yaml` (`recognition.embedding_backend: arcface`).
See `pipeline_playground/training/TRAINING.md` for thresholds and legacy `face_recognition`.
