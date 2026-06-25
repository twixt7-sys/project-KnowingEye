/**
 * Exam feature API - typed wrappers over the shared API client.
 */
import { apiClient, type Exam, type PublishReadiness, type Question } from "../../../core/config/api";

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

export function updateQuestion(examId: number, questionId: number, payload: Partial<Question>) {
  return apiClient.updateQuestion(examId, questionId, payload);
}

export function deleteQuestion(examId: number, questionId: number) {
  return apiClient.deleteQuestion(examId, questionId);
}

export function fetchExamReadiness(examId: number) {
  return apiClient.getExamReadiness(examId);
}

export function importQuestionsCsv(examId: number, csv: string) {
  return apiClient.importQuestions(examId, csv);
}

export function reorderQuestions(examId: number, questionIds: number[]) {
  return apiClient.reorderQuestions(examId, questionIds);
}

export type { Exam, Question, PublishReadiness };
