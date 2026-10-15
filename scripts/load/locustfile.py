"""Load-testing harness for Knowing Eye's monitoring pipeline (Directive Area 04,
"Capacity & performance", P0).

Drives BOTH paths the Directive calls out:
  - the REST health probe (GET /api/monitoring/health/) as a lightweight baseline
  - the WebSocket snapshot-upload channel (/ws/monitoring/<session_id>/) - "the
    one that actually breaks, and it is the one nobody tests by accident"

Each simulated examinee sends a ~480px JPEG frame about once per second,
matching the real frontend's capture cadence (frontend/src/shared/hooks/
use-monitoring.ts: DEFAULT_INTERVAL=1000ms, DEFAULT_QUALITY=0.6,
DEFAULT_CAPTURE_MAX_WIDTH=480 - see docs/documentation/chapter2/
03-system-design.html#capacity for the citation), and waits for the server's
per-frame analysis response before sending the next one, so the measured
"frame round-trip" time reflects real backend load rather than an
unbounded, unrealistic send rate.

Usage - see scripts/load/README.md for the full ladder procedure. Quick start:
    python manage.py seed_load_test --count 20
    locust -f scripts/load/locustfile.py --host http://127.0.0.1:8000 \
        --users 20 --spawn-rate 5 --run-time 2m --headless \
        --csv scripts/load/results/rung-20
"""

from __future__ import annotations

import itertools
import json
import time
from pathlib import Path

import gevent
from locust import HttpUser, User, between, events, task

from frame_fixture import build_frame_data_url

MANIFEST_PATH = Path(__file__).parent / "manifest.json"

try:
    _manifest = json.loads(MANIFEST_PATH.read_text())
    _sessions = _manifest["sessions"]
except FileNotFoundError:
    _sessions = []

_session_cycle = itertools.cycle(_sessions) if _sessions else None
_frame_data_url = build_frame_data_url()


def _ws_url(host: str, session_id: str, token: str) -> str:
    ws_host = host.replace("https://", "wss://").replace("http://", "ws://")
    return f"{ws_host}/ws/monitoring/{session_id}/?token={token}"


class HealthCheckUser(HttpUser):
    """Lightweight REST baseline - the cheap request every rung should stay fast on."""

    weight = 1
    wait_time = between(2, 4)

    @task
    def health(self):
        self.client.get("/api/monitoring/health/", name="/api/monitoring/health/")


class FrameUploadUser(User):
    """One simulated examinee: opens the monitoring WebSocket for its own
    seeded session and uploads frames at the real frontend's ~1fps cadence,
    waiting for each frame's analysis response before sending the next."""

    weight = 4  # examinees vastly outnumber idle health-check pollers in reality
    abstract = False

    def on_start(self):
        import websocket  # websocket-client; imported here so a missing manifest doesn't hard-fail collection

        if not _sessions:
            raise RuntimeError(
                "No load-test sessions found - run "
                "`python manage.py seed_load_test --count N` first (see scripts/load/README.md)."
            )
        entry = next(_session_cycle)
        self.session_id = entry["session_id"]
        url = _ws_url(self.host, entry["session_id"], entry["token"])
        self.ws = websocket.create_connection(url, timeout=10)

    def on_stop(self):
        try:
            self.ws.close()
        except Exception:
            pass

    @task
    def upload_frame(self):
        start = time.monotonic()
        try:
            self.ws.send(json.dumps({"type": "frame", "image": _frame_data_url}))
            self.ws.recv()  # wait for the analysis/ack broadcast - this is the real per-frame cost
        except Exception as exc:
            events.request.fire(
                request_type="WS",
                name="frame_upload",
                response_time=(time.monotonic() - start) * 1000,
                response_length=0,
                exception=exc,
            )
            return
        events.request.fire(
            request_type="WS",
            name="frame_upload",
            response_time=(time.monotonic() - start) * 1000,
            response_length=len(_frame_data_url),
            exception=None,
        )
        # Match the real frontend's ~1fps capture interval rather than
        # hammering as fast as the socket allows.
        gevent.sleep(max(0.0, 1.0 - (time.monotonic() - start)))
