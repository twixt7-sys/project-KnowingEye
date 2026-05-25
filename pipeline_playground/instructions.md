# Knowing Eye — Startup Instructions

This guide gets the **web monitoring dashboard** and API running on your Windows machine.

## What you need first

| Requirement | Notes |
|-------------|--------|
| **Windows 10/11** | Tested on PowerShell |
| **Python 3.10+** | [python.org/downloads](https://www.python.org/downloads/) — check **“Add python.exe to PATH”** during install |
| **Webcam** (optional) | Only needed for live monitoring in the browser |
| **~2 GB disk** | Virtual environment + ML dependencies (YOLO may download weights on first run) |

Verify Python:

```powershell
python --version
```

You should see something like `Python 3.12.x`.

---

## Quick start (recommended)

1. Open **PowerShell** or **Windows Terminal**.
2. Go to the project folder:

   ```powershell
   cd C:\Users\Twixt\Desktop\knowing-eye-pipeline
   ```

3. Start the app (**note the `.\` prefix** — required in PowerShell):

   ```powershell
   .\start.ps1
   ```

4. Wait until you see **“Application startup complete”** (first launch can take 30–90 seconds while models load).
5. Open in your browser: **http://127.0.0.1:8090**
6. Stop the server with **Ctrl+C** in the terminal.

### Alternative: double-click or Command Prompt

- **Double-click** `start.cmd` in File Explorer, or
- From **cmd.exe**:

  ```cmd
  cd C:\Users\Twixt\Desktop\knowing-eye-pipeline
  start.cmd
  ```

`start.cmd` runs `start.ps1` with the correct path and execution policy.

---

## Why `start.ps1` alone does not work

In PowerShell, typing:

```powershell
start.ps1
```

fails with *“The term 'start.ps1' is not recognized”* even when you are in the project folder.

PowerShell does **not** run scripts from the current directory unless you prefix them:

```powershell
.\start.ps1
```

Use `.\` (backslash-dot), not just the filename.

---

## First-time manual setup (optional)

If you prefer to set things up yourself instead of using `start.ps1`:

```powershell
cd C:\Users\Twixt\Desktop\knowing-eye-pipeline
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn api.main:app --host 127.0.0.1 --port 8090
```

Then open **http://127.0.0.1:8090**.

---

## Troubleshooting

### “Running scripts is disabled on this system”

Use one of these:

```powershell
.\start.cmd
```

or:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

### `dlib` / `face-recognition` build error (Visual C++)

**You can ignore this and still run the app.** Core deps no longer include `face-recognition`. `.\start.ps1` installs it only if possible; otherwise it continues with a yellow warning and `identity_match` stays empty.

To enable identity matching later, install **Visual Studio Build Tools** with the **“Desktop development with C++”** workload, then:

```powershell
.\.venv\Scripts\Activate.ps1
pip install cmake
pip install -r requirements-identity.txt
```

Or install [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (free), restart the terminal, and run `pip install -r requirements-identity.txt` again.

### Port 8090 already in use

Another terminal may still be running the server. Either:

- Use the existing server: open **http://127.0.0.1:8090**, or
- Find and stop the process:

  ```powershell
  netstat -ano | findstr :8090
  taskkill /PID <pid_from_last_column> /F
  ```

Then run `.\start.ps1` again.

### Browser shows nothing / “connection refused”

- Confirm the terminal still shows the server running (no traceback).
- Wait for startup to finish after the first run (MediaPipe / YOLO initialization).
- Check health: in PowerShell,

  ```powershell
  Invoke-RestMethod http://127.0.0.1:8090/health
  ```

  Expected: `status: ok`.

### Webcam not working in the dashboard

- Allow camera access when the browser prompts.
- Use **Chrome** or **Edge** (recommended).
- Close other apps using the camera (Zoom, Teams, etc.).

---

## Other ways to run

### OpenCV webcam window (no browser)

```powershell
.\.venv\Scripts\Activate.ps1
python scripts/run_webcam.py --session-id demo-001
```

Press **Q** to quit.

### Analyze a single image

```powershell
.\.venv\Scripts\Activate.ps1
python scripts/analyze_image.py path\to\photo.jpg --session-id test-1
```

### Run tests

```powershell
.\.venv\Scripts\Activate.ps1
pip install pytest
pytest tests/ -q
```

---

## What `start.ps1` does

1. Changes to the project directory.
2. Creates `.venv` if missing.
3. Installs packages from `requirements.txt`.
4. Starts **Uvicorn** serving `api.main:app` on **http://127.0.0.1:8090**.

The dashboard lives at `/`; API health is at `/health`.

For architecture, API contracts, and integration with the main Django app, see **README.md**.
