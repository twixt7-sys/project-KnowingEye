import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../../../core/config/query-keys";
import {
  ApiError,
  apiClient,
  formatApiError,
  type AlertRow,
  type Exam,
  type ReportSummary,
  type SessionReportRow,
} from "../../../core/config/api";

interface DashboardData {
  summary: ReportSummary;
  exams: Exam[];
  recentAlerts: AlertRow[];
  activeSessions: SessionReportRow[];
}

/**
 * Admin dashboard feature hook: aggregates KPIs, exams, unresolved alerts and
 * live sessions (Objective 6: administrative dashboard).
 */
export function useDashboard(pollMs = 30_000) {
  const query = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async (): Promise<DashboardData> => {
      const [summary, exams, alerts, sessions] = await Promise.all([
        apiClient.getReportSummary(),
        apiClient.getExams(),
        apiClient.listAlerts({ resolved: false }),
        apiClient.listSessionReports({ status: "in_progress", page_size: 50 }),
      ]);
      return {
        summary,
        exams,
        recentAlerts: alerts.slice(0, 8),
        activeSessions: sessions.results,
      };
    },
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
