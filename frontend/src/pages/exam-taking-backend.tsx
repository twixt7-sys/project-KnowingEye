import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  Camera,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Flag,
  Loader2,
  CornerDownLeft,
  CornerDownRight,
  CornerUpLeft,
  CornerUpRight,
  ScanFace,
  UserCheck,
  Eye,
  PersonStanding,
  type LucideIcon,
} from "lucide-react";
import {
  examAPI,
  apiClient,
  type ExamSession,
  type Question,
  type ResponseData,
  type FrameMetrics,
  type QuestionAttachment,
} from "../core/config/api";
import { MonitoringVideoOverlay } from "../shared/components/monitoring/monitoring-video-overlay";
import { Textarea } from "../shared/components/ui/textarea";
import { useMonitoring } from "../shared/hooks/use-monitoring";

/**
 * Behavioral parameters detected on the examinee side, mapped to the study
 * objectives (Objective 3: real-time CV analysis; Objective 4: deep learning).
 *  - metricKey: numeric value field on FrameMetrics
 *  - flagKey:   matching entry inside metrics.flagged_metrics
 */
const DETECTION_PARAMS: {
  metricKey: keyof FrameMetrics;
  flagKey: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { metricKey: "face_presence_pct", flagKey: "face_presence", label: "Face presence", icon: ScanFace },
  { metricKey: "identity_match_pct", flagKey: "identity", label: "Identity match", icon: UserCheck },
  { metricKey: "gaze_focus_pct", flagKey: "gaze_focus", label: "Head facing camera", icon: Eye },
  { metricKey: "posture_compliance_pct", flagKey: "posture", label: "Upper body visible", icon: PersonStanding },
];

type MonitoringDockPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

const DOCK_POSITIONS: {
  id: MonitoringDockPosition;
  label: string;
  className: string;
  icon: typeof CornerDownRight;
}[] = [
  { id: "bottom-right", label: "Bottom right", className: "bottom-4 right-4", icon: CornerDownRight },
  { id: "bottom-left", label: "Bottom left", className: "bottom-4 left-4", icon: CornerDownLeft },
  { id: "top-right", label: "Top right", className: "top-20 right-4", icon: CornerUpRight },
  { id: "top-left", label: "Top left", className: "top-20 left-4", icon: CornerUpLeft },
];

const DOCK_STORAGE_KEY = "knowing-eye-monitoring-dock-position";

function choiceOptions(question: Question): string[] {
  if (question.question_type === "true_false") {
    return question.options?.length >= 2 ? question.options : ["True", "False"];
  }
  return question.options ?? [];
}

function QuestionAnswerFields({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (answer: string) => void;
}) {
  const qtype = question.question_type;

  if (qtype === "short_answer") {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground" htmlFor={`answer-${question.id}`}>
          Your answer
        </label>
        <input
          id={`answer-${question.id}`}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer here…"
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
    );
  }

  if (qtype === "essay") {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground" htmlFor={`answer-${question.id}`}>
          Your response
        </label>
        <Textarea
          id={`answer-${question.id}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your essay response here…"
          rows={8}
          className="min-h-40"
        />
        <p className="text-xs text-muted-foreground">
          Essay responses may be flagged for manual review.
        </p>
      </div>
    );
  }

  const options = choiceOptions(question);
  if (options.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        This question has no answer choices configured. You can skip it or contact your instructor.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {options.map((option, index) => (
        <button
          key={`${question.id}-${index}`}
          type="button"
          onClick={() => onChange(option)}
          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
            value === option
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-accent/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                value === option ? "border-primary bg-primary" : "border-muted-foreground"
              }`}
            >
              {value === option && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
            <span>{option}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function QuestionAttachments({ attachments }: { attachments?: QuestionAttachment[] }) {
  if (!attachments?.length) return null;
  return (
    <div className="mb-6 space-y-3">
      {attachments.map((att) => (
        <div key={att.id} className="rounded-lg border bg-muted/30 p-3">
          {att.kind === "image" && (
            <img src={att.url} alt={att.caption || "Question image"} className="max-h-64 rounded-md mx-auto" />
          )}
          {att.kind === "pdf" && (
            <a href={att.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
              Open PDF{att.caption ? `: ${att.caption}` : ""}
            </a>
          )}
          {att.kind === "audio" && (
            <audio controls src={att.url} className="w-full">
              Audio attachment
            </audio>
          )}
        </div>
      ))}
    </div>
  );
}

export function ExamTakingWithBackend() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Backend integration state
  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state (same as original)
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [timeSpent, setTimeSpent] = useState<{ [key: number]: number }>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(
    new Set()
  );
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [behaviorAlerts, setBehaviorAlerts] = useState<string[]>([]);
  const [feedOpen, setFeedOpen] = useState(true);
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

  // Load in-progress session (must complete setup first)
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
        const fresh = await apiClient.getSession(examSession.id);
        setSession({
          ...fresh,
          time_remaining: fresh.time_remaining_seconds ?? fresh.exam.duration_minutes * 60,
        } as ExamSession & { time_remaining?: number });

        const initialTimeSpent: { [key: number]: number } = {};
        fresh.exam.questions?.forEach((_, index) => {
          initialTimeSpent[index] = 0;
        });
        setTimeSpent(initialTimeSpent);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load exam");
      } finally {
        setLoading(false);
      }
    };

    if (examId) loadExamSession();
  }, [examId, location.state, navigate]);

  // Timer countdown (now uses session duration)
  useEffect(() => {
    if (!session?.duration) return;

    const timer = setInterval(() => {
      setSession((prev: ExamSession | null) => {
        if (!prev) return prev;
        const newTimeRemaining = Math.max(0, ((prev.time_remaining ?? prev.duration) || 0) - 1);

        if (newTimeRemaining === 0) {
          clearInterval(timer);
          handleAutoSubmit();
          return prev;
        }

        return {
          ...prev,
          time_remaining: newTimeRemaining
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [session?.duration]);

  // Question timer (tracks time spent per question)
  useEffect(() => {
    const questionTimer = setInterval(() => {
      setTimeSpent(prev => ({
        ...prev,
        [currentQuestion]: (prev[currentQuestion] || 0) + 1
      }));
    }, 1000);

    return () => clearInterval(questionTimer);
  }, [currentQuestion]);

  // Start monitoring as soon as the session is ready.
  useEffect(() => {
    if (!session?.id || !monitoringEnabled) return;
    monitoring.start();
    return () => monitoring.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, monitoringEnabled]);

  // Surface any alerts coming from the monitoring hook to the UI banner.
  useEffect(() => {
    if (!monitoringEnabled || !monitoring.alerts.length) return;
    setBehaviorAlerts(
      monitoring.alerts.slice(0, 3).map((a) => a.message || "Compliance alert")
    );
  }, [monitoringEnabled, monitoring.alerts]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAnswerSelect = (questionId: number, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const toggleFlag = (questionId: number) => {
    const newFlagged = new Set(flaggedQuestions);
    if (newFlagged.has(questionId)) {
      newFlagged.delete(questionId);
    } else {
      newFlagged.add(questionId);
    }
    setFlaggedQuestions(newFlagged);
  };

  const handleSubmit = async () => {
    if (!session) return;

    setSubmitting(true);
    try {
      // Prepare responses data for backend
      const responses: ResponseData[] = session.exam.questions.map((question: any, index: number) => ({
        question_id: question.id,
        answer_text: answers[question.id] || '',
        time_spent: timeSpent[index] || 0,
      }));

      const result = await examAPI.submitSession(
        session.id,
        responses,
        session.time_remaining || 0
      );

      // Navigate to results page with session data
      navigate(`/examinee/exam/${examId}/submitted`, {
        state: { session: result.session, results: result.results }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit exam');
    } finally {
      setSubmitting(false);
      setShowSubmitModal(false);
    }
  };

  const handleAutoSubmit = async () => {
    if (!session) return;

    try {
      const responses: ResponseData[] = session.exam.questions.map((question: any, index: number) => ({
        question_id: question.id,
        answer_text: answers[question.id] || '',
        time_spent: timeSpent[index] || 0,
      }));

      await examAPI.submitSession(session.id, responses, 0);

      navigate(`/examinee/exam/${examId}/submitted`, {
        state: { autoSubmitted: true }
      });
    } catch (err) {
      console.error('Auto-submit failed:', err);
      // Still navigate even if auto-submit fails
      navigate(`/examinee/exam/${examId}/submitted`, {
        state: { autoSubmitted: true, error: true }
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Starting your exam session...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Error Loading Exam</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => navigate('/examinee')}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const questions = session.exam.questions as Question[];
  const activeQuestion = questions[currentQuestion];
  const activeAnswer = answers[activeQuestion?.id ?? 0] ?? "";
  const answeredCount = questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length;
  const progress = questions.length ? (answeredCount / questions.length) * 100 : 0;
  const timeRemaining = session.time_remaining || 0;
  const dockLayout = DOCK_POSITIONS.find((p) => p.id === dockPosition) ?? DOCK_POSITIONS[0];

  const setMonitoringDockPosition = (pos: MonitoringDockPosition) => {
    setDockPosition(pos);
    localStorage.setItem(DOCK_STORAGE_KEY, pos);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with timer and webcam status */}
      <div className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {monitoringEnabled && (
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  webcamActive
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                }`}
              >
                <Camera className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {webcamActive ? "Monitoring Active" : "Camera Offline"}
                </span>
              </div>
              )}
              {monitoringEnabled && behaviorAlerts.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {behaviorAlerts[behaviorAlerts.length - 1]}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary">
                <Clock className="w-5 h-5" />
                <span className="text-lg font-mono font-bold">
                  {formatTime(timeRemaining)}
                </span>
              </div>
              <button
                onClick={() => setShowSubmitModal(true)}
                disabled={submitting}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Exam'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main content */}
          <div className="lg:col-span-3">
            <div className="bg-card rounded-xl border border-border p-6 md:p-8 mb-6">
              {/* Question */}
              <div className="mb-6">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-xl font-semibold">
                    Question {currentQuestion + 1} of {questions.length}
                  </h2>
                  <button
                    onClick={() => toggleFlag(activeQuestion.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      flaggedQuestions.has(activeQuestion.id)
                        ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                        : "hover:bg-accent"
                    }`}
                  >
                    <Flag
                      className={`w-5 h-5 ${
                        flaggedQuestions.has(activeQuestion.id) ? "fill-current" : ""
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  {activeQuestion.question_type.replace("_", " ")}
                </p>
                <p className="text-lg mb-6">
                  {activeQuestion.question_text}
                </p>
                <QuestionAttachments attachments={activeQuestion.attachments} />
              </div>

              <div className="mb-8">
                <QuestionAnswerFields
                  question={activeQuestion}
                  value={activeAnswer}
                  onChange={(answer) => handleAnswerSelect(activeQuestion.id, answer)}
                />
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center pt-6 border-t border-border">
                <button
                  onClick={() =>
                    setCurrentQuestion(Math.max(0, currentQuestion - 1))
                  }
                  disabled={currentQuestion === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Previous
                </button>
                <button
                  onClick={() =>
                    setCurrentQuestion(
                      Math.min(questions.length - 1, currentQuestion + 1)
                    )
                  }
                  disabled={currentQuestion === questions.length - 1}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Progress */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold mb-4">Progress</h3>
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Answered</span>
                    <span className="font-medium">
                      {answeredCount}/{questions.length}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {flaggedQuestions.size} question(s) flagged for review
                </div>
              </div>

              {/* Question grid */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold mb-4">All Questions</h3>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, index) => (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestion(index)}
                      className={`aspect-square rounded-lg text-sm font-medium transition-all relative ${
                        currentQuestion === index
                          ? "bg-primary text-white ring-2 ring-primary ring-offset-2 ring-offset-background"
                          : (answers[q.id] ?? "").trim()
                          ? "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {index + 1}
                      {flaggedQuestions.has(q.id) && (
                        <Flag className="w-3 h-3 absolute -top-1 -right-1 fill-orange-500 text-orange-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating monitoring feed - repositionable, video + metrics side by side */}
      {monitoringEnabled && (
      <div
        className={`fixed z-40 max-w-[calc(100vw-2rem)] ${dockLayout.className} ${
          feedOpen ? "w-[min(520px,calc(100vw-2rem))]" : "w-72"
        }`}
      >
        <div className="bg-card/95 backdrop-blur border border-border rounded-xl shadow-xl shadow-black/20 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60">
            <button
              type="button"
              onClick={() => setFeedOpen((v) => !v)}
              className="flex flex-1 items-center justify-between gap-2 py-1 hover:opacity-80 transition-opacity min-w-0"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Camera className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-sm truncate">Monitoring feed</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-xs font-medium ${
                    monitoring.analysis && monitoring.analysis.overall_compliance_pct < 80
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {monitoring.analysis
                    ? `${monitoring.analysis.overall_compliance_pct.toFixed(0)}%`
                    : "…"}
                </span>
                {feedOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                )}
              </span>
            </button>
            <div className="flex items-center gap-0.5 shrink-0 border-l border-border pl-2">
              {DOCK_POSITIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  title={`Move panel: ${label}`}
                  aria-label={`Move panel: ${label}`}
                  onClick={() => setMonitoringDockPosition(id)}
                  className={`p-1.5 rounded-md transition-colors ${
                    dockPosition === id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>

          {feedOpen && (
            <div className="p-3">
              <div className="flex flex-row gap-3 items-stretch">
                {/* Live camera */}
                <div className="w-[44%] min-w-[140px] shrink-0">
                  <div className="aspect-[3/4] bg-black rounded-lg relative overflow-hidden h-full min-h-[160px]">
                    <video
                      ref={monitoring.videoRef}
                      className="h-full w-full object-cover scale-x-[-1]"
                      autoPlay
                      muted
                      playsInline
                    />
                    <MonitoringVideoOverlay
                      videoRef={monitoring.videoRef}
                      analysis={monitoring.analysis}
                      showPostureGuide
                      guideSize="compact"
                      mirrored
                    />
                    {!webcamActive && (
                      <Camera className="absolute inset-0 m-auto w-10 h-10 text-muted-foreground" />
                    )}
                    <div
                      className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] rounded-full flex items-center gap-1 ${
                        webcamActive ? "bg-red-500 text-white" : "bg-gray-700 text-gray-200"
                      }`}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      {monitoring.status === "live"
                        ? "Live"
                        : monitoring.status === "fallback-rest"
                        ? "REST"
                        : monitoring.status}
                    </div>
                  </div>
                </div>

                {/* Detection parameters */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                    Detected parameters
                  </p>
                  <div className="space-y-2">
                    {DETECTION_PARAMS.map((param) => {
                      const metrics = monitoring.analysis?.metrics;
                      const raw = metrics ? metrics[param.metricKey] : null;
                      const value = typeof raw === "number" ? raw : null;
                      const flagged = metrics?.flagged_metrics?.includes(param.flagKey);
                      return (
                        <div key={param.metricKey}>
                          <div className="flex items-center justify-between text-xs mb-0.5 gap-2">
                            <span className="flex items-center gap-1 text-muted-foreground min-w-0 truncate">
                              <param.icon className="w-3 h-3 shrink-0" />
                              <span className="truncate">{param.label}</span>
                            </span>
                            <span
                              className={`font-medium shrink-0 ${
                                flagged
                                  ? "text-red-600 dark:text-red-400"
                                  : value === null
                                  ? "text-muted-foreground"
                                  : "text-foreground"
                              }`}
                            >
                              {value === null ? "n/a" : `${value.toFixed(0)}%`}
                            </span>
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                flagged
                                  ? "bg-red-500"
                                  : "bg-gradient-to-r from-primary to-secondary"
                              }`}
                              style={{ width: `${value ?? 0}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                    <UserCheck className="w-3 h-3 shrink-0" />
                    Identity verified during setup
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Submit Modal */}
      {showSubmitModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSubmitModal(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-semibold mb-2">Submit Exam?</h3>
              <p className="text-muted-foreground">
                Are you sure you want to submit your exam? This action cannot be
                undone.
              </p>
            </div>

            <div className="bg-accent/50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Answered:</span>
                  <div className="font-medium">
                    {answeredCount}/{questions.length}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Unanswered:</span>
                  <div className="font-medium text-orange-600 dark:text-orange-400">
                    {questions.length - answeredCount}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 px-4 py-3 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                Continue Exam
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-primary to-secondary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}