/**
 * Exam-session feature API — typed wrappers over the shared API client.
 */
import { apiClient, type SubmitSessionData } from "../../../core/config/api";

export function startSession(examId: number) {
  return apiClient.startExamSession(examId);
}

export function submitSession(sessionId: string, data: SubmitSessionData) {
  return apiClient.submitExamSession(sessionId, data);
}

export function fetchSession(sessionId: string) {
  return apiClient.getSession(sessionId);
}

export function listSessions(params?: {
  status?: string;
  exam?: number;
  user?: number;
}) {
  return apiClient.listSessions(params);
}

export function terminateSession(sessionId: string) {
  return apiClient.terminateSession(sessionId);
}
