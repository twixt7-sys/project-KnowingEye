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

export function buildSessionObserverWsUrl(sessionId: string): string {
  return `${wsBase()}/ws/monitoring/observe/${sessionId}/${withToken()}`;
}

export function buildAdminAlertsWsUrl(): string {
  return `${wsBase()}/ws/monitoring/alerts/${withToken()}`;
}
