/**
 * Exam feature API - typed wrappers over the shared API client.
 */
import {
  apiClient,
  type Exam,
  type ExamCategory,
  type PublishReadiness,
  type Question,
  type QuestionAttachment,
} from "@/core/config/api";

export interface ExamAssignment {
  id: number;
  user: number;
  user_email: string;
  user_name: string;
  status: string;
  extra_time_minutes: number;
  attempts_override: number | null;
}

export function fetchExams(params?: {
  status?: string;
  search?: string;
  category?: number | string;
  departments?: number | string;
  ordering?: string;
}) {
  return apiClient.getExams(params);
}

export function fetchCategories() {
  return apiClient.listCategories();
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

export function submitExamForReview(id: number) {
  return apiClient.submitExamForReview(id);
}

export function approveExam(id: number) {
  return apiClient.approveExam(id);
}

export function rejectExam(id: number, note: string) {
  return apiClient.rejectExam(id, note);
}

export function fetchPendingReviewExams() {
  return apiClient.getPendingReviewExams();
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

export function createExamSection(
  examId: number,
  payload: { title: string; instructions?: string; order?: number; questions_per_page?: number }
) {
  return apiClient.createExamSection(examId, payload);
}

export function uploadQuestionAttachment(
  examId: number,
  questionId: number,
  file: File,
  caption?: string
) {
  return apiClient.uploadQuestionAttachment(examId, questionId, file, caption);
}

export function deleteQuestionAttachment(
  examId: number,
  questionId: number,
  attachmentId: number
) {
  return apiClient.deleteQuestionAttachment(examId, questionId, attachmentId);
}

export function uploadOptionImage(examId: number, questionId: number, file: File) {
  return apiClient.uploadOptionImage(examId, questionId, file);
}

export function fetchExamAssignments(examId: number) {
  return apiClient.listExamAssignments(examId);
}

export function createExamAssignment(
  examId: number,
  payload: { user_id?: number; email?: string; extra_time_minutes?: number }
) {
  return apiClient.createExamAssignment(examId, payload);
}

export function importExamAssignments(examId: number, csv: string) {
  return apiClient.importExamAssignments(examId, csv);
}

export type { Exam, ExamCategory, Question, PublishReadiness, QuestionAttachment };
