/**
 * Reports feature API — typed wrappers over the shared API client.
 */
import { apiClient } from "../../../core/config/api";

export function fetchReportSummary() {
  return apiClient.getReportSummary();
}

export function fetchSessionReports(params?: { status?: string; exam?: number }) {
  return apiClient.listSessionReports(params);
}

export function fetchSessionReport(sessionId: string) {
  return apiClient.getSessionReport(sessionId);
}

export function fetchTimeseries() {
  return apiClient.getTimeseries();
}

export function sessionsCsvUrl() {
  return apiClient.exportSessionsCSV();
}
