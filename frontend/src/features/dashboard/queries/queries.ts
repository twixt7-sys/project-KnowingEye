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

/** How often the examinee's exam list re-checks for newly published or newly opened exams. */
export const STUDENT_EXAMS_POLL_MS = 30_000;

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
  /** Just the exam list, for pages (like the archive) that don't need the dashboard's KPIs. */
  examinerExams: () => ({
    queryKey: dashboardKeys.examinerExams(),
    queryFn: () => apiClient.getExams(),
  }),
  /**
   * Exams the examinee can take. The endpoint is unpaginated, so the table pages client-side.
   *
   * The server only lists an exam once it is published and its window has opened, and the
   * builder requires the window to open in the future - so a new exam always becomes
   * available *after* this page loaded. Poll, and refetch when the tab regains focus (off
   * app-wide), so it shows up without a manual reload.
   */
  studentExams: () => ({
    queryKey: dashboardKeys.studentExams(),
    queryFn: fetchMyExams,
    refetchInterval: STUDENT_EXAMS_POLL_MS,
    refetchOnWindowFocus: true,
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
