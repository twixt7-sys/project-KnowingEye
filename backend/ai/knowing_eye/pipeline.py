"""Main behavior analysis pipeline - production implementation in backend/ai."""

from __future__ import annotations

import json
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import numpy as np

from ai.knowing_eye.behavior.overlay import norm_bbox_xywh, posture_guide_status
from ai.knowing_eye.behavior.scoring import BehaviorScorer
from ai.knowing_eye.behavior.temporal import BehaviorTemporalTracker
from ai.knowing_eye.config import load_config, resolve_path
from ai.knowing_eye.detection.face_detector import FaceDetector
from ai.knowing_eye.detection.pose_detector import PoseDetector
from ai.knowing_eye.preprocessing.frame import prepare_frame
from ai.knowing_eye.recognition.identity import IdentityVerifier
from ai.knowing_eye.types import (
    FaceAnalysis,
    FrameAnalysisResult,
    PostureAnalysis,
    utc_now_iso,
)

logger = logging.getLogger("knowing_eye.ai.pipeline")


class BehaviorPipeline:
    """
    Orchestrates preprocessing, face/pose detection, identity verification,
    behavior scoring, and temporal rules.

    Model roles (§2.1.4.3):
      * MediaPipe - face landmarks, gaze angles, posture keypoints
      * ArcFace (InsightFace) - 512-D CNN embeddings for identity verification
    """

    def __init__(self, config_path: str | Path | None = None) -> None:
        self.config = load_config(config_path)
        rec = self.config.get("recognition", {})

        self._face = FaceDetector()
        self._pose = PoseDetector(
            shoulder_tilt_max=rec.get("posture_shoulder_tilt_max", 0.12),
            spine_lean_max=rec.get("posture_spine_lean_max", 0.55),
        )
        pipe = self.config.get("pipeline", {})
        identity_threshold = rec.get(
            "identity_match_threshold", pipe.get("identity_match_threshold")
        )
        self._identity = IdentityVerifier(
            match_threshold=identity_threshold,
            backend=rec.get("embedding_backend", "arcface"),
            arcface_model=rec.get("arcface_model", "buffalo_l"),
            arcface_det_size=int(rec.get("arcface_det_size", 640)),
        )
        self._scorer = BehaviorScorer(self.config)
        self._temporal = BehaviorTemporalTracker(self.config)
        self._frame_index = 0
        self._identity_check_every = max(1, int(pipe.get("identity_check_every_n_frames", 3)))
        self._identity_cache: dict[str, tuple[bool | None, float | None, int]] = {}
        self._session_frames: dict[str, int] = {}

        # MediaPipe landmarkers and the temporal tracker are shared by every
        # session and aren't safe to call concurrently; frames now arrive from
        # a worker pool rather than one serialized thread, so guard them here.
        self._lock = threading.Lock()
        # ArcFace (full-frame RetinaFace + ResNet embedding) costs several times
        # the MediaPipe pass. When async, it runs on its own thread and each
        # frame reuses the latest finished result, so the bounding-box reply
        # never waits on it.
        self._identity_async = bool(pipe.get("identity_async", False))
        self._identity_lock = threading.Lock()
        self._identity_inflight: set[str] = set()
        self._identity_executor: ThreadPoolExecutor | None = (
            ThreadPoolExecutor(max_workers=1, thread_name_prefix="ke-identity")
            if self._identity_async
            else None
        )

        logger.info(
            "BehaviorPipeline detectors ready: face_backend=%s pose_backend=%s "
            "(non-mediapipe means the weaker OpenCV fallback is active - check "
            "if mediapipe model downloads/imports are failing in this environment)",
            self._face.backend,
            self._pose.backend,
        )

    @property
    def enrolled(self) -> bool:
        return bool(getattr(self._identity, "enrolled", False))

    def _prepare(self, frame_bgr: np.ndarray) -> np.ndarray:
        return prepare_frame(frame_bgr, self.config)

    def enroll_reference(self, frame_bgr: np.ndarray) -> bool:
        frame = self._prepare(frame_bgr)
        with self._lock:
            faces = self._face.detect(frame)
        if not faces:
            return False
        return self._identity.enroll_from_frame(frame, faces[0].bbox)

    def enroll_reference_path(self, path: str | Path) -> bool:
        return self._identity.enroll_from_path(path)

    def compute_embedding(self, frame_bgr: np.ndarray) -> list[float] | None:
        frame = self._prepare(frame_bgr)
        with self._lock:
            faces = self._face.detect(frame)
        if not faces:
            return None
        return self._identity.embed(frame, faces[0].bbox)

    def analyze_frame(
        self,
        frame_bgr: np.ndarray,
        session_id: str | None = None,
        reference_embedding: list[float] | None = None,
    ) -> FrameAnalysisResult:
        frame = self._prepare(frame_bgr)
        fh, fw = frame.shape[:2]
        cache_key = session_id or "__anonymous__"

        with self._lock:
            faces = self._face.detect(frame)
            pose = self._pose.detect(frame)
            # Per-session counter: a single global one made the "every N frames"
            # identity throttle shrink as more examinees streamed at once.
            session_frame = self._session_frames.get(cache_key, 0) + 1
            self._session_frames[cache_key] = session_frame

        identity_match: bool | None = None
        identity_distance: float | None = None
        if faces and reference_embedding is not None:
            # ArcFace re-detects the face over the whole frame internally, so it is far
            # heavier than the MediaPipe pass above - throttle it so a slow identity check
            # doesn't delay every displayed bounding box (see identity_check_every_n_frames).
            with self._identity_lock:
                cached = self._identity_cache.get(cache_key)
            due = cached is None or (session_frame - cached[2]) >= self._identity_check_every
            if due and self._identity_async:
                self._submit_identity(cache_key, frame, faces[0].bbox, reference_embedding, session_frame)
            elif due:
                cached = (
                    *self._identity.verify_against(frame, faces[0].bbox, reference_embedding),
                    session_frame,
                )
                with self._identity_lock:
                    self._identity_cache[cache_key] = cached
            if cached is not None:
                identity_match, identity_distance = cached[0], cached[1]

        primary = faces[0] if faces else None
        face_bbox_norm = None
        if primary and primary.bbox:
            face_bbox_norm = norm_bbox_xywh(primary.bbox, fw, fh)

        face_analysis = FaceAnalysis(
            count=len(faces),
            head_yaw_deg=primary.head_yaw_deg if primary else None,
            head_pitch_deg=primary.head_pitch_deg if primary else None,
            bbox=list(primary.bbox) if primary and primary.bbox else None,
            bbox_norm=face_bbox_norm,
            identity_distance=identity_distance,
        )
        posture_analysis = PostureAnalysis(
            detected=pose.detected,
            shoulder_tilt_ratio=pose.shoulder_tilt_ratio,
            spine_lean_ratio=pose.spine_lean_ratio,
            guide_status=posture_guide_status(
                pose_detected=pose.detected,
                face_count=len(faces),
            ),
            upper_body_visibility=pose.upper_body_visibility,
        )

        with self._lock:
            metrics, events, alerts = self._scorer.score(
                face_analysis,
                posture_analysis,
                pose_detected=pose.detected,
                identity_match=identity_match,
            )
            self._frame_index += 1
            result = FrameAnalysisResult(
                session_id=session_id,
                timestamp=utc_now_iso(),
                face=face_analysis,
                posture=posture_analysis,
                metrics=metrics,
                events=events,
                alerts=alerts,
                frame_index=self._frame_index,
                frame_size=[fw, fh],
            )
            if session_id:
                result = self._temporal.apply(str(session_id), result, pose_detected=pose.detected)
        return result

    def _submit_identity(
        self,
        cache_key: str,
        frame: np.ndarray,
        bbox: tuple[int, int, int, int],
        reference: list[float],
        session_frame: int,
    ) -> None:
        with self._identity_lock:
            if cache_key in self._identity_inflight or self._identity_executor is None:
                return
            self._identity_inflight.add(cache_key)

        def _job() -> None:
            try:
                match, dist = self._identity.verify_against(frame, bbox, reference)
                with self._identity_lock:
                    self._identity_cache[cache_key] = (match, dist, session_frame)
            except Exception:  # noqa: BLE001 - keep the last good result
                logger.exception("background identity check failed for %s", cache_key)
            finally:
                with self._identity_lock:
                    self._identity_inflight.discard(cache_key)

        self._identity_executor.submit(_job)

    def analyze_and_save(
        self,
        frame_bgr: np.ndarray,
        session_id: str,
        output_dir: str | Path | None = None,
    ) -> FrameAnalysisResult:
        result = self.analyze_frame(frame_bgr, session_id=session_id)
        base = Path(output_dir) if output_dir else resolve_path(self.config, "sessions_output_dir")
        session_dir = base / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        log_path = session_dir / "behavior_log.jsonl"
        with log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(result.to_dict()) + "\n")
        return result

    def close(self) -> None:
        if self._identity_executor is not None:
            self._identity_executor.shutdown(wait=True)
        self._face.close()
        self._pose.close()
