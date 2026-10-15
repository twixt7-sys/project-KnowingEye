"""Run the Sprint 5 capacity-testing ladder end-to-end.

Directive Area 04 ("Capacity & performance", P0): drive the concurrency
ladder, measuring response time/CPU/RAM/network/error rate at each rung,
against a real running Django ASGI server (Daphne) - not a mocked target.

This script is deliberately conservative about how far it pushes the ladder
by default: it takes an explicit `--rungs` list rather than hardcoding the
Directive's full 5/10/20/30/50/100 sequence, because running the full
sequence with live ML inference (MediaPipe + InsightFace model loading) is
genuinely resource-heavy - see the "measured on" caveat this script writes
into every results row, and docs/documentation/chapter2/03-system-design.html
#capacity for why the full ladder wasn't run unattended on shared/
memory-constrained hardware.

Usage:
    cd backend && ..\\venv\\Scripts\\python.exe ..\\scripts\\load\\run_ladder.py --rungs 5 10 15

Requires: the backend venv (locust, websocket-client, psutil, Pillow all
already project dependencies or installed alongside locust), and enough
free RAM that the ASGI server + Locust + the ML models it loads won't swap.
Check free memory before running - see scripts/load/README.md.
"""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
import time
from pathlib import Path

import psutil

SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent.parent / "backend"
RESULTS_DIR = SCRIPT_DIR / "results"
RUN_TIME_SECONDS = 45
SPAWN_RATE = 5
HOST = "http://127.0.0.1:8877"  # dedicated port so this never collides with a dev server already running


def free_ram_gb() -> float:
    return psutil.virtual_memory().available / (1024 ** 3)


def start_server() -> subprocess.Popen:
    python = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
    proc = subprocess.Popen(
        [str(python), "-m", "daphne", "-b", "127.0.0.1", "-p", "8877", "core.config.asgi:application"],
        cwd=str(BACKEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    # Wait for the health endpoint rather than a fixed sleep.
    import urllib.request

    for _ in range(60):
        try:
            urllib.request.urlopen(f"{HOST}/api/monitoring/health/", timeout=1)
            return proc
        except Exception:
            time.sleep(1)
    proc.terminate()
    raise RuntimeError("Server did not become healthy within 60s - check daphne output.")


def seed(count: int) -> None:
    python = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
    subprocess.run(
        [str(python), "manage.py", "seed_load_test", "--count", str(count), "--out", "scripts/load/manifest.json"],
        cwd=str(BACKEND_DIR),
        check=True,
    )


def flush_seed() -> None:
    python = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
    subprocess.run(
        [str(python), "manage.py", "seed_load_test", "--flush"],
        cwd=str(BACKEND_DIR),
        check=True,
    )


class ResourceSampler:
    """Polls the server process TREE's CPU%/RSS on a background thread while a
    rung runs. Aggregates the root process plus any children, since
    Daphne/ASGI workers can spawn helper processes on some platforms - a
    single-PID sample silently undercounts real usage if that happens.

    Reuses the same psutil.Process object per pid across iterations -
    cpu_percent() is a stateful delta against that object's *own* last call,
    so re-querying children() fresh each loop (which returns brand-new
    Process instances) would report a false 0.0% on every single sample.
    """

    def __init__(self, pid: int):
        self.root_pid = pid
        self._tracked: dict[int, psutil.Process] = {}
        self.samples: list[tuple[float, float]] = []  # (cpu_pct, rss_mb)
        self._stop = False

    def _current_pids(self) -> set[int]:
        try:
            root = psutil.Process(self.root_pid)
            return {self.root_pid, *(c.pid for c in root.children(recursive=True))}
        except psutil.NoSuchProcess:
            return set()

    def _sync_tracked(self) -> list[psutil.Process]:
        live_pids = self._current_pids()
        for pid in live_pids - self._tracked.keys():
            try:
                p = psutil.Process(pid)
                p.cpu_percent()  # prime - first call always returns 0.0/garbage
                self._tracked[pid] = p
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        for pid in list(self._tracked.keys() - live_pids):
            del self._tracked[pid]
        return list(self._tracked.values())

    def run(self):
        self._sync_tracked()
        while not self._stop:
            time.sleep(0.5)
            procs = self._sync_tracked()
            if not procs:
                break
            cpu_total = 0.0
            rss_total = 0.0
            for p in procs:
                try:
                    cpu_total += p.cpu_percent()
                    rss_total += p.memory_info().rss / (1024 ** 2)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            self.samples.append((cpu_total, rss_total))

    def stop(self):
        self._stop = True

    def summary(self) -> dict:
        if not self.samples:
            return {"peak_cpu_pct": None, "peak_rss_mb": None, "avg_cpu_pct": None}
        cpus = [s[0] for s in self.samples]
        rss = [s[1] for s in self.samples]
        return {
            "peak_cpu_pct": round(max(cpus), 1),
            "avg_cpu_pct": round(sum(cpus) / len(cpus), 1),
            "peak_rss_mb": round(max(rss), 1),
        }


def run_rung(users: int, server_pid: int) -> dict:
    import threading

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    csv_prefix = str(RESULTS_DIR / f"rung-{users}")

    sampler = ResourceSampler(server_pid)
    sampler_thread = threading.Thread(target=sampler.run, daemon=True)
    sampler_thread.start()

    free_before = free_ram_gb()
    python = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
    result = subprocess.run(
        [
            str(python), "-m", "locust",
            "-f", str(SCRIPT_DIR / "locustfile.py"),
            "--host", HOST,
            "--users", str(users),
            "--spawn-rate", str(SPAWN_RATE),
            "--run-time", f"{RUN_TIME_SECONDS}s",
            "--headless",
            "--csv", csv_prefix,
            "--only-summary",
        ],
        cwd=str(SCRIPT_DIR),
        capture_output=True,
        text=True,
    )

    sampler.stop()
    sampler_thread.join(timeout=5)
    free_after = free_ram_gb()

    stats = _parse_locust_stats(csv_prefix)
    row = {
        "users": users,
        "free_ram_gb_before": round(free_before, 2),
        "free_ram_gb_after": round(free_after, 2),
        **sampler.summary(),
        **stats,
        "locust_exit_code": result.returncode,
    }
    if result.returncode != 0:
        row["locust_stderr_tail"] = result.stdout[-2000:]
    return row


def _parse_locust_stats(csv_prefix: str) -> dict:
    stats_file = Path(f"{csv_prefix}_stats.csv")
    if not stats_file.exists():
        return {"requests": 0, "failures": 0, "median_ms": None, "p95_ms": None, "rps": None}
    with stats_file.open(newline="") as f:
        rows = list(csv.DictReader(f))
    agg = next((r for r in rows if r["Name"] == "Aggregated"), None)
    if not agg:
        return {"requests": 0, "failures": 0, "median_ms": None, "p95_ms": None, "rps": None}
    return {
        "requests": int(agg["Request Count"]),
        "failures": int(agg["Failure Count"]),
        "median_ms": float(agg["Median Response Time"]),
        "p95_ms": float(agg["95%"]),
        "rps": float(agg["Requests/s"]),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rungs", type=int, nargs="+", default=[5, 10, 15])
    parser.add_argument("--min-free-gb", type=float, default=0.4, help="Abort the ladder if free RAM drops below this.")
    args = parser.parse_args()

    print(f"Free RAM before starting: {free_ram_gb():.2f} GB")
    if free_ram_gb() < args.min_free_gb:
        print("Not enough free RAM to safely start - aborting before touching the server.")
        sys.exit(1)

    server = start_server()
    print(f"Server up (pid={server.pid}).")
    results = []
    try:
        for users in args.rungs:
            if free_ram_gb() < args.min_free_gb:
                print(f"Free RAM below {args.min_free_gb} GB threshold - stopping the ladder early, before rung {users}.")
                break
            print(f"\n=== Rung: {users} concurrent examinees ===")
            seed(users)
            row = run_rung(users, server.pid)
            print(json.dumps(row, indent=2))
            results.append(row)
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()
        flush_seed()

    out_path = RESULTS_DIR / "ladder_results.json"
    out_path.write_text(json.dumps(results, indent=2))
    print(f"\nResults written to {out_path}")


if __name__ == "__main__":
    main()
