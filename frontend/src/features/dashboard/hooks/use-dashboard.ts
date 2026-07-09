import { useQuery } from "@tanstack/react-query";

import { ApiError, formatApiError } from "@/core/config/api";
import { dashboardQueries } from "@/features/dashboard/queries/queries";

/**
 * Admin dashboard feature hook: aggregates KPIs, exams, unresolved alerts and
 * live sessions (Objective 6: administrative dashboard).
 */
export function useDashboard(pollMs = 30_000) {
  const query = useQuery({
    ...dashboardQueries.examiner(),
    refetchInterval: pollMs > 0 ? pollMs : false,
  });

  return {
    summary: query.data?.summary ?? null,
    exams: query.data?.exams ?? [],
    recentAlerts: query.data?.recentAlerts ?? [],
    activeSessions: query.data?.activeSessions ?? [],
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
