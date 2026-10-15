import { apiClient } from "@/core/config/api";

export function fetchDepartments(activeOnly = true) {
  return apiClient.listDepartments({ active_only: activeOnly });
}

export function fetchCategories(activeOnly = true) {
  return apiClient.listCategories({ active_only: activeOnly });
}

export function fetchMyExams() {
  return apiClient.getMyExams();
}

export type CompletedSessionParams = {
  search?: string;
  passed?: boolean;
  ordering?: string;
  page: number;
  page_size: number;
};

export function fetchCompletedSessions(params: CompletedSessionParams) {
  return apiClient.listSessionReports({ ...params, status: "completed" });
}
