import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";

import { formatApiError, type ExamPreview, type ExamSection, type Question } from "@/core/config/api";
import { examBuilderPath, parsePreviewQuestionParam } from "@/features/exams/lib/exam-paths";
import { examPreviewQueries } from "@/features/exams/queries/queries";
import type { SavedAnswer } from "@/features/session/hooks/use-exam-attempt";

type PreviewPhase = "instructions" | "running";

const NO_QUESTIONS: Question[] = [];
const NO_SECTIONS: ExamSection[] = [];

/**
 * State for the examiner's "Preview as student" page.
 *
 * Deliberately separate from `useExamTaking` / `useExamAttempt`: a preview has
 * no session, so there is no autosave, heartbeat, monitoring, tab-switch
 * logging or localStorage cache - answers, flags and the countdown live in
 * component state and vanish when the page does.
 */
export function useExamPreview() {
  const { examId } = useParams();
  const id = Number(examId);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const query = useQuery(examPreviewQueries.preview(id));
  const exam: ExamPreview | undefined = query.data;
  const questions = exam?.questions ?? NO_QUESTIONS;
  const sections = exam?.sections ?? NO_SECTIONS;

  // A deep link (`?q=<question id>`) skips the instructions page: previewing
  // one question shouldn't make the author click through the briefing.
  const deepLinkQuestion = parsePreviewQuestionParam(searchParams.get("q"));
  const [started, setStarted] = useState(false);
  const phase: PreviewPhase = started || deepLinkQuestion != null ? "running" : "instructions";

  const [selected, setSelected] = useState<number | null>(null);
  const deepLinkIndex =
    deepLinkQuestion != null ? questions.findIndex((q) => q.id === deepLinkQuestion) : -1;
  const lastIndex = Math.max(0, questions.length - 1);
  const currentQuestion = Math.min(selected ?? Math.max(0, deepLinkIndex), lastIndex);
  // The question isn't in this draw (pools / shuffling), so the preview opens at the start.
  const requestedQuestionMissing =
    deepLinkQuestion != null && questions.length > 0 && deepLinkIndex < 0;

  const [answers, setAnswers] = useState<Record<number, SavedAnswer>>({});
  const setAnswer = useCallback((questionId: number, answerText: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        time_spent: 0,
        flagged_for_review: false,
        ...prev[questionId],
        answer_text: answerText,
      },
    }));
  }, []);
  const toggleFlag = useCallback((questionId: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        answer_text: "",
        time_spent: 0,
        ...prev[questionId],
        flagged_for_review: !prev[questionId]?.flagged_for_review,
      },
    }));
  }, []);

  // The clock is derived from when the runner started rather than counted
  // down tick by tick, so throttled background tabs and StrictMode's double
  // effects can't skew it. Reaching zero changes nothing - there is nothing to submit.
  const running = phase === "running" && exam != null;
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (running && startedAt === null) {
      const t = Date.now();
      setStartedAt(t);
      setNow(t);
    }
  }, [running, startedAt]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  const elapsedSeconds = startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
  const timeRemaining = exam ? Math.max(0, exam.duration_minutes * 60 - elapsedSeconds) : 0;

  const answeredCount = questions.filter(
    (q) => (answers[q.id]?.answer_text ?? "").trim().length > 0
  ).length;
  const progress = questions.length ? (answeredCount / questions.length) * 100 : 0;
  const flaggedCount = Object.values(answers).filter((a) => a.flagged_for_review).length;

  const exit = useCallback(() => {
    // `key` is "default" when the preview was the first page of this tab (a pasted link).
    if (location.key !== "default") navigate(-1);
    else navigate(examBuilderPath(id), { replace: true });
  }, [id, location.key, navigate]);

  return {
    exam,
    loading: query.isLoading,
    error: query.error ? formatApiError(query.error, "Failed to load preview") : null,
    phase,
    start: () => setStarted(true),
    questions,
    sections,
    isEmpty: !!exam && questions.length === 0,
    currentQuestion,
    setCurrentQuestion: setSelected,
    activeQuestion: questions[currentQuestion] as Question | undefined,
    requestedQuestionMissing,
    answers,
    setAnswer,
    toggleFlag,
    answeredCount,
    progress,
    flaggedCount,
    timeRemaining,
    exit,
  };
}
