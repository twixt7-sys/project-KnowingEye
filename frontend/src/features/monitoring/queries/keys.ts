export const monitoringKeys = {
  all: ["monitoring"] as const,
  activeSessions: () => [...monitoringKeys.all, "active-sessions"] as const,
  alerts: (params?: { resolved?: boolean }) =>
    [...monitoringKeys.all, "alerts", params ?? {}] as const,
  health: () => [...monitoringKeys.all, "health"] as const,
  sessionReport: (sessionId: string) =>
    [...monitoringKeys.all, "session-report", sessionId] as const,
  sessionSnapshots: (sessionId: string) =>
    [...monitoringKeys.all, "session-snapshots", sessionId] as const,
  snapshotImage: (snapshotId: string) =>
    [...monitoringKeys.all, "snapshot-image", snapshotId] as const,
};
