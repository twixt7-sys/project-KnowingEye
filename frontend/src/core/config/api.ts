/**
 * Knowing Eye API client — re-exports from shared modules for backward compatibility.
 * Prefer importing from @/shared/types/api and feature API modules in new code.
 */

export * from "@/shared/types/api";
export { tokenStore } from "@/shared/lib/token-store";
export { ApiError, formatApiError } from "@/shared/lib/api-error";
export { apiClient, examAPI } from "@/shared/lib/api-client";
export {
  buildMonitoringWsUrl,
  buildSessionObserverWsUrl,
  buildAdminAlertsWsUrl,
} from "@/shared/lib/websocket";
