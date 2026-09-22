FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_ENV=production \
    OPENBLAS_NUM_THREADS=1

WORKDIR /app

# mediapipe / insightface (onnxruntime) need these shared libs even with the
# "headless" opencv wheel; build-essential+cmake cover insightface's native
# extension build on install. libgomp1 (OpenMP runtime) is required by
# mediapipe's TFLite/XNNPACK delegate - without it `import mediapipe` raises
# "libgomp.so.1: cannot open shared object file", which the try/except
# guards in face_detector.py/pose_detector.py swallow silently, forcing
# every frame onto the OpenCV Haar cascade fallback.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
        libgl1 \
        libglib2.0-0 \
        libsm6 \
        libxext6 \
        libxrender1 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-core.txt requirements-cv.txt requirements-prod.txt requirements-identity.txt requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-identity.txt

COPY . .
RUN chmod +x entrypoint.sh

EXPOSE 8000

# Render (and most PaaS) inject $PORT at runtime; fall back to 8000 for local
# `docker run`. entrypoint.sh migrates + collects static before starting
# Daphne - needed on Railway, which has no separate release/pre-deploy phase.
CMD ["./entrypoint.sh"]
