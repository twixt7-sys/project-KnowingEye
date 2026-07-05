/**
 * Resolve the API base URL so LAN / multi-device access works on any network.
 *
 * - Absolute `VITE_API_BASE_URL` (http/https) is used as-is (production / explicit override).
 * - Relative path (default `/api`) uses the page origin, so phones/tablets hit the
 *   same host:port they loaded the SPA from. Vite proxies `/api` and `/ws` to Django.
 */
function resolveApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/$/, "");
  }

  const path = configured?.startsWith("/") ? configured.replace(/\/$/, "") : "/api";

  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }

  // Non-browser fallback (tests / tooling)
  return `http://127.0.0.1:5173${path}`;
}

export const API_BASE_URL = resolveApiBaseUrl();
export const APP_NAME = import.meta.env.VITE_APP_NAME ?? "Knowing Eye";
