/**
 * Exam feature API — typed wrappers over the shared API client.
 */
import { apiClient, type Exam, type Question } from "../../../core/config/api";

export function fetchExams(params?: { status?: string; search?: string }) {
  return apiClient.getExams(params);
}

export function fetchExamById(id: number) {
  return apiClient.getExam(id);
}

export function createExam(payload: Partial<Exam>) {
  return apiClient.createExam(payload);
}

export function updateExam(id: number, payload: Partial<Exam>) {
  return apiClient.updateExam(id, payload);
}

export function deleteExam(id: number) {
  return apiClient.deleteExam(id);
}

export function publishExam(id: number) {
  return apiClient.publishExam(id);
}

export function archiveExam(id: number) {
  return apiClient.archiveExam(id);
}

export function fetchQuestions(examId: number) {
  return apiClient.listQuestions(examId);
}

export function createQuestion(examId: number, payload: Partial<Question>) {
  return apiClient.createQuestion(examId, payload);
}
