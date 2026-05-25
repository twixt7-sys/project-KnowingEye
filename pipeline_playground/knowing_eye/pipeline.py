"""Main behavior analysis pipeline — integrate into Django ai/ module later."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

from knowing_eye.behavior.scoring import BehaviorScorer
from knowing_eye.config import load_config, resolve_path
from knowing_eye.detection.face_detector import FaceDetector
from knowing_eye.detection.pose_detector import PoseDetector
from knowing_eye.detection.yolo_detector import YoloDetector
from knowing_eye.preprocessing.frame import resize_frame
from knowing_eye.recognition.identity import IdentityVerifier
from knowing_eye.types import FrameAnalysisResult, utc_now_iso


class BehaviorPipeline:
    """
    Orchestrates face, posture, object detection and behavior scoring.
    Output uses 0–100% compliance metrics; alerts fire below alert_threshold_pct (default 80%).
    """

    def __init__(self, config_path: str | Path | None = None) -> None:
        self.config = load_config(config_path)
        rec = self.config.get("recognition", {})
        det = self.config.get("detection", {})

        self._face = FaceDetector()
        self._pose = PoseDetector(
            shoulder_tilt_max=rec.get("posture_shoulder_tilt_max", 0.12),
        )
        self._yolo = YoloDetector(
            model_path=det.get("yolo_model", "yolov8n.pt"),
            confidence=det.get("yolo_confidence", 0.45),
            target_classes=det.get("yolo_target_classes", [0, 67]),
        )
        self._identity = IdentityVerifier(
            match_threshold=self.config.get("pipeline", {}).get("identity_match_threshold", 0.6),
        )
        self._scorer = BehaviorScorer(self.config)
        self._frame_index = 0

    def enroll_reference(self, frame_bgr: np.ndarray) -> bool:
        frame = resize_frame(frame_bgr)
        faces = self._face.detect(frame)
        if not faces:
            return False
        return self._identity.enroll_from_frame(frame, faces[0].bbox)

    def enroll_reference_path(self, path: str | Path) -> bool:
        return self._identity.enroll_from_path(path)

    def analyze_frame(
        self,
        frame_bgr: np.ndarray,
        session_id: str | None = None,
    ) -> FrameAnalysisResult:
        frame = resize_frame(frame_bgr)
        faces = self._face.detect(frame)
        pose = self._pose.detect(frame)
        yolo_dets = self._yolo.detect(frame)

        identity_match: bool | None = None
        identity_distance: float | None = None
        if faces and self._identity.enrolled:
            identity_match, identity_distance = self._identity.verify(frame, faces[0].bbox)
        elif faces and not self._identity.enrolled:
            self._identity.enroll_from_frame(frame, faces[0].bbox)

        face_analysis = self._scorer.build_face_analysis(faces, identity_match, identity_distance)
        posture_analysis = self._scorer.build_posture_analysis(pose)
        objects = self._scorer.build_objects(yolo_dets)

        metrics, events, alerts = self._scorer.score(
            face_analysis,
            posture_analysis,
            objects,
            pose_detected=pose.detected,
            identity_match=identity_match,
        )

        self._frame_index += 1
        return FrameAnalysisResult(
            session_id=session_id,
            timestamp=utc_now_iso(),
            face=face_analysis,
            posture=posture_analysis,
            objects=objects,
            metrics=metrics,
            events=events,
            alerts=alerts,
            frame_index=self._frame_index,
        )

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
