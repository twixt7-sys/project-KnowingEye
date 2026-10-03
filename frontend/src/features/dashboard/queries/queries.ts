import { keepPreviousData } from "@tanstack/react-query";

import { apiClient } from "@/core/config/api";
import {
  type CompletedSessionParams,
  fetchCategories,
  fetchCompletedSessions,
  fetchDepartments,
  fetchMyExams,
} from "@/features/dashboard/api/dashboard-api";
import { dashboardKeys } from "@/features/dashboard/queries/keys";

export const dashboardQueries = {
  examiner: () => ({
    queryKey: dashboardKeys.examiner(),
    queryFn: async () => {
      const [summary, exams, alerts, sessions] = await Promise.all([
        apiClient.getReportSummary(),
        apiClient.getExams(),
        apiClient.listAlerts({ resolved: false }),
        apiClient.listSessionReports({ status: "in_progress,paused", page_size: 50 }),
      ]);
      return {
        summary,
        exams,
        recentAlerts: alerts.slice(0, 8),
        activeSessions: sessions.results,
      };
    },
    refetchInterval: 30_000,
  }),
  /** Exams the examinee can take. The endpoint is unpaginated, so the table pages client-side. */
  studentExams: () => ({
    queryKey: dashboardKeys.studentExams(),
    queryFn: fetchMyExams,
  }),
  /** One page of the examinee's completed attempts; search/sort/filter/page run on the server. */
  studentSessions: (params: CompletedSessionParams) => ({
    queryKey: dashboardKeys.studentSessions(params),
    queryFn: () => fetchCompletedSessions(params),
    // Keep the current rows on screen while the next page/sort/filter loads.
    placeholderData: keepPreviousData,
  }),
  departments: (activeOnly = true) => ({
    queryKey: dashboardKeys.departments(activeOnly),
    queryFn: () => fetchDepartments(activeOnly),
  }),
  categories: (activeOnly = true) => ({
    queryKey: dashboardKeys.categories(activeOnly),
    queryFn: () => fetchCategories(activeOnly),
  }),
};
