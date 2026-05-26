import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiClient,
  buildMonitoringWsUrl,
  type FrameAlert,
  type FrameAnalysis,
} from "../../core/config/api";

export type MonitoringStatus =
  | "idle"
  | "requesting-camera"
  | "connecting"
  | "live"
  | "fallback-rest"
  | "error"
  | "closed";

export interface UseMonitoringOptions {
  sessionId: string | undefined;
  intervalMs?: number;
  jpegQuality?: number;
  videoConstraints?: MediaStreamConstraints["video"];
  /** Force REST POSTs even if a WebSocket would work. */
  forceRest?: boolean;
}

export interface UseMonitoringResult {
  status: MonitoringStatus;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  analysis: FrameAnalysis | null;
  alerts: FrameAlert[];
  start: () => Promise<void>;
  stop: () => void;
  enrollReference: () => Promise<boolean>;
}

const DEFAULT_INTERVAL = 1000; // ms — 1 fps is plenty for behaviour scoring
const DEFAULT_QUALITY = 0.6;
const DEFAULT_VIDEO: MediaStreamConstraints["video"] = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  facingMode: "user",
};

/**
 * Acquires the local webcam, encodes frames as JPEG/base64, and streams them
 * to the Django backend (WebSocket when available, REST as fallback).
 */
export function useMonitoring({
  sessionId,
  intervalMs = DEFAULT_INTERVAL,
  jpegQuality = DEFAULT_QUALITY,
  videoConstraints = DEFAULT_VIDEO,
  forceRest = false,
}: UseMonitoringOptions): UseMonitoringResult {
  const [status, setStatus] = useState<MonitoringStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FrameAnalysis | null>(null);
  const [alerts, setAlerts] = useState<FrameAlert[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<number | null>(null);
  const sendingRef = useRef(false);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", jpegQuality);
  }, [jpegQuality]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* noop */
      }
      wsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStatus("closed");
  }, []);

  const sendViaRest = useCallback(async () => {
    if (!sessionId || sendingRef.current) return;
    const image = captureFrame();
    if (!image) return;
    sendingRef.current = true;
    try {
      const res = await apiClient.sendFrame({ image, session_id: sessionId });
      setAnalysis(res.analysis);
      if (res.analysis.alerts?.length) {
        setAlerts((prev) => [...res.analysis.alerts, ...prev].slice(0, 50));
      }
    } catch (e) {
      console.warn("frame send failed", e);
    } finally {
      sendingRef.current = false;
    }
  }, [captureFrame, sessionId]);

  const start = useCallback(async () => {
    if (!sessionId) {
      setError("Missing session id");
      setStatus("error");
      return;
    }
    setError(null);
    setStatus("requesting-camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Camera unavailable";
      setError(msg);
      setStatus("error");
      return;
    }

    if (!forceRest && "WebSocket" in window) {
      try {
        setStatus("connecting");
        const ws = new WebSocket(buildMonitoringWsUrl(sessionId));
        wsRef.current = ws;
        ws.onopen = () => setStatus("live");
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "analysis") {
              setAnalysis(msg.payload as FrameAnalysis);
              const incoming = (msg.payload as FrameAnalysis).alerts;
              if (incoming?.length) {
                setAlerts((prev) => [...incoming, ...prev].slice(0, 50));
              }
            } else if (msg.type === "alert") {
              setAlerts((prev) => [msg.payload as FrameAlert, ...prev].slice(0, 50));
            }
          } catch (e) {
            console.warn("ws message parse failed", e);
          }
        };
        ws.onerror = () => {
          // Will likely be followed by close → fallback below.
        };
        ws.onclose = () => {
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          wsRef.current = null;
          if (status !== "closed") {
            setStatus("fallback-rest");
            intervalRef.current = window.setInterval(sendViaRest, intervalMs);
          }
        };

        intervalRef.current = window.setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const image = captureFrame();
          if (!image) return;
          ws.send(JSON.stringify({ type: "frame", image }));
        }, intervalMs);
        return;
      } catch (e) {
        console.warn("websocket failed, falling back to REST", e);
      }
    }

    setStatus("fallback-rest");
    intervalRef.current = window.setInterval(sendViaRest, intervalMs);
  }, [
    captureFrame,
    forceRest,
    intervalMs,
    sendViaRest,
    sessionId,
    status,
    videoConstraints,
  ]);

  const enrollReference = useCallback(async () => {
    if (!sessionId) return false;
    const image = captureFrame();
    if (!image) return false;
    try {
      const res = await apiClient.enrollReference({ image, session_id: sessionId });
      return !!res.ok;
    } catch (e) {
      console.warn("enroll failed", e);
      return false;
    }
  }, [captureFrame, sessionId]);

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    error,
    videoRef,
    analysis,
    alerts,
    start,
    stop,
    enrollReference,
  };
}
