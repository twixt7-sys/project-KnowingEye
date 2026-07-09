import {
  fetchDepartments,
  fetchExamAnalytics,
  fetchReportSummary,
  fetchSessionReport,
  fetchSessionReports,
  fetchTimeseries,
} from "@/features/reports/api/reports-api";
import { reportsKeys } from "@/features/reports/queries/keys";

export interface TimeseriesPoint {
  day: string;
  sessions: number;
  alerts: number;
  behaviors: number;
}

export function mergeTimeseries(ts: Awaited<ReturnType<typeof fetchTimeseries>>): TimeseriesPoint[] {
  const byDay = new Map<string, TimeseriesPoint>();
  const touch = (day: string) =>
    byDay.get(day) ?? { day, sessions: 0, alerts: 0, behaviors: 0 };

  ts.sessions.forEach((r) => byDay.set(r.day, { ...touch(r.day), sessions: r.count }));
  ts.alerts.forEach((r) => byDay.set(r.day, { ...touch(r.day), alerts: r.count }));
  ts.behaviors.forEach((r) => byDay.set(r.day, { ...touch(r.day), behaviors: r.count }));

  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
}

export const reportsQueries = {
  summary: () => ({
    queryKey: reportsKeys.summary(),
    queryFn: fetchReportSummary,
  }),
  timeseries: () => ({
    queryKey: reportsKeys.timeseries(),
    queryFn: async () => mergeTimeseries(await fetchTimeseries()),
  }),
  sessions: (params: Record<string, unknown>) => ({
    queryKey: reportsKeys.sessions(params),
    queryFn: () => fetchSessionReports(params as Parameters<typeof fetchSessionReports>[0]),
  }),
  departments: () => ({
    queryKey: reportsKeys.departments(),
    queryFn: () => fetchDepartments(true),
  }),
  examResults: (examId: string) => ({
    queryKey: reportsKeys.examResults(examId),
    queryFn: async () => {
      const { results } = await fetchSessionReports({ exam: Number(examId) });
      const latest = results.find(
        (r) => r.status === "completed" || r.status === "pending_review"
      );
      if (!latest) {
        throw new Error("No completed session found for this exam.");
      }
      const report = await fetchSessionReport(latest.id);
      return {
        sessionRow: latest,
        behaviorSummary: report.behavior_summary,
        alerts: report.alerts,
        logs: report.behavior_logs,
        departmentAnalytics: report.department_analytics,
      };
    },
    enabled: Boolean(examId),
  }),
  examSummary: (examId: number, params: Record<string, unknown>) => ({
    queryKey: reportsKeys.examSummary(examId, params),
    queryFn: () =>
      fetchSessionReports({
        exam: examId,
        ...(params as { page?: number; page_size?: number }),
      }),
    enabled: examId > 0 && !Number.isNaN(examId),
  }),
  examAnalytics: (examId: number, enabled = true) => ({
    queryKey: reportsKeys.examAnalytics(examId),
    queryFn: () => fetchExamAnalytics(examId),
    enabled: enabled && examId > 0 && !Number.isNaN(examId),
  }),
};
