import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  apiClient,
  type AlertRow,
  type Exam,
  type ReportSummary,
  type SessionReportRow,
} from "../../../core/config/api";

interface DashboardData {
  summary: ReportSummary | null;
  exams: Exam[];
  recentAlerts: AlertRow[];
  activeSessions: SessionReportRow[];
}

const EMPTY: DashboardData = {
  summary: null,
  exams: [],
  recentAlerts: [],
  activeSessions: [],
};

/**
 * Admin dashboard feature hook: aggregates KPIs, exams, unresolved alerts and
 * live sessions (Objective 6: administrative dashboard).
 */
export function useDashboard(pollMs = 30_000) {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [summary, exams, alerts, sessions] = await Promise.all([
        apiClient.getReportSummary(),
        apiClient.getExams(),
        apiClient.listAlerts({ resolved: false }),
        apiClient.listSessionReports({ status: "in_progress" }),
      ]);
      setData({
        summary,
        exams,
        recentAlerts: alerts.slice(0, 8),
        activeSessions: sessions.results,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.detail() : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    if (pollMs <= 0) return;
    const id = window.setInterval(reload, pollMs);
    return () => window.clearInterval(id);
  }, [reload, pollMs]);

  return { ...data, loading, error, reload };
}
