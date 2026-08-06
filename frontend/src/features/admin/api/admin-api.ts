import {
  type AccessMap,
  type Department,
  type ProfileUser,
  type Role,
  type UserPermissions,
  type UserStats,
  apiClient,
} from "@/core/config/api";

export function fetchDepartments() {
  return apiClient.listDepartments();
}

export function createDepartment(payload: {
  name: string;
  abbreviation: string;
  sort_order: number;
}) {
  return apiClient.createDepartment(payload);
}

export function updateDepartment(
  id: number,
  payload: Partial<Department> & { name?: string; abbreviation?: string; sort_order?: number },
) {
  return apiClient.updateDepartment(id, payload);
}

export function deleteDepartment(id: number) {
  return apiClient.deleteDepartment(id);
}

export function fetchUsers(params?: {
  role?: Role;
  search?: string;
  page?: number;
  page_size?: number;
}) {
  return apiClient.listUsers(params);
}

export function fetchUserStats() {
  return apiClient.getUserStats();
}

export function setUserRole(id: number, role: Role) {
  return apiClient.setUserRole(id, role);
}

export function activateUser(id: number) {
  return apiClient.activateUser(id);
}

export function deactivateUser(id: number) {
  return apiClient.deactivateUser(id);
}

export function fetchUserPermissions(id: number) {
  return apiClient.getUserPermissions(id);
}

export function updateUserPermissions(
  id: number,
  body: {
    modules?: Record<string, "grant" | "deny" | null>;
    actions?: Record<string, boolean>;
  },
) {
  return apiClient.setUserPermissions(id, body);
}

export type { AccessMap, Department, ProfileUser, Role, UserPermissions, UserStats };
