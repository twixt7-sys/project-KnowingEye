import { apiClient, type SessionResponse } from "@/core/config/api";
import { fetchSessionReports } from "@/features/reports/api/reports-api";
import { fetchSession } from "@/features/session/api/session-api";

export type PendingGradeRow = SessionResponse & { session_id: string; examinee: string };

export function gradeExamResponse(
  responseId: number,
  payload: {
    points_awarded: number;
    is_correct: boolean;
    grader_comment: string;
    flagged_for_review: boolean;
  }
) {
  return apiClient.gradeResponse(responseId, payload);
}

export function recalculateExamSession(sessionId: string) {
  return apiClient.recalculateSession(sessionId);
}

export async function fetchPendingGradeRows(examId: number): Promise<PendingGradeRow[]> {
  const { results } = await fetchSessionReports({
    exam: examId,
    status: "pending_review",
  });

  const pending: PendingGradeRow[] = [];
  for (const session of results) {
    const detail = await fetchSession(session.id);
    for (const response of detail.responses ?? []) {
      if (response.flagged_for_review && response.points_awarded == null) {
        pending.push({
          ...response,
          session_id: session.id,
          examinee: session.user_full_name ?? session.user,
        });
      }
    }
  }
  return pending;
}
