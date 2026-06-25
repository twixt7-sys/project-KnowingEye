/**
 * Auth feature API - thin, typed wrappers over the shared API client.
 */
import { apiClient } from "../../../core/config/api";
import type {
  ChangePasswordPayload,
  LoginCredentials,
  RegisterPayload,
} from "../types";

export function loginUser(credentials: LoginCredentials) {
  return apiClient.login(credentials);
}

export function registerUser(payload: RegisterPayload) {
  return apiClient.register(payload);
}

export function fetchCurrentUser() {
  return apiClient.getProfile();
}

export function changePassword(payload: ChangePasswordPayload) {
  return apiClient.changePassword(payload);
}
