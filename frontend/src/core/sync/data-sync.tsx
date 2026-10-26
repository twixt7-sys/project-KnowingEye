import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { invalidateEverything, invalidateForChanges } from "@/core/sync/invalidate";
import { useAuth } from "@/core/providers/auth-provider";
import {
  type DataChange,
  type DataTopic,
  publishDataChanges,
  subscribeDataChanges,
} from "@/shared/lib/data-changes";
import { buildDataChangesWsUrl } from "@/shared/lib/websocket";

/** Collect bursts (a question import, a reorder) into one round of refetches. */
const BATCH_MS = 150;
const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

const TOPICS: ReadonlySet<string> = new Set<DataTopic>([
  "exams",
  "reference",
  "sessions",
  "alerts",
  "users",
  "me",
]);

function parseChange(raw: string): DataChange | null {
  try {
    const msg = JSON.parse(raw);
    if (msg?.type !== "changed" || !TOPICS.has(msg.topic)) return null;
    return {
      topic: msg.topic,
      examId: typeof msg.exam_id === "number" ? msg.exam_id : null,
    };
  } catch {
    return null;
  }
}

/**
 * Keeps every screen current: whenever data is created, updated or deleted -
 * by this tab or anyone else - the queries that show it are refetched.
 * Renders nothing; mount once inside the query and auth providers.
 */
export function DataSync() {
  const queryClient = useQueryClient();
  const { isAuthenticated, refresh: refreshAuth } = useAuth();

  // Turn change notifications into (batched) query invalidations.
  useEffect(() => {
    let pending: DataChange[] = [];
    let timer: number | undefined;
    let refreshMe = false;

    const flush = () => {
      timer = undefined;
      const changes = pending;
      pending = [];
      void invalidateForChanges(queryClient, changes);
      if (refreshMe) {
        refreshMe = false;
        // Someone else changed this user's role, access or profile.
        void refreshAuth();
      }
    };

    const unsubscribe = subscribeDataChanges((changes, source) => {
      pending.push(...changes);
      if (source === "remote" && changes.some((c) => c.topic === "me")) refreshMe = true;
      if (timer === undefined) timer = window.setTimeout(flush, BATCH_MS);
    });
    return () => {
      unsubscribe();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [queryClient, refreshAuth]);

  // Hear about writes made anywhere else.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    let socket: WebSocket | null = null;
    let retry: number | undefined;
    let delay = RECONNECT_MIN_MS;
    let hadConnection = false;

    const connect = () => {
      if (cancelled) return;
      try {
        socket = new WebSocket(buildDataChangesWsUrl());
      } catch {
        retry = window.setTimeout(connect, delay);
        return;
      }
      socket.onopen = () => {
        delay = RECONNECT_MIN_MS;
        // Whatever changed while the socket was down was never announced.
        if (hadConnection) void invalidateEverything(queryClient);
        hadConnection = true;
      };
      socket.onmessage = (event) => {
        const change = parseChange(event.data);
        if (change) publishDataChanges([change], "remote");
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        socket = null;
        if (cancelled) return;
        retry = window.setTimeout(connect, delay);
        delay = Math.min(delay * 2, RECONNECT_MAX_MS);
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (retry !== undefined) window.clearTimeout(retry);
      socket?.close();
    };
  }, [isAuthenticated, queryClient]);

  return null;
}
