import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Camera,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  Loader2,
} from "lucide-react";
import { examAPI, type ExamSession, type ResponseData } from "../core/config/api";

export function ExamTakingWithBackend() {
  const { examId } = useParams();
  const navigate = useNavigate();

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
  const [webcamActive] = useState(true);

  // Load exam session on component mount
  useEffect(() => {
    const loadExamSession = async () => {
      try {
        setLoading(true);
        const examSession = await examAPI.startSession(parseInt(examId!, 10));
        setSession({
          ...examSession,
          time_remaining: examSession.time_remaining_seconds ?? examSession.exam.duration_minutes * 60,
          duration: examSession.exam.duration_minutes * 60,
        } as ExamSession);

        // Initialize time spent tracking for each question
        const initialTimeSpent: { [key: number]: number } = {};
        examSession.exam.questions.forEach((_: any, index: number) => {
          initialTimeSpent[index] = 0;
        });
        setTimeSpent(initialTimeSpent);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start exam');
      } finally {
        setLoading(false);
      }
    };

    if (examId) {
      loadExamSession();
    }
  }, [examId]);

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

  // Behavior monitoring — capture webcam frames and send to backend
  useEffect(() => {
    if (!webcamActive || !session?.id) return;

    let stream: MediaStream | null = null;
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = stream;
        await video.play();
      } catch (err) {
        console.warn("Webcam unavailable:", err);
      }
    };

    startCamera();

    const monitoringInterval = setInterval(async () => {
      if (!stream || !ctx || video.videoWidth === 0) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.6);

      try {
        const result = await examAPI.sendMonitoringFrame(dataUrl, session.id);
        const alerts = result?.analysis?.alerts ?? [];
        if (alerts.length) {
          const messages = alerts.map((a: { message?: string }) => a.message || "Compliance alert");
          setBehaviorAlerts((prev) => [...messages, ...prev].slice(0, 3));
        }
      } catch (err) {
        console.warn("Monitoring frame failed:", err);
      }
    }, 5000);

    return () => {
      clearInterval(monitoringInterval);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [webcamActive, session?.id]);

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
      navigate(`/student/exam/${examId}/submitted`, {
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

      navigate(`/student/exam/${examId}/submitted`, {
        state: { autoSubmitted: true }
      });
    } catch (err) {
      console.error('Auto-submit failed:', err);
      // Still navigate even if auto-submit fails
      navigate(`/student/exam/${examId}/submitted`, {
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
            onClick={() => navigate('/student/dashboard')}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const questions = session.exam.questions;
  const answeredCount = Object.keys(answers).filter(key => answers[parseInt(key)]).length;
  const progress = (answeredCount / questions.length) * 100;
  const timeRemaining = session.time_remaining || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header with timer and webcam status */}
      <div className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
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
              {behaviorAlerts.length > 0 && (
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
                    onClick={() => toggleFlag(currentQuestion)}
                    className={`p-2 rounded-lg transition-colors ${
                      flaggedQuestions.has(currentQuestion)
                        ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                        : "hover:bg-accent"
                    }`}
                  >
                    <Flag
                      className={`w-5 h-5 ${
                        flaggedQuestions.has(currentQuestion) ? "fill-current" : ""
                      }`}
                    />
                  </button>
                </div>
                <p className="text-lg mb-6">
                  {questions[currentQuestion].question_text}
                </p>
              </div>

              {/* Options */}
              <div className="space-y-3 mb-8">
                {questions[currentQuestion].options.map((option: any, index: number) => (
                  <button
                    key={index}
                    onClick={() =>
                      handleAnswerSelect(currentQuestion, option)
                    }
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      answers[currentQuestion] === option
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          answers[currentQuestion] === option
                            ? "border-primary bg-primary"
                            : "border-muted-foreground"
                        }`}
                      >
                        {answers[currentQuestion] === option && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span>{option}</span>
                    </div>
                  </button>
                ))}
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

            {/* Webcam feed */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-4">Monitoring Feed</h3>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                <Camera className="w-16 h-16 text-muted-foreground" />
                <div className="absolute top-3 left-3 px-3 py-1 bg-red-500 text-white text-xs rounded-full flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Recording
                </div>
                <div className="absolute bottom-3 left-3 text-xs text-muted-foreground">
                  Backend monitoring active
                </div>
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
                  {questions.map((_: any, index: number) => (
                    <button
                      key={index}
                      onClick={() => setCurrentQuestion(index)}
                      className={`aspect-square rounded-lg text-sm font-medium transition-all relative ${
                        currentQuestion === index
                          ? "bg-primary text-white ring-2 ring-primary ring-offset-2 ring-offset-background"
                          : answers[index]
                          ? "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {index + 1}
                      {flaggedQuestions.has(index) && (
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