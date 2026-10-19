/**
 * Reports feature API - typed wrappers over the shared API client.
 */
import { apiClient } from "@/core/config/api";
import type { IntegrityParams } from "@/shared/types/api";

export function fetchReportSummary() {
  return apiClient.getReportSummary();
}

export function fetchSessionReports(params?: {
  status?: string;
  exam?: number;
  department?: number;
  search?: string;
  page?: number;
  page_size?: number;
}) {
  return apiClient.listSessionReports(params);
}

export function fetchSessionReport(sessionId: string) {
  return apiClient.getSessionReport(sessionId);
}

export function fetchTimeseries() {
  return apiClient.getTimeseries();
}

export function fetchIntegrityReport(params?: IntegrityParams) {
  return apiClient.getIntegrityReport(params);
}

export function fetchIntegritySessions(params?: IntegrityParams) {
  return apiClient.listIntegritySessions(params);
}

export function fetchSchoolYearReport(params?: { department?: number }) {
  return apiClient.getSchoolYearReport(params);
}

export function fetchSchoolYearDetail(startYear: number) {
  return apiClient.getSchoolYearDetail(startYear);
}

export function downloadIntegrityCsv(params?: IntegrityParams) {
  return apiClient.downloadIntegrityCSV(params);
}

export function downloadIntegrityPdf(params?: IntegrityParams) {
  return apiClient.downloadIntegrityPDF(params);
}

export function fetchDepartments(activeOnly = true) {
  return apiClient.listDepartments({ active_only: activeOnly });
}

export async function downloadSessionsCsv() {
  return apiClient.downloadSessionsCSV();
}

export async function downloadSessionsPdf() {
  return apiClient.downloadSessionsPDF();
}

export async function downloadSessionReportPdf(sessionId: string, filename?: string) {
  return apiClient.downloadSessionReportPDF(sessionId, filename);
}

export function fetchExamAnalytics(examId: number) {
  return apiClient.getExamAnalytics(examId);
}
