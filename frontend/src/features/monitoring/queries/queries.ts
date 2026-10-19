import {
  fetchActiveSessions,
  fetchAlerts,
  fetchMonitoringHealth,
  fetchSessionReport,
  fetchSessionSnapshots,
} from "@/features/monitoring/api/monitoring-api";
import { monitoringKeys } from "@/features/monitoring/queries/keys";

export const monitoringQueries = {
  activeSessions: () => ({
    queryKey: monitoringKeys.activeSessions(),
    queryFn: async () => {
      const res = await fetchActiveSessions();
      return res.results;
    },
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  }),
  unresolvedAlerts: () => ({
    queryKey: monitoringKeys.alerts({ resolved: false }),
    queryFn: () => fetchAlerts({ resolved: false }),
  }),
  health: () => ({
    queryKey: monitoringKeys.health(),
    queryFn: () => fetchMonitoringHealth(),
    retry: false,
  }),
  sessionSnapshots: (sessionId: string) => ({
    queryKey: monitoringKeys.sessionSnapshots(sessionId),
    queryFn: () => fetchSessionSnapshots(sessionId),
    enabled: Boolean(sessionId),
    // Warning frames are saved while the exam runs.
    refetchInterval: 15_000,
  }),
  sessionReport: (sessionId: string) => ({
    queryKey: monitoringKeys.sessionReport(sessionId),
    queryFn: () => fetchSessionReport(sessionId),
    enabled: Boolean(sessionId),
  }),
};
