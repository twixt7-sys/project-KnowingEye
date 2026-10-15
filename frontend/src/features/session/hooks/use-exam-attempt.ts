import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, type ExamSession, type ResponseData } from "../../../core/config/api";

const AUTOSAVE_MS = 1500;
// How often the server's state is re-read when nothing has pushed a change. The
// monitoring socket normally delivers a pause or termination instantly, but an
// exam with monitoring off has no socket, and a dropped one only reconnects
// later - so this is the worst-case delay before the examinee is told.
const HEARTBEAT_MS = 10_000;
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
  const terminated = session?.status === "terminated";
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
   * Take on a status (and its pause note / frozen time) the server just
   * reported. Used for a state pushed over the monitoring socket - the server
   * speaking, so the screen changes at once, ahead of re-reading it with
   * `syncNow()` - and for the heartbeat's answer.
   */
  const applySessionState = useCallback(
    (state: { status: string; pause_reason?: string; time_remaining_seconds?: number | null }) => {
      if (typeof state.time_remaining_seconds === "number") {
        setTimeRemaining(state.time_remaining_seconds);
      }
      setSession((s) => {
        if (!s) return s;
        // A termination can't be undone, so nothing may bring the exam back:
        // not a heartbeat that was already in flight when the proctor acted.
        if (s.status === "terminated") return s;
        if (s.status === state.status && (s.pause_reason ?? "") === (state.pause_reason ?? "")) {
          return s;
        }
        return {
          ...s,
          status: state.status as ExamSession["status"],
          pause_reason: state.pause_reason ?? "",
        };
      });
    },
    []
  );

  /**
   * Re-read the authoritative timer and status from the server. Runs on a
   * timer, after the monitoring socket pushes a pause/resume/terminate, and
   * when an autosave is rejected (which is how an exam without a monitoring
   * socket notices it was paused before the next timer sync).
   */
  const syncNow = useCallback(async () => {
    if (!sessionId) return;
    try {
      applySessionState(await apiClient.sessionHeartbeat(sessionId));
    } catch {
      /* network blip */
    }
  }, [sessionId, applySessionState]);

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
    // The exam clock is stopped while paused (the server holds the time) and
    // for good once terminated.
    if (!sessionId || paused || terminated) return;
    const tick = setInterval(() => setTimeRemaining((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(tick);
  }, [sessionId, paused, terminated]);

  useEffect(() => {
    // Nothing left to learn from a terminated session.
    if (!sessionId || terminated) return;
    const sync = setInterval(() => void syncNow(), paused ? PAUSED_HEARTBEAT_MS : HEARTBEAT_MS);
    return () => clearInterval(sync);
  }, [sessionId, paused, terminated, syncNow]);

  useEffect(() => {
    // A terminated attempt is gone: its pending autosave would only be refused,
    // and the cached answers belong to an exam that can't be resumed.
    if (!terminated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSave.current = null;
    if (localKey) {
      try {
        localStorage.removeItem(localKey);
      } catch {
        /* storage unavailable */
      }
    }
  }, [terminated, localKey]);

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
    terminated,
    pauseReason,
    syncNow,
    applySessionState,
    autosaveStatus,
    refresh,
    hydrateFromSession,
    buildSubmitPayload,
    clearLocal,
  };
}
