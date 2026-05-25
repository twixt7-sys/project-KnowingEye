#!/usr/bin/env python3
"""Live webcam demo of the Knowing Eye behavior pipeline."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from knowing_eye.pipeline import BehaviorPipeline  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Knowing Eye webcam playground")
    parser.add_argument("--session-id", default="playground-session")
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--no-display", action="store_true", help="Print JSON only, no window")
    parser.add_argument("--save", action="store_true", help="Append results to data/sessions/")
    args = parser.parse_args()

    pipeline = BehaviorPipeline()
    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        print("Error: cannot open webcam", file=sys.stderr)
        sys.exit(1)

    print("Press Q to quit. Open http://127.0.0.1:8090 for the web UI.")
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if args.save:
                result = pipeline.analyze_and_save(frame, args.session_id)
            else:
                result = pipeline.analyze_frame(frame, session_id=args.session_id)

            if args.no_display:
                print(json.dumps(result.to_dict()))
            else:
                _draw_overlay(frame, result)
                cv2.imshow("Knowing Eye — Playground", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
    finally:
        cap.release()
        pipeline.close()
        cv2.destroyAllWindows()


def _draw_overlay(frame, result) -> None:
    m = result.metrics
    t = m.alert_threshold_pct
    y = 28
    lines = [
        f"Compliance: {m.overall_compliance_pct:.0f}%",
        f"Face: {m.face_presence_pct:.0f}%  Gaze: {m.gaze_focus_pct:.0f}%",
        f"Posture: {m.posture_compliance_pct:.0f}%  Clear: {m.object_clear_pct:.0f}%",
        f"Alerts: {len(result.alerts)}  (threshold {t:.0f}%)",
    ]
    color = (52, 211, 153) if m.overall_compliance_pct >= t else (0, 165, 255)
    if m.overall_compliance_pct < t - 15:
        color = (71, 113, 248)
    for line in lines:
        cv2.putText(frame, line, (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)
        y += 24
    if result.face.bbox:
        x, y0, w, h = result.face.bbox
        bc = (52, 211, 153) if m.face_presence_pct >= t else (71, 113, 248)
        cv2.rectangle(frame, (x, y0), (x + w, y0 + h), bc, 2)


if __name__ == "__main__":
    main()
