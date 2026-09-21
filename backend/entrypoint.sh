#!/bin/sh
# Railway (unlike Render's preDeployCommand) has no separate release phase,
# so migrations/collectstatic must run as part of container startup.
# Idempotent - safe to run on every boot/restart.
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec daphne -b 0.0.0.0 -p "${PORT:-8000}" --proxy-headers core.config.asgi:application
