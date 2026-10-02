import type { FaceDetector } from "@mediapipe/tasks-vision";
import simdLoaderUrl from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import simdBinaryUrl from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import noSimdLoaderUrl from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url";
import noSimdBinaryUrl from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url";

/**
 * In-browser face tracking for the live preview overlay.
 *
 * The server analysis round trip (upload → inference → reply) can never keep a
 * box glued to a moving face: even when fast it is a few hundred ms behind and
 * only updates at the capture rate. BlazeFace short-range runs locally in a few
 * ms per frame, so the overlay can redraw on every video frame. The server
 * still owns every proctoring decision - this only drives what is drawn.
 */

/** Face box normalized to the intrinsic video frame: [x, y, width, height] in 0..1. */
export type NormalizedBox = [number, number, number, number];

const MODEL_URL = "/models/blaze_face_short_range.tflite";

let detectorPromise: Promise<FaceDetector | null> | null = null;
let lastTimestamp = 0;

async function createDetector(): Promise<FaceDetector> {
  const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const simd = await FilesetResolver.isSimdSupported();
  return FaceDetector.createFromOptions(
    {
      wasmLoaderPath: simd ? simdLoaderUrl : noSimdLoaderUrl,
      wasmBinaryPath: simd ? simdBinaryUrl : noSimdBinaryUrl,
    },
    {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
    },
  );
}

/** Lazily loads the shared detector; resolves `null` if it can't run here. */
export function loadFaceDetector(): Promise<FaceDetector | null> {
  if (!detectorPromise) {
    detectorPromise = createDetector().catch((e) => {
      console.warn("local face tracker unavailable, using server boxes", e);
      return null;
    });
  }
  return detectorPromise;
}

export function detectFaces(detector: FaceDetector, video: HTMLVideoElement): NormalizedBox[] {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return [];
  // VIDEO mode requires strictly increasing timestamps, and the detector is
  // shared by every overlay on the page.
  lastTimestamp = Math.max(performance.now(), lastTimestamp + 1);
  const result = detector.detectForVideo(video, lastTimestamp);
  const boxes: NormalizedBox[] = [];
  for (const det of result.detections) {
    const b = det.boundingBox;
    if (!b) continue;
    boxes.push([b.originX / vw, b.originY / vh, b.width / vw, b.height / vh]);
  }
  return boxes;
}
