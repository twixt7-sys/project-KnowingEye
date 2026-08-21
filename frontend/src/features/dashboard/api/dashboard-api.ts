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

export function fetchCompletedSessions() {
  return apiClient.listSessionReports({ status: "completed" });
}
