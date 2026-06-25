import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiClient,
  ApiError,
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
  /** Max width for captured frames (reduces encode cost). */
  captureMaxWidth?: number;
  videoConstraints?: MediaStreamConstraints["video"];
  /** Force REST POSTs even if a WebSocket would work. */
  forceRest?: boolean;
  /** Called when the backend rejects frames because the session is no longer active. */
  onSessionInactive?: () => void;
}

export interface UseMonitoringResult {
  status: MonitoringStatus;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  analysis: FrameAnalysis | null;
  alerts: FrameAlert[];
  start: () => Promise<void>;
  stop: () => void;
  enrollReference: () => Promise<{ ok: boolean; message?: string }>;
}

const DEFAULT_INTERVAL = 1000; // ms - 1 fps is plenty for behaviour scoring
const DEFAULT_QUALITY = 0.6;
const DEFAULT_CAPTURE_MAX_WIDTH = 480;
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
  captureMaxWidth = DEFAULT_CAPTURE_MAX_WIDTH,
  videoConstraints = DEFAULT_VIDEO,
  forceRest = false,
  onSessionInactive,
}: UseMonitoringOptions): UseMonitoringResult {
  const [status, setStatus] = useState<MonitoringStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FrameAnalysis | null>(null);
  const [alerts, setAlerts] = useState<FrameAlert[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameTimerRef = useRef<number | null>(null);
  const sendingRef = useRef(false);
  const frameBusyRef = useRef(false);
  const closedRef = useRef(false);
  const enrollingRef = useRef(false);
  const onSessionInactiveRef = useRef(onSessionInactive);
  onSessionInactiveRef.current = onSessionInactive;

  const clearFrameTimer = useCallback(() => {
    if (frameTimerRef.current !== null) {
      window.clearTimeout(frameTimerRef.current);
      frameTimerRef.current = null;
    }
  }, []);

  const handleSessionInactive = useCallback(() => {
    clearFrameTimer();
    onSessionInactiveRef.current?.();
  }, [clearFrameTimer]);

  const attachStreamToVideo = useCallback(async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState === "ended") return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    if (video.paused) {
      await video.play().catch(() => {});
    }
  }, []);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || track.readyState === "ended" || !track.enabled) return null;
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;
    const scale = vw > captureMaxWidth ? captureMaxWidth / vw : 1;
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", jpegQuality);
  }, [captureMaxWidth, jpegQuality]);

  const sendFrameOverWs = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || frameBusyRef.current || enrollingRef.current) {
      return;
    }
    frameBusyRef.current = true;
    try {
      const image = captureFrame();
      if (image) {
        ws.send(JSON.stringify({ type: "frame", image }));
      }
    } finally {
      frameBusyRef.current = false;
    }
  }, [captureFrame]);

  const stop = useCallback(() => {
    closedRef.current = true;
    clearFrameTimer();
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
  }, [clearFrameTimer]);

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
      if (e instanceof ApiError && e.status === 400) {
        const msg = e.detail().toLowerCase();
        if (msg.includes("expired") || msg.includes("not active")) {
          handleSessionInactive();
          return;
        }
      }
      console.warn("frame send failed", e);
    } finally {
      sendingRef.current = false;
    }
  }, [captureFrame, handleSessionInactive, sessionId]);

  const scheduleNextFrame = useCallback(
    (tick: () => void) => {
      clearFrameTimer();
      if (closedRef.current) return;
      frameTimerRef.current = window.setTimeout(() => {
        frameTimerRef.current = null;
        tick();
        scheduleNextFrame(tick);
      }, intervalMs);
    },
    [clearFrameTimer, intervalMs]
  );

  const start = useCallback(async () => {
    if (!sessionId) {
      setError("Missing session id");
      setStatus("error");
      return;
    }
    // Keep stream alive across setup step transitions (camera → enroll → ready).
    if (streamRef.current) {
      await attachStreamToVideo();
      if (
        wsRef.current?.readyState === WebSocket.OPEN ||
        (frameTimerRef.current !== null && status !== "closed" && status !== "error")
      ) {
        return;
      }
    }
    setError(null);
    closedRef.current = false;
    setStatus("requesting-camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });
      streamRef.current = stream;
      await attachStreamToVideo();
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
            } else if (msg.type === "error") {
              const message = String(msg.message ?? "").toLowerCase();
              if (message.includes("expired") || message.includes("not active")) {
                handleSessionInactive();
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
          clearFrameTimer();
          wsRef.current = null;
          if (!closedRef.current) {
            setStatus("fallback-rest");
            scheduleNextFrame(() => {
              void sendViaRest();
            });
          }
        };

        scheduleNextFrame(sendFrameOverWs);
        return;
      } catch (e) {
        console.warn("websocket failed, falling back to REST", e);
      }
    }

    setStatus("fallback-rest");
    scheduleNextFrame(() => {
      void sendViaRest();
    });
  }, [
    attachStreamToVideo,
    clearFrameTimer,
    forceRest,
    scheduleNextFrame,
    sendFrameOverWs,
    sendViaRest,
    handleSessionInactive,
    sessionId,
    videoConstraints,
    status,
  ]);

  const enrollReference = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    if (!sessionId) {
      return { ok: false, message: "Missing session id" };
    }
    if (enrollingRef.current) {
      return { ok: false, message: "Enrollment already in progress." };
    }
    enrollingRef.current = true;
    try {
      await attachStreamToVideo();
      let image: string | null = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        image = captureFrame();
        if (image) break;
        await new Promise((r) => window.setTimeout(r, 100));
      }
      if (!image) {
        return { ok: false, message: "Camera is not ready - check that your webcam is on." };
      }

      // REST enroll avoids WS timeout races with the frame loop (first ML inference can take 30s+).
      const res = await apiClient.enrollReference({ image, session_id: sessionId });
      return { ok: !!res.ok, message: res.message };
    } catch (e) {
      console.warn("enroll failed", e);
      if (e instanceof DOMException && e.name === "AbortError") {
        return { ok: false, message: "Enrollment timed out - try Capture identity now again." };
      }
      return { ok: false, message: "Enrollment request failed - try again." };
    } finally {
      enrollingRef.current = false;
    }
  }, [attachStreamToVideo, captureFrame, sessionId]);

  useEffect(() => {
    if (status === "live" || status === "fallback-rest") {
      void attachStreamToVideo();
    }
  }, [attachStreamToVideo, status]);

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
