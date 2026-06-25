import { useCallback, useEffect, useRef } from "react";

import type { FrameAnalysis } from "../../../core/config/api";
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

function flipX(x: number, width: number, mirrored: boolean) {
  return mirrored ? 1 - x - width : x;
}

const GUIDE_PADDING = {
  default: "p-[1%]",
  compact: "p-[2%]",
} as const;

export function MonitoringVideoOverlay({
  videoRef,
  analysis,
  showPostureGuide = true,
  mirrored = false,
  guideSize = "default",
}: MonitoringVideoOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const faceCount = analysis?.face?.count ?? 0;
  const guideOk =
    faceCount === 1 &&
    (analysis?.posture?.guide_status === "ok" ||
      analysis?.posture?.detected ||
      (analysis?.metrics?.face_presence_pct ?? 0) >= 80);

  const drawBoxes = useCallback(() => {
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

    if (faceCount === 0) return;

    const faceNorm = analysis?.face?.bbox_norm;
    if (faceNorm && faceNorm.length >= 4) {
      const [x, y, bw, bh] = faceNorm;
      const drawX = flipX(x, bw, mirrored) * w;
      ctx.strokeStyle = "rgba(34,197,94,0.65)";
      ctx.lineWidth = 1.25;
      ctx.strokeRect(drawX, y * h, bw * w, bh * h);
    }

    for (const obj of analysis?.objects ?? []) {
      const norm = obj.bbox_norm;
      if (!norm || norm.length < 4) continue;
      const [x1, y1, x2, y2] = norm;
      const bw = x2 - x1;
      const drawX1 = flipX(x1, bw, mirrored) * w;
      ctx.strokeStyle = "rgba(239,68,68,0.7)";
      ctx.lineWidth = 1.25;
      ctx.strokeRect(drawX1, y1 * h, bw * w, (y2 - y1) * h);
    }
  }, [analysis, faceCount, mirrored, videoRef]);

  useEffect(() => {
    drawBoxes();
    const video = videoRef.current;
    if (!video) return;
    const observer = new ResizeObserver(() => drawBoxes());
    observer.observe(video);
    return () => observer.disconnect();
  }, [drawBoxes, videoRef]);

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
