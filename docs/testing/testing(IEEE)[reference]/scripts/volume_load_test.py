#!/usr/bin/env python3
"""
Staged HTTP volume test for LCC-OSAS public endpoints.
Simulates N concurrent virtual users per stage; each user performs one GET.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import aiohttp

DEFAULT_ENDPOINTS = [
    "/",
    "/osas/institutional-portal/login",
    "/departments",
    "/academic-years",
]

USER_AGENT = "LCC-OSAS-VolumeTest/1.0 (thesis-performance-validation)"


@dataclass
class RequestResult:
    status: Optional[int]
    latency_ms: float
    error: Optional[str] = None
    endpoint: str = ""


@dataclass
class StageResult:
    virtual_users: int
    total_requests: int
    successful: int
    failed: int
    success_rate_pct: float
    duration_sec: float
    requests_per_sec: float
    latency_ms: dict
    status_codes: dict
    errors_sample: List[str] = field(default_factory=list)


def percentile(sorted_values: List[float], p: float) -> float:
    if not sorted_values:
        return 0.0
    k = (len(sorted_values) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(sorted_values) - 1)
    if f == c:
        return sorted_values[f]
    return sorted_values[f] + (sorted_values[c] - sorted_values[f]) * (k - f)


async def fetch_one(
    session: aiohttp.ClientSession,
    base_url: str,
    path: str,
    timeout_sec: float,
) -> RequestResult:
    url = base_url.rstrip("/") + path
    start = time.perf_counter()
    try:
        async with session.get(
            url,
            timeout=aiohttp.ClientTimeout(total=timeout_sec),
            allow_redirects=True,
        ) as resp:
            await resp.read()
            elapsed = (time.perf_counter() - start) * 1000
            return RequestResult(status=resp.status, latency_ms=elapsed, endpoint=path)
    except Exception as exc:
        elapsed = (time.perf_counter() - start) * 1000
        return RequestResult(
            status=None,
            latency_ms=elapsed,
            error=type(exc).__name__ + ": " + str(exc)[:120],
            endpoint=path,
        )


async def run_stage(
    base_url: str,
    virtual_users: int,
    endpoints: List[str],
    timeout_sec: float,
    connector_limit: int,
) -> StageResult:
    connector = aiohttp.TCPConnector(limit=connector_limit, limit_per_host=connector_limit)
    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/json"}
    async with aiohttp.ClientSession(connector=connector, headers=headers) as session:
        tasks = []
        for i in range(virtual_users):
            path = endpoints[i % len(endpoints)]
            tasks.append(fetch_one(session, base_url, path, timeout_sec))
        t0 = time.perf_counter()
        results: List[RequestResult] = await asyncio.gather(*tasks)
        duration = time.perf_counter() - t0

    latencies = sorted(r.latency_ms for r in results)
    ok = [r for r in results if r.status is not None and 200 <= r.status < 400]
    failed = [r for r in results if r not in ok]
    status_codes: dict = {}
    for r in results:
        key = str(r.status) if r.status is not None else "error"
        status_codes[key] = status_codes.get(key, 0) + 1

    errors_sample = []
    for r in failed:
        if r.error and r.error not in errors_sample:
            errors_sample.append(r.error)
        if len(errors_sample) >= 5:
            break

    return StageResult(
        virtual_users=virtual_users,
        total_requests=len(results),
        successful=len(ok),
        failed=len(failed),
        success_rate_pct=round(100.0 * len(ok) / len(results), 2) if results else 0.0,
        duration_sec=round(duration, 3),
        requests_per_sec=round(len(results) / duration, 2) if duration > 0 else 0.0,
        latency_ms={
            "min": round(min(latencies), 2) if latencies else 0,
            "mean": round(statistics.mean(latencies), 2) if latencies else 0,
            "median": round(statistics.median(latencies), 2) if latencies else 0,
            "p90": round(percentile(latencies, 90), 2),
            "p95": round(percentile(latencies, 95), 2),
            "p99": round(percentile(latencies, 99), 2),
            "max": round(max(latencies), 2) if latencies else 0,
        },
        status_codes=status_codes,
        errors_sample=errors_sample,
    )


async def main_async(args: argparse.Namespace) -> dict:
    stages = [int(x.strip()) for x in args.stages.split(",")]
    endpoints = args.endpoints.split(",") if args.endpoints else DEFAULT_ENDPOINTS

    print(f"Target: {args.base_url}")
    print(f"Endpoints: {endpoints}")
    print(f"Stages (virtual users): {stages}")
    print(f"Timeout per request: {args.timeout}s")
    print("-" * 60)

    stage_results: List[StageResult] = []
    for n in stages:
        print(f"Running stage: {n} virtual users...", flush=True)
        result = await run_stage(
            args.base_url,
            n,
            endpoints,
            args.timeout,
            connector_limit=max(n, 100),
        )
        stage_results.append(result)
        print(
            f"  OK {result.successful}/{result.total_requests} "
            f"({result.success_rate_pct}%) | "
            f"{result.requests_per_sec} req/s | "
            f"p95 {result.latency_ms['p95']} ms"
        )
        if args.pause_between_stages > 0 and n != stages[-1]:
            await asyncio.sleep(args.pause_between_stages)

    return {
        "meta": {
            "tool": "volume_load_test.py",
            "captured_at_utc": datetime.now(timezone.utc).isoformat(),
            "base_url": args.base_url,
            "endpoints": endpoints,
            "stages_virtual_users": stages,
            "timeout_sec": args.timeout,
            "note": (
                "Each virtual user issues one concurrent GET. "
                "Stages are sequential; not a sustained soak test."
            ),
        },
        "stages": [asdict(s) for s in stage_results],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="LCC-OSAS staged volume load test")
    parser.add_argument(
        "--base-url",
        default="https://lcc-osas.com",
        help="Base URL (default: production)",
    )
    parser.add_argument(
        "--stages",
        default="100,500,1000,2500,5000",
        help="Comma-separated concurrent virtual user counts",
    )
    parser.add_argument(
        "--endpoints",
        default=",".join(DEFAULT_ENDPOINTS),
        help="Comma-separated paths to rotate across users",
    )
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--pause-between-stages", type=float, default=3.0)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "results-data"
        / "evidence"
        / "logs"
        / f"volume_load_test_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.json",
    )
    args = parser.parse_args()

    report = asyncio.run(main_async(args))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("-" * 60)
    print(f"Report saved: {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
