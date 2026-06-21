export const queryKeys = {
  dashboard: ["dashboard"] as const,
  reportSummary: ["reports", "summary"] as const,
  reportTimeseries: ["reports", "timeseries"] as const,
  sessionReports: (params: Record<string, unknown>) =>
    ["reports", "sessions", params] as const,
};
