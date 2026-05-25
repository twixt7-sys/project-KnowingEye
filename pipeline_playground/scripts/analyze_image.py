#!/usr/bin/env python3
"""Analyze a single image or video file."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from knowing_eye.pipeline import BehaviorPipeline  # noqa: E402
from knowing_eye.preprocessing.frame import decode_image  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path, help="Image or video path")
    parser.add_argument("--session-id", default="file-session")
    parser.add_argument("--reference", type=Path, help="Reference face image for identity check")
    parser.add_argument("--every-n", type=int, default=5, help="Analyze every Nth video frame")
    parser.add_argument("-o", "--output", type=Path, help="Write JSON lines to file")
    args = parser.parse_args()

    pipeline = BehaviorPipeline()
    if args.reference:
        if not pipeline.enroll_reference_path(args.reference):
            print("Warning: could not enroll reference face", file=sys.stderr)

    out_file = args.output.open("w", encoding="utf-8") if args.output else None
    suffix = args.input.suffix.lower()

    try:
        if suffix in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}:
            data = args.input.read_bytes()
            frame = decode_image(data)
            result = pipeline.analyze_frame(frame, session_id=args.session_id)
            line = json.dumps(result.to_dict())
            print(line)
            if out_file:
                out_file.write(line + "\n")
        else:
            cap = cv2.VideoCapture(str(args.input))
            idx = 0
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                if idx % args.every_n == 0:
                    result = pipeline.analyze_frame(frame, session_id=args.session_id)
                    line = json.dumps(result.to_dict())
                    print(line)
                    if out_file:
                        out_file.write(line + "\n")
                idx += 1
            cap.release()
    finally:
        pipeline.close()
        if out_file:
            out_file.close()


if __name__ == "__main__":
    main()
