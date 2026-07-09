import {
  fetchActiveSessions,
  fetchAlerts,
  fetchMonitoringHealth,
  fetchSessionReport,
} from "@/features/monitoring/api/monitoring-api";
import { monitoringKeys } from "@/features/monitoring/queries/keys";

export const monitoringQueries = {
  activeSessions: () => ({
    queryKey: monitoringKeys.activeSessions(),
    queryFn: async () => {
      const res = await fetchActiveSessions();
      return res.results;
    },
    refetchInterval: 15_000,
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
  sessionReport: (sessionId: string) => ({
    queryKey: monitoringKeys.sessionReport(sessionId),
    queryFn: () => fetchSessionReport(sessionId),
    enabled: Boolean(sessionId),
  }),
};
