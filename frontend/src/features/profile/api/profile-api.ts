/**
 * Profile feature API - typed wrappers over the shared API client.
 */
import { apiClient, type ProfileUser } from "../../../core/config/api";

export function fetchUserProfile() {
  return apiClient.getProfile();
}

export function updateUserProfile(patch: Partial<ProfileUser>) {
  return apiClient.updateProfile(patch);
}

export function uploadAvatar(file: File) {
  return apiClient.uploadAvatar(file);
}

export function changePassword(body: {
  old_password: string;
  new_password: string;
  new_password2: string;
}) {
  return apiClient.changePassword(body);
}
