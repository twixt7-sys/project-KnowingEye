/**
 * Monitoring feature API - typed wrappers over the shared API client.
 * Frames can be streamed via WebSocket (preferred) or this REST fallback.
 */
import { apiClient } from "../../../core/config/api";

export function sendMonitoringFrame(body: { image: string; session_id: string }) {
  return apiClient.sendFrame(body);
}

export function enrollReferenceFace(body: { image: string; session_id: string }) {
  return apiClient.enrollReference(body);
}

export function fetchMonitoringHealth() {
  return apiClient.getMonitoringHealth();
}
