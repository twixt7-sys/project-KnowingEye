"""Main behavior analysis pipeline - production implementation in backend/ai."""

from __future__ import annotations

import json
import logging
import threading
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

from ai.knowing_eye.behavior.overlay import norm_bbox_xywh, posture_guide_status
from ai.knowing_eye.behavior.scoring import BehaviorScorer
from ai.knowing_eye.behavior.temporal import BehaviorTemporalTracker
from ai.knowing_eye.config import load_config, resolve_path
from ai.knowing_eye.detection.face_detector import DetectedFace, FaceDetector
from ai.knowing_eye.detection.pose_detector import PoseDetector
from ai.knowing_eye.preprocessing.frame import prepare_frame_pair
from ai.knowing_eye.recognition.identity import IdentityVerifier, fuse_embeddings
from ai.knowing_eye.types import (
    FaceAnalysis,
    FrameAnalysisResult,
    PostureAnalysis,
    utc_now_iso,
)

logger = logging.getLogger("knowing_eye.ai.pipeline")


@dataclass
class _IdentityTrack:
    """Per-session identity state: a rolling window of recent cosine distances."""

    distances: deque = field(default_factory=deque)
    frames_seen: int = 0
    last_check_frame: int | None = None
    absent_frames: int = 0
    reference_key: tuple | None = None
    # Bumped whenever the window is cleared, so a background check that started
    # before the reset can't drop the previous person's distance into it.
    generation: int = 0


def _largest_face(faces: list[DetectedFace]) -> DetectedFace | None:
    # MediaPipe returns faces in no particular order; the examinee is the one
    # nearest the camera, i.e. the largest box.
    return max(faces, key=lambda f: f.bbox[2] * f.bbox[3]) if faces else None


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
        det = self.config.get("detection", {})
        self._pose = PoseDetector(
            shoulder_tilt_max=rec.get("posture_shoulder_tilt_max", 0.18),
            spine_lean_max=rec.get("posture_spine_lean_max", 0.30),
            model=str(det.get("pose_model", "full")),
            min_visibility=float(det.get("pose_min_visibility", 0.5)),
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
        self._identity_window = max(1, int(rec.get("identity_smoothing_window", 5)))
        self._identity_min_face_px = int(rec.get("identity_min_face_px", 64))
        self._identity_max_yaw = float(rec.get("identity_max_yaw_deg", 30))
        self._identity_max_pitch = float(rec.get("identity_max_pitch_deg", 30))
        self._identity_tracks: dict[str, _IdentityTrack] = {}

        # MediaPipe landmarkers and the temporal tracker are shared by every
        # session and aren't safe to call concurrently; frames now arrive from
        # a worker pool rather than one serialized thread, so guard them here.
        self._lock = threading.Lock()
        # ArcFace (full-frame RetinaFace + ResNet embedding) costs several times
        # the MediaPipe pass. When async, it runs on its own thread and each
        # frame reports the rolling median of the checks finished so far, so the
        # bounding-box reply never waits on it.
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

    @property
    def identity_threshold(self) -> float:
        return self._identity.threshold

    def _prepare(self, frame_bgr: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        return prepare_frame_pair(frame_bgr, self.config)

    def _detect_primary_face(self, frame: np.ndarray) -> DetectedFace | None:
        with self._lock:
            faces = self._face.detect(frame)
        return _largest_face(faces)

    def _identity_quality_ok(self, face: DetectedFace) -> bool:
        """Only compare faces the recognizer can judge reliably.

        ArcFace distances rise sharply for small or strongly rotated faces, so a
        genuine examinee looking down at notes would read as a "different
        person". Such frames are skipped (identity carries over) rather than
        scored.
        """
        _, _, w, h = face.bbox
        if min(w, h) < self._identity_min_face_px:
            return False
        return (
            abs(face.head_yaw_deg) <= self._identity_max_yaw
            and abs(face.head_pitch_deg) <= self._identity_max_pitch
        )

    def enroll_reference(self, frame_bgr: np.ndarray) -> bool:
        raw, frame = self._prepare(frame_bgr)
        face = self._detect_primary_face(frame)
        if face is None:
            return False
        return self._identity.enroll_from_frame(raw, face.bbox)

    def enroll_reference_path(self, path: str | Path) -> bool:
        return self._identity.enroll_from_path(path)

    def compute_embedding(self, frame_bgr: np.ndarray) -> list[float] | None:
        raw, frame = self._prepare(frame_bgr)
        face = self._detect_primary_face(frame)
        if face is None:
            return None
        return self._identity.embed(raw, face.bbox)

    def compute_enrollment_embedding(self, frames_bgr: list[np.ndarray]) -> list[float] | None:
        """Build one reference template from several enrollment frames.

        Frames whose face passes the identity quality gate are preferred; if
        none do, any detected face is used so enrollment never hard-fails on a
        slightly off-angle capture.
        """
        good: list[list[float]] = []
        fallback: list[list[float]] = []
        for frame_bgr in frames_bgr:
            raw, frame = self._prepare(frame_bgr)
            face = self._detect_primary_face(frame)
            if face is None:
                continue
            emb = self._identity.embed(raw, face.bbox)
            if emb is None:
                continue
            (good if self._identity_quality_ok(face) else fallback).append(emb)
        samples = good or fallback
        if not samples:
            return None
        return fuse_embeddings(samples, max_cosine_distance=self._identity.threshold)

    def _verify_identity(
        self,
        session_id: str | None,
        raw: np.ndarray,
        face: DetectedFace | None,
        reference_embedding: list[float] | None,
    ) -> tuple[bool | None, float | None]:
        """Rolling-median identity decision for one session.

        * ArcFace runs every ``identity_check_every_n_frames`` frames of *this*
          session (it is far heavier than MediaPipe) and only on quality-gated
          faces - inline, or on the background worker when ``identity_async``.
        * The reported distance is the median of the last
          ``identity_smoothing_window`` checks, so one blurred or mid-blink frame
          can't raise a mismatch, while a real swap flips the median within a
          few checks.
        * The window resets once the face has left the frame, so whoever sits
          down afterwards is judged on their own frames only.
        """
        if reference_embedding is None:
            return None, None
        key = session_id or "__anonymous__"
        ref_key = tuple(round(float(x), 6) for x in reference_embedding[:8])
        with self._identity_lock:
            track = self._identity_tracks.get(key)
            if track is None or track.reference_key != ref_key:
                track = _IdentityTrack(
                    distances=deque(maxlen=self._identity_window), reference_key=ref_key
                )
                self._identity_tracks[key] = track
            track.frames_seen += 1

            if face is None:
                track.absent_frames += 1
                if track.absent_frames >= 2 and track.distances:
                    track.distances.clear()
                    track.last_check_frame = None
                    track.generation += 1
                return None, None
            track.absent_frames = 0

            due = (
                track.last_check_frame is None
                or (track.frames_seen - track.last_check_frame) >= self._identity_check_every
            )
            run = due and self._identity_quality_ok(face)
            if run:
                track.last_check_frame = track.frames_seen
            generation = track.generation

        if run and self._identity_async:
            self._submit_identity(key, track, generation, raw, face.bbox, reference_embedding)
        elif run:
            _, dist = self._identity.verify_against(raw, face.bbox, reference_embedding)
            self._record_distance(track, generation, dist)

        with self._identity_lock:
            if not track.distances:
                return None, None
            median = float(np.median(track.distances))
        return median <= self._identity.threshold, median

    def _record_distance(self, track: _IdentityTrack, generation: int, dist: float | None) -> None:
        if dist is None:  # couldn't embed - unknown, not a mismatch
            return
        with self._identity_lock:
            if track.generation == generation:
                track.distances.append(float(dist))

    def _submit_identity(
        self,
        key: str,
        track: _IdentityTrack,
        generation: int,
        raw: np.ndarray,
        bbox: tuple[int, int, int, int],
        reference: list[float],
    ) -> None:
        with self._identity_lock:
            if key in self._identity_inflight or self._identity_executor is None:
                return
            self._identity_inflight.add(key)

        def _job() -> None:
            try:
                _, dist = self._identity.verify_against(raw, bbox, reference)
                self._record_distance(track, generation, dist)
            except Exception:  # noqa: BLE001 - keep the window as it was
                logger.exception("background identity check failed for %s", key)
            finally:
                with self._identity_lock:
                    self._identity_inflight.discard(key)

        self._identity_executor.submit(_job)

    def analyze_frame(
        self,
        frame_bgr: np.ndarray,
        session_id: str | None = None,
        reference_embedding: list[float] | None = None,
    ) -> FrameAnalysisResult:
        raw, frame = self._prepare(frame_bgr)
        fh, fw = frame.shape[:2]

        with self._lock:
            faces = self._face.detect(frame)
            pose = self._pose.detect(frame)
        primary = _largest_face(faces)

        identity_match, identity_distance = self._verify_identity(
            session_id, raw, primary, reference_embedding
        )

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
