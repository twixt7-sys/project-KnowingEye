import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../../../core/config/query-keys";
import { ApiError, formatApiError } from "../../../core/config/api";
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

function mergeTimeseries(
  ts: Awaited<ReturnType<typeof fetchTimeseries>>
): TimeseriesPoint[] {
  const byDay = new Map<string, TimeseriesPoint>();
  const touch = (day: string) =>
    byDay.get(day) ?? { day, sessions: 0, alerts: 0, behaviors: 0 };

  ts.sessions.forEach((r) => byDay.set(r.day, { ...touch(r.day), sessions: r.count }));
  ts.alerts.forEach((r) => byDay.set(r.day, { ...touch(r.day), alerts: r.count }));
  ts.behaviors.forEach((r) => byDay.set(r.day, { ...touch(r.day), behaviors: r.count }));

  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Reports feature hook: KPIs, session log and activity timeseries
 * (Objective 6.2: analyze behavioral reports).
 */
export function useReports(statusFilter?: string) {
  const query = useQuery({
    queryKey: queryKeys.sessionReports({ status: statusFilter ?? "" }),
    queryFn: async () => {
      const [summary, list, ts] = await Promise.all([
        fetchReportSummary(),
        fetchSessionReports(statusFilter ? { status: statusFilter } : undefined),
        fetchTimeseries(),
      ]);
      return {
        summary,
        sessions: list.results,
        series: mergeTimeseries(ts),
      };
    },
  });

  return {
    summary: query.data?.summary ?? null,
    sessions: query.data?.sessions ?? [],
    series: query.data?.series ?? [],
    loading: query.isLoading,
    error:
      query.error instanceof ApiError
        ? query.error.detail()
        : query.error
          ? formatApiError(query.error)
          : null,
    reload: query.refetch,
  };
}
