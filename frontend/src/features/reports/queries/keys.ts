export const reportsKeys = {
  all: ["reports"] as const,
  summary: () => [...reportsKeys.all, "summary"] as const,
  timeseries: () => [...reportsKeys.all, "timeseries"] as const,
  sessions: (params: Record<string, unknown>) =>
    [...reportsKeys.all, "sessions", params] as const,
  departments: () => [...reportsKeys.all, "departments"] as const,
  examResults: (examId: string) => [...reportsKeys.all, "exam-results", examId] as const,
  examSummary: (examId: number, params: Record<string, unknown>) =>
    [...reportsKeys.all, "exam-summary", examId, params] as const,
  examAnalytics: (examId: number) =>
    [...reportsKeys.all, "exam-analytics", examId] as const,
};
