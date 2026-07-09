import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";

import {
  apiClient,
  examAPI,
  formatApiError,
  type ExamSession,
  type Question,
} from "@/core/config/api";
import { useMonitoring } from "@/shared/hooks/use-monitoring";
import { useExamAttempt } from "@/features/session/hooks/use-exam-attempt";

export type MonitoringDockPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export const DOCK_STORAGE_KEY = "knowing-eye-monitoring-dock-position";

export function useExamTaking() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const attempt = useExamAttempt(sessionId ?? undefined);
  const session = attempt.session;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeSpent, setTimeSpent] = useState<Record<number, number>>({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [behaviorAlerts, setBehaviorAlerts] = useState<string[]>([]);
  const [feedOpen, setFeedOpen] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMessage, setEnrollMessage] = useState<string | null>(null);
  const [dockPosition, setDockPosition] = useState<MonitoringDockPosition>(() => {
    const saved = localStorage.getItem(DOCK_STORAGE_KEY);
    if (saved === "bottom-left" || saved === "top-right" || saved === "top-left") return saved;
    return "bottom-right";
  });

  const monitoring = useMonitoring({
    sessionId: session?.id,
    intervalMs: 1000,
  });

  const monitoringEnabled = session?.exam?.monitoring_enabled !== false;
  const webcamActive =
    monitoringEnabled &&
    (monitoring.status === "live" || monitoring.status === "fallback-rest");

  const questions = (session?.exam.questions ?? []) as Question[];
  const activeQuestion = questions[currentQuestion];
  const answeredCount = questions.filter(
    (q) => (attempt.answers[q.id]?.answer_text ?? "").trim().length > 0
  ).length;
  const progress = questions.length ? (answeredCount / questions.length) * 100 : 0;
  const flaggedCount = Object.values(attempt.answers).filter((a) => a.flagged_for_review).length;

  const handleAutoSubmit = useCallback(async () => {
    if (!session) return;

    try {
      const responses = attempt.buildSubmitPayload(session.exam.questions ?? []);
      await examAPI.submitSession(session.id, responses, 0);
      attempt.clearLocal();

      navigate(`/examinee/exam/${examId}/submitted`, {
        state: { autoSubmitted: true },
      });
    } catch (err) {
      console.error("Auto-submit failed:", err);
      navigate(`/examinee/exam/${examId}/submitted`, {
        state: { autoSubmitted: true, error: true },
      });
    }
  }, [attempt, examId, navigate, session]);

  useEffect(() => {
    const loadExamSession = async () => {
      const eid = parseInt(examId!, 10);
      try {
        setLoading(true);
        const fromState = (location.state as { session?: ExamSession } | null)?.session;
        let examSession = fromState;
        if (!examSession || examSession.status !== "in_progress") {
          const sessions = await apiClient.listSessions({
            exam: eid,
            status: "in_progress",
          });
          examSession = sessions[0];
        }
        if (!examSession || examSession.status !== "in_progress") {
          navigate(`/examinee/exam/${eid}/setup`, { replace: true });
          return;
        }
        setSessionId(examSession.id);
        const initialTimeSpent: Record<number, number> = {};
        examSession.exam.questions?.forEach((_q, index) => {
          initialTimeSpent[index] = 0;
        });
        setTimeSpent(initialTimeSpent);
      } catch (err) {
        setError(formatApiError(err, "Failed to load exam"));
      } finally {
        setLoading(false);
      }
    };

    if (examId) void loadExamSession();
  }, [examId, location.state, navigate]);

  useEffect(() => {
    if (attempt.timeRemaining === 0 && session?.status === "in_progress" && !submitting) {
      void handleAutoSubmit();
    }
  }, [attempt.timeRemaining, handleAutoSubmit, session?.status, submitting]);

  useEffect(() => {
    if (!sessionId) return;
    const onVisibility = () => {
      const event = document.hidden ? "tab_hidden" : "tab_visible";
      void apiClient.logSessionEvent(sessionId, event).catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [sessionId]);

  useEffect(() => {
    const questionTimer = setInterval(() => {
      setTimeSpent((prev) => ({
        ...prev,
        [currentQuestion]: (prev[currentQuestion] || 0) + 1,
      }));
    }, 1000);
    return () => clearInterval(questionTimer);
  }, [currentQuestion]);

  useEffect(() => {
    if (!session?.id || !monitoringEnabled) return;
    monitoring.start();
    return () => monitoring.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, monitoringEnabled]);

  useEffect(() => {
    if (!monitoringEnabled || !monitoring.alerts.length) return;
    setBehaviorAlerts(
      monitoring.alerts.slice(0, 3).map((a) => a.message || "Compliance alert")
    );
  }, [monitoringEnabled, monitoring.alerts]);

  const handleReEnroll = async () => {
    setEnrolling(true);
    setEnrollMessage(null);
    try {
      const result = await monitoring.enrollReference();
      setEnrollMessage(result.ok ? "Identity updated." : result.message ?? "Enrollment failed.");
    } finally {
      setEnrolling(false);
    }
  };

  const handleAnswerSelect = (questionId: number, answer: string) => {
    const idx = session?.exam.questions?.findIndex((q) => q.id === questionId) ?? currentQuestion;
    attempt.setAnswer(questionId, {
      answer_text: answer,
      time_spent: timeSpent[idx] || 0,
      flagged_for_review: attempt.answers[questionId]?.flagged_for_review ?? false,
    });
  };

  const toggleFlag = (questionId: number) => {
    const current = attempt.answers[questionId];
    const idx = session?.exam.questions?.findIndex((q) => q.id === questionId) ?? currentQuestion;
    attempt.setAnswer(questionId, {
      answer_text: current?.answer_text ?? "",
      time_spent: timeSpent[idx] || 0,
      flagged_for_review: !current?.flagged_for_review,
    });
  };

  const handleSubmit = async () => {
    if (!session) return;

    setSubmitting(true);
    try {
      const responses = attempt.buildSubmitPayload(session.exam.questions ?? []);
      const result = await examAPI.submitSession(session.id, responses, attempt.timeRemaining);
      attempt.clearLocal();
      navigate(`/examinee/exam/${examId}/submitted`, {
        state: { session: result.session, results: result.results },
      });
    } catch (err) {
      setError(formatApiError(err, "Failed to submit exam"));
    } finally {
      setSubmitting(false);
      setShowSubmitModal(false);
    }
  };

  const setMonitoringDockPosition = (pos: MonitoringDockPosition) => {
    setDockPosition(pos);
    localStorage.setItem(DOCK_STORAGE_KEY, pos);
  };

  return {
    examId,
    navigate,
    loading,
    error,
    submitting,
    session,
    attempt,
    questions,
    activeQuestion,
    currentQuestion,
    setCurrentQuestion,
    answeredCount,
    progress,
    flaggedCount,
    showSubmitModal,
    setShowSubmitModal,
    monitoring,
    monitoringEnabled,
    webcamActive,
    behaviorAlerts,
    feedOpen,
    setFeedOpen,
    enrolling,
    enrollMessage,
    dockPosition,
    setMonitoringDockPosition,
    handleReEnroll,
    handleAnswerSelect,
    toggleFlag,
    handleSubmit,
  };
}
