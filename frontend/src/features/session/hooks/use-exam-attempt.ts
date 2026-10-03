import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, type ExamSession, type ResponseData } from "../../../core/config/api";

const AUTOSAVE_MS = 1500;
const HEARTBEAT_MS = 30_000;
// While a proctor has the exam paused the examinee is just waiting, so look for
// the resume far more often than the usual timer sync.
const PAUSED_HEARTBEAT_MS = 3_000;
const LOCAL_KEY_PREFIX = "knowing-eye-attempt-";

export interface SavedAnswer {
  answer_text: string;
  time_spent: number;
  flagged_for_review: boolean;
}

export function useExamAttempt(sessionId: string | undefined) {
  const [session, setSession] = useState<ExamSession | null>(null);
  const [answers, setAnswers] = useState<Record<number, SavedAnswer>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<{ questionId: number; data: SavedAnswer } | null>(null);

  const localKey = sessionId ? `${LOCAL_KEY_PREFIX}${sessionId}` : null;
  const paused = session?.status === "paused";
  const pauseReason = session?.pause_reason ?? "";

  const hydrateFromSession = useCallback((data: ExamSession) => {
    const next: Record<number, SavedAnswer> = {};
    for (const r of data.responses ?? []) {
      next[r.question] = {
        answer_text: r.answer_text ?? "",
        time_spent: r.time_spent ?? 0,
        flagged_for_review: r.flagged_for_review ?? false,
      };
    }
    if (localKey) {
      try {
        const cached = localStorage.getItem(localKey);
        if (cached) {
          const parsed = JSON.parse(cached) as Record<number, SavedAnswer>;
          Object.assign(next, parsed);
        }
      } catch {
        /* ignore corrupt cache */
      }
    }
    setAnswers(next);
    setTimeRemaining(data.time_remaining_seconds ?? 0);
    setSession(data);
  }, [localKey]);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const data = await apiClient.getSession(sessionId);
    hydrateFromSession(data);
    return data;
  }, [sessionId, hydrateFromSession]);

  const persistLocal = useCallback(
    (next: Record<number, SavedAnswer>) => {
      if (!localKey) return;
      try {
        localStorage.setItem(localKey, JSON.stringify(next));
      } catch {
        /* quota */
      }
    },
    [localKey]
  );

  /**
   * Re-read the authoritative timer and status from the server. Runs on a
   * timer, when the monitoring socket pushes a pause/resume, and when an
   * autosave is rejected (which is how an exam without a monitoring socket
   * notices it was paused before the next timer sync).
   */
  const syncNow = useCallback(async () => {
    if (!sessionId) return;
    try {
      const hb = await apiClient.sessionHeartbeat(sessionId);
      setTimeRemaining(hb.time_remaining_seconds);
      setSession((s) =>
        s && (s.status !== hb.status || (s.pause_reason ?? "") !== (hb.pause_reason ?? ""))
          ? {
              ...s,
              status: hb.status as ExamSession["status"],
              pause_reason: hb.pause_reason ?? "",
            }
          : s
      );
    } catch {
      /* network blip */
    }
  }, [sessionId]);

  const flushSave = useCallback(
    async (questionId: number, data: SavedAnswer) => {
      if (!sessionId) return;
      setAutosaveStatus("saving");
      try {
        await apiClient.saveSessionResponses(sessionId, [
          {
            question_id: questionId,
            answer_text: data.answer_text,
            time_spent: data.time_spent,
            flagged_for_review: data.flagged_for_review,
          },
        ]);
        setAutosaveStatus("saved");
      } catch {
        setAutosaveStatus("error");
        // The server may have rejected the save because the exam was paused.
        void syncNow();
      }
    },
    [sessionId, syncNow]
  );

  const scheduleSave = useCallback(
    (questionId: number, data: SavedAnswer) => {
      pendingSave.current = { questionId, data };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const pending = pendingSave.current;
        if (pending) void flushSave(pending.questionId, pending.data);
      }, AUTOSAVE_MS);
    },
    [flushSave]
  );

  const setAnswer = useCallback(
    (questionId: number, patch: Partial<SavedAnswer>) => {
      setAnswers((prev) => {
        const next = {
          ...prev,
          [questionId]: {
            answer_text: patch.answer_text ?? prev[questionId]?.answer_text ?? "",
            time_spent: patch.time_spent ?? prev[questionId]?.time_spent ?? 0,
            flagged_for_review:
              patch.flagged_for_review ?? prev[questionId]?.flagged_for_review ?? false,
          },
        };
        persistLocal(next);
        scheduleSave(questionId, next[questionId]);
        return next;
      });
    },
    [persistLocal, scheduleSave]
  );

  const buildSubmitPayload = useCallback(
    (questions: { id: number }[]): ResponseData[] =>
      questions.map((q) => ({
        question_id: q.id,
        answer_text: answers[q.id]?.answer_text ?? "",
        time_spent: answers[q.id]?.time_spent ?? 0,
        flagged_for_review: answers[q.id]?.flagged_for_review ?? false,
      })),
    [answers]
  );

  useEffect(() => {
    if (!sessionId) return;
    void refresh();
  }, [sessionId, refresh]);

  useEffect(() => {
    // The exam clock is stopped while paused; the server holds the time.
    if (!sessionId || paused) return;
    const tick = setInterval(() => setTimeRemaining((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(tick);
  }, [sessionId, paused]);

  useEffect(() => {
    if (!sessionId) return;
    const sync = setInterval(() => void syncNow(), paused ? PAUSED_HEARTBEAT_MS : HEARTBEAT_MS);
    return () => clearInterval(sync);
  }, [sessionId, paused, syncNow]);

  const clearLocal = useCallback(() => {
    if (localKey) localStorage.removeItem(localKey);
  }, [localKey]);

  return {
    session,
    setSession,
    answers,
    setAnswer,
    timeRemaining,
    paused,
    pauseReason,
    syncNow,
    autosaveStatus,
    refresh,
    hydrateFromSession,
    buildSubmitPayload,
    clearLocal,
  };
}
