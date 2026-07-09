import { apiClient } from "@/core/config/api";
import { fetchDepartments, fetchCompletedSessions, fetchMyExams } from "@/features/dashboard/api/dashboard-api";
import { dashboardKeys } from "@/features/dashboard/queries/keys";

export const dashboardQueries = {
  examiner: () => ({
    queryKey: dashboardKeys.examiner(),
    queryFn: async () => {
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
    refetchInterval: 30_000,
  }),
  student: () => ({
    queryKey: dashboardKeys.student(),
    queryFn: async () => {
      const [exams, sessions] = await Promise.all([fetchMyExams(), fetchCompletedSessions()]);
      return { exams, sessions: sessions.results };
    },
  }),
  departments: (activeOnly = true) => ({
    queryKey: dashboardKeys.departments(activeOnly),
    queryFn: () => fetchDepartments(activeOnly),
  }),
};
