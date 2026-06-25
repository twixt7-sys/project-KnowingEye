import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildSessionObserverWsUrl,
  type FrameAlert,
  type FrameAnalysis,
} from "../../../core/config/api";

export type ObserverStatus = "idle" | "connecting" | "live" | "error" | "closed";

export interface UseSessionObserverResult {
  status: ObserverStatus;
  error: string | null;
  analysis: FrameAnalysis | null;
  snapshot: string | null;
  alerts: FrameAlert[];
  connect: () => void;
  disconnect: () => void;
}

export function useSessionObserver(sessionId: string | undefined): UseSessionObserverResult {
  const [status, setStatus] = useState<ObserverStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FrameAnalysis | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<FrameAlert[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const closedRef = useRef(false);

  const disconnect = useCallback(() => {
    closedRef.current = true;
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* noop */
      }
      wsRef.current = null;
    }
    setStatus("closed");
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) {
      setError("Missing session id");
      setStatus("error");
      return;
    }
    disconnect();
    closedRef.current = false;
    setError(null);
    setStatus("connecting");
    try {
      const ws = new WebSocket(buildSessionObserverWsUrl(sessionId));
      wsRef.current = ws;
      ws.onopen = () => setStatus("live");
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "analysis" && msg.payload) {
            setAnalysis(msg.payload as FrameAnalysis);
          } else if (msg.type === "snapshot" && msg.image) {
            setSnapshot(msg.image as string);
            if (msg.analysis) setAnalysis(msg.analysis as FrameAnalysis);
          } else if (msg.type === "alert" && msg.payload) {
            setAlerts((prev) => [msg.payload as FrameAlert, ...prev].slice(0, 50));
          }
        } catch {
          /* ignore parse errors */
        }
      };
      ws.onerror = () => setError("Observer connection failed");
      ws.onclose = () => {
        if (!closedRef.current) setStatus("error");
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
      setStatus("error");
    }
  }, [disconnect, sessionId]);

  useEffect(() => () => disconnect(), [disconnect]);

  return { status, error, analysis, snapshot, alerts, connect, disconnect };
}
