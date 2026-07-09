import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, type ExamSession, type ResponseData } from "../../../core/config/api";

const AUTOSAVE_MS = 1500;
const HEARTBEAT_MS = 30_000;
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
      }
    },
    [sessionId]
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
    if (!sessionId) return;
    const tick = setInterval(() => setTimeRemaining((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(tick);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const sync = setInterval(async () => {
      try {
        const hb = await apiClient.sessionHeartbeat(sessionId);
        setTimeRemaining(hb.time_remaining_seconds);
        if (hb.status !== "in_progress") {
          setSession((s) => (s ? { ...s, status: hb.status as ExamSession["status"] } : s));
        }
      } catch {
        /* network blip */
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(sync);
  }, [sessionId]);

  const clearLocal = useCallback(() => {
    if (localKey) localStorage.removeItem(localKey);
  }, [localKey]);

  return {
    session,
    setSession,
    answers,
    setAnswer,
    timeRemaining,
    autosaveStatus,
    refresh,
    buildSubmitPayload,
    clearLocal,
  };
}
