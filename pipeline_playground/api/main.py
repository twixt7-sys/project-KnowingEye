"""
FastAPI playground server for Knowing Eye CV pipeline.
Mirrors planned POST /api/monitoring/frame/ contract for Django integration testing.
"""

from __future__ import annotations

import base64
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from pathlib import Path

from knowing_eye.pipeline import BehaviorPipeline
from knowing_eye.preprocessing.frame import decode_image

_STATIC = Path(__file__).resolve().parent / "static"
_pipeline: BehaviorPipeline | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _pipeline
    _pipeline = BehaviorPipeline()
    yield
    if _pipeline:
        _pipeline.close()


app = FastAPI(
    title="Knowing Eye — CV Pipeline Playground",
    description="Facial and postural behavior analysis API for integration testing",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
if _STATIC.exists():
    app.mount("/static", StaticFiles(directory=str(_STATIC)), name="static")


@app.get("/")
def dashboard() -> FileResponse:
    index = _STATIC / "index.html"
    if not index.exists():
        raise HTTPException(404, "UI not found")
    return FileResponse(index)


class FrameBase64Request(BaseModel):
    image: str = Field(..., description="Base64-encoded image (optionally data:image/... prefix)")
    session_id: str | None = None


class EnrollRequest(BaseModel):
    image: str
    session_id: str | None = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "knowing-eye-pipeline"}


@app.post("/analyze/frame")
def analyze_frame(body: FrameBase64Request) -> dict[str, Any]:
    if _pipeline is None:
        raise HTTPException(503, "Pipeline not initialized")
    try:
        frame = decode_image(body.image)
    except Exception as e:
        raise HTTPException(400, f"Invalid image: {e}") from e
    result = _pipeline.analyze_frame(frame, session_id=body.session_id)
    return {"status": "ok", "analysis": result.to_dict()}


@app.post("/analyze/upload")
async def analyze_upload(
    file: UploadFile = File(...),
    session_id: str | None = None,
) -> dict[str, Any]:
    if _pipeline is None:
        raise HTTPException(503, "Pipeline not initialized")
    data = await file.read()
    frame = decode_image(data)
    result = _pipeline.analyze_frame(frame, session_id=session_id)
    return {"status": "ok", "analysis": result.to_dict()}


@app.post("/enroll/reference")
def enroll_reference(body: EnrollRequest) -> dict[str, Any]:
    if _pipeline is None:
        raise HTTPException(503, "Pipeline not initialized")
    frame = decode_image(body.image)
    ok = _pipeline.enroll_reference(frame)
    if not ok:
        raise HTTPException(400, "Could not enroll reference face — ensure one clear face is visible")
    return {"status": "ok", "message": "Reference face enrolled", "session_id": body.session_id}


@app.websocket("/ws/monitor")
async def ws_monitor(websocket: WebSocket):
    """Stream base64 JPEG frames; receive analysis_result JSON per frame."""
    await websocket.accept()
    if _pipeline is None:
        await websocket.close(code=1011)
        return
    try:
        while True:
            msg = await websocket.receive_json()
            if msg.get("type") == "frame_stream":
                b64 = msg.get("image", "")
                session_id = msg.get("session_id")
                frame = decode_image(b64)
                result = _pipeline.analyze_frame(frame, session_id=session_id)
                await websocket.send_json(
                    {
                        "type": "analysis_result",
                        "payload": result.to_dict(),
                    }
                )
            elif msg.get("type") == "enroll":
                frame = decode_image(msg.get("image", ""))
                ok = _pipeline.enroll_reference(frame)
                await websocket.send_json({"type": "enroll_result", "success": ok})
    except WebSocketDisconnect:
        pass


# Django-compatible alias
@app.post("/api/monitoring/frame/")
def monitoring_frame_compat(body: FrameBase64Request) -> dict[str, Any]:
    """Same shape as planned main-system monitoring fallback endpoint."""
    out = analyze_frame(body)
    return {
        "status": out["status"],
        "message": "Frame analyzed",
        "analysis": out["analysis"],
    }
