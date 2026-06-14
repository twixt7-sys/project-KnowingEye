import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  apiClient,
  type AlertRow,
  type BehaviorLogRow,
} from "../../../core/config/api";

interface UseBehaviorParams {
  session?: string;
  eventType?: string;
}

/**
 * Behavior-monitoring feature hook: loads persisted behavior logs and alerts
 * for a session (Objective 5: anomaly flagging + admin review).
 */
export function useBehavior(params?: UseBehaviorParams) {
  const [logs, setLogs] = useState<BehaviorLogRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logRows, alertRows] = await Promise.all([
        apiClient.listBehaviorLogs({
          session: params?.session,
          event_type: params?.eventType,
        }),
        apiClient.listAlerts({ session: params?.session }),
      ]);
      setLogs(logRows);
      setAlerts(alertRows);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail() : "Failed to load behavior data");
    } finally {
      setLoading(false);
    }
  }, [params?.session, params?.eventType]);

  useEffect(() => {
    reload();
  }, [reload]);

  const resolveAlert = useCallback(async (alertId: string) => {
    await apiClient.resolveAlert(alertId);
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, resolved: true } : a))
    );
  }, []);

  return { logs, alerts, loading, error, reload, resolveAlert };
}
