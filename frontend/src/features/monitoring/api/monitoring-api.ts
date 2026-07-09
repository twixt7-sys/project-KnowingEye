/**
 * Monitoring feature API - typed wrappers over the shared API client.
 * Frames can be streamed via WebSocket (preferred) or this REST fallback.
 */
import { apiClient, buildAdminAlertsWsUrl } from "@/core/config/api";

export { buildAdminAlertsWsUrl };

export function sendMonitoringFrame(body: { image: string; session_id: string }) {
  return apiClient.sendFrame(body);
}

export function enrollReferenceFace(body: { image: string; session_id: string }) {
  return apiClient.enrollReference(body);
}

export function fetchMonitoringHealth() {
  return apiClient.getMonitoringHealth();
}

export function fetchActiveSessions(pageSize = 50) {
  return apiClient.listSessionReports({ status: "in_progress", page_size: pageSize });
}

export function fetchAlerts(params?: { resolved?: boolean }) {
  return apiClient.listAlerts(params);
}

export function resolveAlert(alertId: string) {
  return apiClient.resolveAlert(alertId);
}

export function fetchSessionReport(sessionId: string) {
  return apiClient.getSessionReport(sessionId);
}

export function terminateSession(sessionId: string) {
  return apiClient.terminateSession(sessionId);
}
