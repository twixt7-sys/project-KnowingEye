import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  type ReportSummary,
  type SessionReportRow,
} from "../../../core/config/api";
import {
  fetchReportSummary,
  fetchSessionReports,
  fetchTimeseries,
} from "../api/reports-api";

export interface TimeseriesPoint {
  day: string;
  sessions: number;
  alerts: number;
  behaviors: number;
}

/**
 * Reports feature hook: KPIs, session log and activity timeseries
 * (Objective 6.2: analyze behavioral reports).
 */
export function useReports(statusFilter?: string) {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [sessions, setSessions] = useState<SessionReportRow[]>([]);
  const [series, setSeries] = useState<TimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, list, ts] = await Promise.all([
        fetchReportSummary(),
        fetchSessionReports(statusFilter ? { status: statusFilter } : undefined),
        fetchTimeseries(),
      ]);
      setSummary(s);
      setSessions(list.results);

      const byDay = new Map<string, TimeseriesPoint>();
      const touch = (day: string) =>
        byDay.get(day) ?? { day, sessions: 0, alerts: 0, behaviors: 0 };
      ts.sessions.forEach((r) => byDay.set(r.day, { ...touch(r.day), sessions: r.count }));
      ts.alerts.forEach((r) => byDay.set(r.day, { ...touch(r.day), alerts: r.count }));
      ts.behaviors.forEach((r) => byDay.set(r.day, { ...touch(r.day), behaviors: r.count }));
      setSeries(
        Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day))
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.detail() : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { summary, sessions, series, loading, error, reload };
}
