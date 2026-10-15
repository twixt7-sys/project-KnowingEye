# Load testing harness (Directive Area 04 - "Capacity & performance", P0)

Drives both paths the Directive calls out as needing testing: the REST
`/api/monitoring/health/` baseline, and - the one that actually breaks, and
the one nobody tests by accident - the WebSocket snapshot-upload channel
(`/ws/monitoring/<session_id>/`) that every examinee's browser streams
frames into during a monitored exam.

## Files

- `frame_fixture.py` - builds a synthetic ~480px JPEG data URL matching the
  real frontend's capture profile (`frontend/src/shared/hooks/use-monitoring.ts`:
  1 fps, quality 0.6, max width 480px), so payload size is realistic without
  needing an actual webcam photo.
- `locustfile.py` - the Locust user classes. `FrameUploadUser` opens the
  monitoring WebSocket for one seeded examinee session and uploads frames at
  the real ~1fps cadence, waiting for the server's per-frame response before
  sending the next (so measured latency reflects real backend cost, not an
  unrealistic firehose). `HealthCheckUser` polls the lightweight REST health
  endpoint as a baseline.
- `run_ladder.py` - orchestrates a full rung: seeds N examinee
  sessions/JWTs via `manage.py seed_load_test`, starts a real Daphne ASGI
  server on a dedicated port (8877, so it never collides with a dev server
  you might already have running), runs Locust headless against it while
  sampling the server's CPU%/RSS (aggregated across its full process tree)
  on a background thread, and writes `results/ladder_results.json`.
- `../../backend/core/management/commands/seed_load_test.py` - creates real,
  distinct, authenticated examinee users + IN_PROGRESS sessions (not one
  shared session) so the load test exercises the same per-user ownership
  checks (`ExamSessionViewSet`/`MonitoringConsumer`) production traffic
  would hit. `--flush` tears the fixtures back down.

## Running it

```bash
cd backend
..\venv\Scripts\python.exe -m pip install locust websocket-client psutil   # one-time
cd ..\scripts\load
..\backend\venv\Scripts\python.exe run_ladder.py --rungs 5 10 20 30 50 100
```

**Check free system RAM before running** (`Get-CimInstance Win32_OperatingSystem`
on Windows, `free -h` on Linux) - `run_ladder.py` refuses to start (and stops
early between rungs) if free RAM drops below `--min-free-gb` (default 0.4),
but that floor exists to avoid an outright crash, not to guarantee a *clean*
result - see "Known limitation" below.

## Directive ladder

5 -> 10 -> 20 -> 30 -> 50 -> 100 concurrent examinees, measuring response
time / CPU / RAM / network / error rate at each rung, to answer: can the
system handle ~30 examinees in one room, and ~100 overall?

## Status as of this Sprint 5 pass

**The harness is built, debugged, and validated working** - not hypothetical.
Three real bugs were found and fixed while validating it end-to-end:

1. A double-relative-path bug in `seed_load_test --out` (manifest was being
   written outside the repo entirely).
2. `_flush()` deleted load-test users before the `Exam` that references one
   of them via `created_by` (`on_delete=PROTECT`), raising `ProtectedError`.
3. The resource sampler originally called `psutil.Process(pid).children()`
   fresh on every poll, which returns brand-new `Process` objects each time -
   and a freshly-constructed `Process`'s `cpu_percent()` always reports 0.0%
   on its first read (no prior CPU-time snapshot to diff against). Fixed by
   caching `Process` objects per pid across polls.

**Known limitation - the full ladder has not been run on this hardware.**
This session's development machine had well under 1 GB of free system RAM
(fluctuating 0.19-0.94 GB across repeated checks) for reasons unrelated to
this test - other applications already running on a shared machine, not
anything this harness or the app under test caused. Two `--rungs 3` runs
were completed for validation:

| Host free RAM before | Requests | Failures | Median | p95 | Peak RSS |
|---|---|---|---|---|---|
| 0.55 GB (comfortable) | 90 | 0 | 670 ms | 1.9 s | 272 MB |
| 0.44 GB (tight, dropped to 0.27 GB during) | 12 | 2 | 98 ms | **164 s** | 271 MB |

The app's own memory footprint was nearly identical in both runs (~271-272 MB
RSS) - the second run's collapse was **OS-level memory contention on the
host**, not the application leaking or scaling badly. That is itself a real,
useful capacity-planning finding (see
`docs/documentation/chapter2/03-system-design.html#capacity`): provision
production servers with real headroom beyond the app's own footprint, not
just enough to fit it.

**Re-run the full 5/10/20/30/50/100 ladder on hardware with confirmed free
RAM/CPU headroom** (a dedicated VM or bare server, not a shared laptop mid
other work) to get the Directive's actual target-concurrency numbers. The
harness is ready to do that with a single command - see above.
