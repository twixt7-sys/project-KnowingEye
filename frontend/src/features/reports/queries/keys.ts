export const reportsKeys = {
  all: ["reports"] as const,
  summary: () => [...reportsKeys.all, "summary"] as const,
  timeseries: () => [...reportsKeys.all, "timeseries"] as const,
  sessions: (params: Record<string, unknown>) =>
    [...reportsKeys.all, "sessions", params] as const,
  departments: () => [...reportsKeys.all, "departments"] as const,
  integrity: (params: Record<string, unknown>) =>
    [...reportsKeys.all, "integrity", params] as const,
  integritySessions: (params: Record<string, unknown>) =>
    [...reportsKeys.all, "integrity-sessions", params] as const,
  schoolYears: (params: Record<string, unknown>) =>
    [...reportsKeys.all, "school-years", params] as const,
  schoolYearDetail: (startYear: number) =>
    [...reportsKeys.all, "school-year-detail", startYear] as const,
  examResults: (examId: string) => [...reportsKeys.all, "exam-results", examId] as const,
  examSummary: (examId: number, params: Record<string, unknown>) =>
    [...reportsKeys.all, "exam-summary", examId, params] as const,
  examAnalytics: (examId: number) =>
    [...reportsKeys.all, "exam-analytics", examId] as const,
};
