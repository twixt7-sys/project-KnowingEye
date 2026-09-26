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

const HEARTBEAT_MS = 20_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 8_000;

export function useSessionObserver(sessionId: string | undefined): UseSessionObserverResult {
  const [status, setStatus] = useState<ObserverStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FrameAnalysis | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<FrameAlert[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const closedRef = useRef(false);
  const heartbeatRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const connectRef = useRef<() => void>(() => {});

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current !== null) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    closedRef.current = true;
    clearHeartbeat();
    clearReconnectTimer();
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* noop */
      }
      wsRef.current = null;
    }
    setStatus("closed");
  }, [clearHeartbeat, clearReconnectTimer]);

  const scheduleReconnect = useCallback(() => {
    if (closedRef.current) return;
    clearReconnectTimer();
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** reconnectAttemptsRef.current,
      RECONNECT_MAX_MS
    );
    reconnectAttemptsRef.current += 1;
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      if (!closedRef.current) connectRef.current();
    }, delay);
  }, [clearReconnectTimer]);

  const connect = useCallback(() => {
    if (!sessionId) {
      setError("Missing session id");
      setStatus("error");
      return;
    }
    clearHeartbeat();
    clearReconnectTimer();
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* noop */
      }
      wsRef.current = null;
    }
    closedRef.current = false;
    setError(null);
    setStatus("connecting");
    try {
      const ws = new WebSocket(buildSessionObserverWsUrl(sessionId));
      wsRef.current = ws;
      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setStatus("live");
        heartbeatRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, HEARTBEAT_MS);
      };
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
        clearHeartbeat();
        wsRef.current = null;
        if (!closedRef.current) {
          setStatus("error");
          scheduleReconnect();
        }
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
      setStatus("error");
      scheduleReconnect();
    }
  }, [clearHeartbeat, clearReconnectTimer, scheduleReconnect, sessionId]);

  connectRef.current = connect;

  useEffect(() => () => disconnect(), [disconnect]);

  return { status, error, analysis, snapshot, alerts, connect, disconnect };
}
