import { API_BASE_URL } from "@/core/config/env";
import { tokenStore } from "@/shared/lib/token-store";

function wsBase(): string {
  return API_BASE_URL.replace(/^http/, "ws").replace(/\/api\/?$/, "");
}

function withToken(): string {
  const token = tokenStore.access;
  return token ? `?token=${encodeURIComponent(token)}` : "";
}

export function buildMonitoringWsUrl(sessionId: string): string {
  return `${wsBase()}/ws/monitoring/${sessionId}/${withToken()}`;
}

/**
 * `detail` opts in to the per-frame analysis stream (bounding boxes, every
 * metric). Grid tiles leave it off and get just snapshots + a one-line summary.
 */
export function buildSessionObserverWsUrl(sessionId: string, detail = false): string {
  const token = withToken();
  const query = detail ? `${token ? `${token}&` : "?"}detail=1` : token;
  return `${wsBase()}/ws/monitoring/observe/${sessionId}/${query}`;
}

/** Live "data changed" notifications for every signed-in user (see core/sync). */
export function buildDataChangesWsUrl(): string {
  return `${wsBase()}/ws/updates/${withToken()}`;
}

export function buildAdminAlertsWsUrl(): string {
  return `${wsBase()}/ws/monitoring/alerts/${withToken()}`;
}
