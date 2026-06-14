/**
 * Auth token store. Delegates to the shared, JWT-aware token storage so the
 * whole app reads/writes a single source of truth (localStorage-backed).
 */
import { tokenStore } from "../../../core/config/api";

export const authStore = {
  get accessToken() {
    return tokenStore.access;
  },
  get refreshToken() {
    return tokenStore.refresh;
  },
  get isAuthenticated() {
    return !!tokenStore.access;
  },
  setTokens(access: string, refresh?: string) {
    tokenStore.set(access, refresh);
  },
  clear() {
    tokenStore.clear();
  },
};
