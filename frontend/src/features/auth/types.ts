/**
 * Auth feature types. These re-export the canonical types from the shared API
 * client so the feature layer stays in lock-step with the backend contract.
 */
import type { AuthUser, ProfileUser, Role } from "../../core/config/api";

export type AuthRole = Role;
export type { AuthUser, ProfileUser };

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  password2: string;
  role?: Role;
  first_name: string;
  last_name: string;
  avatar: File;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
  new_password2: string;
}
