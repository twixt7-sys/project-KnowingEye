export const behaviorKeys = {
  all: ["behavior"] as const,
  logs: (sessionId?: string) => [...behaviorKeys.all, "logs", sessionId] as const,
  alerts: (filters?: Record<string, unknown>) =>
    [...behaviorKeys.all, "alerts", filters] as const,
};
