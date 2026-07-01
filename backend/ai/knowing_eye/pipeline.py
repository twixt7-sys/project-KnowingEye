"""Main behavior analysis pipeline - production implementation in backend/ai."""

from __future__ import annotations

import json
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


class BehaviorPipeline:
    """
    Orchestrates preprocessing, face/pose/object detection, identity verification,
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
        )
        pipe = self.config.get("pipeline", {})
        identity_threshold = rec.get(
            "identity_match_threshold", pipe.get("identity_match_threshold")
        )
        self._identity = IdentityVerifier(
            match_threshold=identity_threshold,
            backend=rec.get("embedding_backend", "arcface"),
            arcface_model=rec.get("arcface_model", "buffalo_l"),
        )
        self._scorer = BehaviorScorer(self.config)
        self._temporal = BehaviorTemporalTracker(self.config)
        self._frame_index = 0

    @property
    def enrolled(self) -> bool:
        return bool(getattr(self._identity, "enrolled", False))

    def _prepare(self, frame_bgr: np.ndarray) -> np.ndarray:
        return prepare_frame(frame_bgr, self.config)

    def enroll_reference(self, frame_bgr: np.ndarray) -> bool:
        frame = self._prepare(frame_bgr)
        faces = self._face.detect(frame)
        if not faces:
            return False
        return self._identity.enroll_from_frame(frame, faces[0].bbox)

    def enroll_reference_path(self, path: str | Path) -> bool:
        return self._identity.enroll_from_path(path)

    def compute_embedding(self, frame_bgr: np.ndarray) -> list[float] | None:
        frame = self._prepare(frame_bgr)
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

        faces = self._face.detect(frame)
        pose = self._pose.detect(frame)

        identity_match: bool | None = None
        identity_distance: float | None = None
        if faces and reference_embedding is not None:
            identity_match, identity_distance = self._identity.verify_against(
                frame, faces[0].bbox, reference_embedding
            )

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
        )
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
        self._face.close()
        self._pose.close()
