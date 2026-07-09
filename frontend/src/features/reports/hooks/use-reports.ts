import { useQuery } from "@tanstack/react-query";

import { ApiError, formatApiError } from "@/core/config/api";
import {
  fetchReportSummary,
  fetchSessionReports,
  fetchTimeseries,
} from "@/features/reports/api/reports-api";
import { reportsKeys } from "@/features/reports/queries/keys";
import { mergeTimeseries, type TimeseriesPoint } from "@/features/reports/queries/queries";

export type { TimeseriesPoint };

/**
 * Reports feature hook: KPIs, session log and activity timeseries
 * (Objective 6.2: analyze behavioral reports).
 */
export function useReports(statusFilter?: string) {
  const query = useQuery({
    queryKey: reportsKeys.sessions({ status: statusFilter ?? "" }),
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
