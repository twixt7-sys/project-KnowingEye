/**
 * Monitoring feature API - typed wrappers over the shared API client.
 * Frames can be streamed via WebSocket (preferred) or this REST fallback.
 */
import { apiClient, buildAdminAlertsWsUrl, type SessionReportRow } from "@/core/config/api";

export { buildAdminAlertsWsUrl };

export function sendMonitoringFrame(body: { image: string; session_id: string }) {
  return apiClient.sendFrame(body);
}

export function enrollReferenceFace(body: {
  image: string;
  images?: string[];
  session_id: string;
}) {
  return apiClient.enrollReference(body);
}

export function fetchMonitoringHealth() {
  return apiClient.getMonitoringHealth();
}

/** Every session still live: running or paused by a proctor. */
const ACTIVE_SESSIONS_PAGE_SIZE = 100;
const ACTIVE_SESSIONS_MAX_PAGES = 10;

/**
 * Every in-progress or paused session. Several exams can run at once, so one
 * page is not enough: follow pagination (capped) and return them as one list.
 */
export async function fetchActiveSessions() {
  const results: SessionReportRow[] = [];
  for (let page = 1; page <= ACTIVE_SESSIONS_MAX_PAGES; page += 1) {
    const res = await apiClient.listSessionReports({
      status: "in_progress,paused",
      page,
      page_size: ACTIVE_SESSIONS_PAGE_SIZE,
    });
    results.push(...res.results);
    if (!res.next) break;
  }
  return { results };
}

export function fetchAlerts(params?: { resolved?: boolean }) {
  return apiClient.listAlerts(params);
}

export function resolveAlert(alertId: string) {
  return apiClient.resolveAlert(alertId);
}

export function resolveAlertsBulk(params: { session?: string; alert_type?: string }) {
  return apiClient.resolveAlertsBulk(params);
}

export function fetchSessionReport(sessionId: string) {
  return apiClient.getSessionReport(sessionId);
}

export function fetchSessionSnapshots(sessionId: string) {
  return apiClient.listSessionSnapshots({ session: sessionId });
}

export function fetchSnapshotImageSrc(snapshotId: string) {
  return apiClient.getSnapshotImageSrc(snapshotId);
}

export function pauseSession(sessionId: string, reason?: string) {
  return apiClient.pauseSession(sessionId, reason);
}

export function resumeSession(sessionId: string) {
  return apiClient.resumeSession(sessionId);
}

export function terminateSession(sessionId: string) {
  return apiClient.terminateSession(sessionId);
}
