import type { FaceDetector } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";

import type { FrameAnalysis } from "../../../core/config/api";
import { detectFaces, loadFaceDetector, type NormalizedBox } from "../../lib/face-tracker";
import { PostureSilhouette } from "./posture-silhouette";

interface MonitoringVideoOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  analysis: FrameAnalysis | null;
  showPostureGuide?: boolean;
  /** Flip detection boxes to match a CSS-mirrored selfie preview. */
  mirrored?: boolean;
  /** `compact` for small floating feeds; `default` for setup. */
  guideSize?: "default" | "compact";
}

const GUIDE_PADDING = {
  default: "p-[1%]",
  compact: "p-[2%]",
} as const;

/** Cap local detection at ~30 fps - webcams rarely deliver more. */
const MIN_DETECT_INTERVAL_MS = 1000 / 30;

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/**
 * Maps a box normalized to the intrinsic video frame onto the element's box,
 * honoring `object-fit: cover` cropping (the previews are 16:9 and 3:4 while
 * webcams deliver 4:3, so stretching the normalized box would misplace it).
 */
function toDisplayRect(
  box: NormalizedBox,
  video: HTMLVideoElement,
  cover: boolean,
  mirrored: boolean,
): [number, number, number, number] {
  const cw = video.clientWidth;
  const ch = video.clientHeight;
  const vw = video.videoWidth || cw;
  const vh = video.videoHeight || ch;
  const scale = cover ? Math.max(cw / vw, ch / vh) : Math.min(cw / vw, ch / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const ox = (cw - dw) / 2;
  const oy = (ch - dh) / 2;
  const [nx, ny, nw, nh] = box;
  const w = nw * dw;
  const h = nh * dh;
  const x = ox + nx * dw;
  // The preview is mirrored with a CSS transform about the element's center.
  return [mirrored ? cw - x - w : x, oy + ny * dh, w, h];
}

export function MonitoringVideoOverlay({
  videoRef,
  analysis,
  showPostureGuide = true,
  mirrored = false,
  guideSize = "default",
}: MonitoringVideoOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coverRef = useRef(true);
  const [detector, setDetector] = useState<FaceDetector | null>(null);

  const faceCount = analysis?.face?.count ?? 0;
  const guideOk =
    faceCount === 1 &&
    (analysis?.posture?.guide_status === "ok" ||
      analysis?.posture?.detected ||
      (analysis?.metrics?.face_presence_pct ?? 0) >= 80);

  useEffect(() => {
    let cancelled = false;
    void loadFaceDetector().then((d) => {
      if (!cancelled) setDetector(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const draw = useCallback(
    (boxes: NormalizedBox[]) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      const w = video.clientWidth;
      const h = video.clientHeight;
      if (!w || !h) return;

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      if (boxes.length === 0) return;

      ctx.strokeStyle = boxes.length > 1 ? "rgba(245,158,11,0.8)" : "rgba(34,197,94,0.65)";
      ctx.lineWidth = 1.25;
      for (const box of boxes) {
        ctx.strokeRect(...toDisplayRect(box, video, coverRef.current, mirrored));
      }
    },
    [mirrored, videoRef],
  );

  // Local tracking: redraw on every decoded video frame.
  useEffect(() => {
    const video = videoRef.current as VideoWithFrameCallback | null;
    if (!detector || !video) return;

    let stopped = false;
    let handle = 0;
    let lastRun = 0;
    // Detection runs on the main thread; on slow machines back off so it never
    // takes more than about half of it (the exam UI shares that thread).
    let avgCostMs = 0;
    const useFrameCallback = typeof video.requestVideoFrameCallback === "function";

    const tick = () => {
      if (stopped) return;
      const now = performance.now();
      if (
        now - lastRun >= Math.max(MIN_DETECT_INTERVAL_MS, avgCostMs * 2) &&
        video.readyState >= 2 &&
        !video.paused &&
        video.srcObject
      ) {
        lastRun = now;
        try {
          draw(detectFaces(detector, video));
        } catch (e) {
          console.warn("local face detection failed", e);
        }
        const cost = performance.now() - now;
        avgCostMs = avgCostMs ? avgCostMs * 0.8 + cost * 0.2 : cost;
      }
      handle = useFrameCallback
        ? video.requestVideoFrameCallback!(tick)
        : window.requestAnimationFrame(tick);
    };
    tick();

    return () => {
      stopped = true;
      if (useFrameCallback) video.cancelVideoFrameCallback?.(handle);
      else window.cancelAnimationFrame(handle);
    };
  }, [detector, draw, videoRef]);

  // Fallback when the local tracker can't load: draw the server's box.
  const drawServerBox = useCallback(() => {
    if (detector) return;
    const faceNorm = analysis?.face?.bbox_norm;
    draw(faceCount > 0 && faceNorm && faceNorm.length >= 4 ? [faceNorm as NormalizedBox] : []);
  }, [analysis, detector, draw, faceCount]);

  useEffect(() => {
    drawServerBox();
  }, [drawServerBox]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new ResizeObserver(() => {
      coverRef.current = getComputedStyle(video).objectFit === "cover";
      drawServerBox();
    });
    observer.observe(video);
    return () => observer.disconnect();
  }, [drawServerBox, videoRef]);

  return (
    <>
      {showPostureGuide && (
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center ${GUIDE_PADDING[guideSize]}`}
          aria-hidden
        >
          <PostureSilhouette
            aligned={guideOk}
            className="h-full w-full max-h-full max-w-full transition-opacity duration-700"
          />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      />
    </>
  );
}
