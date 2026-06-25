import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Circle,
  Loader2,
  ScanFace,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Video,
} from "lucide-react";

import {
  apiClient,
  formatApiError,
  type Exam,
  type ExamSession,
} from "../core/config/api";
import { MonitoringVideoOverlay } from "../shared/components/monitoring/monitoring-video-overlay";
import { Badge } from "../shared/components/ui/badge";
import { Button } from "../shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../shared/components/ui/card";
import { Progress } from "../shared/components/ui/progress";
import { useMonitoring } from "../shared/hooks/use-monitoring";

type Step = "instructions" | "camera" | "enroll" | "ready";

const STEPS: { id: Step; label: string; icon: typeof Camera }[] = [
  { id: "instructions", label: "Briefing", icon: ShieldCheck },
  { id: "camera", label: "Camera", icon: Video },
  { id: "enroll", label: "Identity", icon: ScanFace },
  { id: "ready", label: "Launch", icon: Sparkles },
];

function stepIndex(step: Step) {
  return STEPS.findIndex((s) => s.id === step);
}

export function ExamSetup() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const id = Number(examId);

  const [step, setStep] = useState<Step>("instructions");
  const [exam, setExam] = useState<Exam | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollCount, setEnrollCount] = useState(0);
  const [enrolling, setEnrolling] = useState(false);
  const [beginning, setBeginning] = useState(false);
  const [refreshingSession, setRefreshingSession] = useState(false);
  const refreshLockRef = useRef(false);
  const refreshSetupSessionRef = useRef<(() => Promise<void>) | null>(null);

  const monitoring = useMonitoring({
    sessionId: session?.id,
    intervalMs: 1000,
    jpegQuality: 0.45,
    onSessionInactive: () => {
      void refreshSetupSessionRef.current?.();
    },
  });

  const refreshSetupSession = useCallback(async () => {
    if (!id || refreshLockRef.current) return;
    refreshLockRef.current = true;
    setRefreshingSession(true);
    try {
      monitoring.stop();
      setEnrollCount(0);
      const sess = await apiClient.startExamSession(id);
      setSession(sess);
      setStep("camera");
      setError(null);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      refreshLockRef.current = false;
      setRefreshingSession(false);
    }
  }, [id, monitoring]);

  useEffect(() => {
    refreshSetupSessionRef.current = refreshSetupSession;
  }, [refreshSetupSession]);

  const webcamLive =
    monitoring.status === "live" || monitoring.status === "fallback-rest";

  useEffect(() => {
    if (!id || Number.isNaN(id)) return;
    (async () => {
      setLoading(true);
      try {
        const [examData, sess] = await Promise.all([
          apiClient.getExam(id),
          apiClient.startExamSession(id),
        ]);
        setExam(examData);
        if (sess.status === "in_progress") {
          navigate(`/examinee/exam/${id}`, { replace: true, state: { session: sess } });
          return;
        }
        setSession(sess);
      } catch (e) {
        setError(formatApiError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  useEffect(() => {
    const needsCamera = step === "camera" || step === "enroll" || step === "ready";
    if (needsCamera && session?.id) {
      void monitoring.start();
    } else if (step === "instructions") {
      monitoring.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, session?.id]);

  useEffect(() => {
    return () => monitoring.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metrics = monitoring.analysis?.metrics;
  const faceDetected =
    (monitoring.analysis?.face?.count ?? 0) >= 1 ||
    (metrics?.face_presence_pct ?? 0) >= 40;
  const canCaptureIdentity = webcamLive && !enrolling && !refreshingSession;

  const { enrollReference } = monitoring;

  const runEnroll = useCallback(async () => {
    setEnrolling(true);
    setError(null);
    try {
      const result = await enrollReference();
      if (result.ok) {
        setEnrollCount(1);
        setStep("ready");
      } else {
        setError(result.message ?? "Could not capture your face. Center yourself and try again.");
      }
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setEnrolling(false);
    }
  }, [enrollReference]);

  useEffect(() => {
    if (step !== "enroll" || !webcamLive || enrolling || enrollCount >= 1 || refreshingSession) {
      return;
    }
    const timer = window.setTimeout(() => {
      void runEnroll();
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [step, webcamLive, enrollCount, enrolling, refreshingSession, runEnroll]);

  const identityOk = enrollCount >= 1;
  const postureOk =
    monitoring.analysis?.posture?.detected ||
    (monitoring.analysis?.face?.bbox_norm?.[3] ?? 0) >= 0.15;
  const objectsOk = (metrics?.object_clear_pct ?? 100) >= 80;

  const checklist = useMemo(
    () => [
      { label: "Face detected", ok: faceDetected, hint: "Align your face inside the guide" },
      { label: "Identity enrolled", ok: identityOk, hint: "Reference photo captured securely" },
      { label: "Upper body visible", ok: postureOk, hint: "Shoulders and torso in frame" },
      { label: "No prohibited objects", ok: objectsOk, hint: "Clear desk and background" },
    ],
    [faceDetected, identityOk, postureOk, objectsOk]
  );

  const checklistScore = checklist.filter((c) => c.ok).length;
  const progressValue = ((stepIndex(step) + 1) / STEPS.length) * 100;

  const handleBegin = async () => {
    if (!session) return;
    setBeginning(true);
    setError(null);
    try {
      const updated = await apiClient.beginExamSession(session.id);
      monitoring.stop();
      navigate(`/examinee/exam/${id}`, { state: { session: updated } });
    } catch (e) {
      const msg = formatApiError(e);
      if (msg.toLowerCase().includes("expired")) {
        setError("Setup session expired - refreshing automatically…");
        await refreshSetupSession();
      } else {
        setError(msg);
      }
    } finally {
      setBeginning(false);
    }
  };

  const statusBadge = (() => {
    if (refreshingSession) return { label: "Refreshing session", variant: "secondary" as const };
    if (monitoring.status === "live") return { label: "Live · WebSocket", variant: "default" as const };
    if (monitoring.status === "fallback-rest") return { label: "Live · REST", variant: "secondary" as const };
    if (monitoring.status === "connecting") return { label: "Connecting…", variant: "outline" as const };
    return { label: monitoring.status, variant: "outline" as const };
  })();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-slate-200">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-sm text-slate-400">Initializing proctoring environment…</p>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
        <Card className="max-w-md w-full border-destructive/30 bg-slate-900/80 backdrop-blur">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={() => navigate("/examinee")}>
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-slate-100">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative container max-w-5xl mx-auto py-10 px-4">
        <header className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-400/80 mb-2">
                Proctoring setup
              </p>
              <h1 className="text-3xl font-bold tracking-tight">{exam?.title ?? "Exam setup"}</h1>
              <p className="text-slate-400 text-sm mt-1 max-w-xl">
                Secure your session with identity verification and environment checks before the
                timed exam begins.
              </p>
            </div>
            <Badge variant={statusBadge.variant} className="mt-1">
              {webcamLive && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
              {statusBadge.label}
            </Badge>
          </div>

          <Progress value={progressValue} className="h-1.5 bg-slate-800" />

          <ol className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STEPS.map((s, i) => {
              const active = step === s.id;
              const done = stepIndex(step) > i;
              const Icon = s.icon;
              return (
                <li
                  key={s.id}
                  className={`rounded-lg border px-3 py-2.5 flex items-center gap-2 transition-colors ${
                    active
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : done
                        ? "border-emerald-500/20 bg-slate-800/60"
                        : "border-slate-700/60 bg-slate-900/40"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Icon
                      className={`w-4 h-4 shrink-0 ${active ? "text-emerald-400" : "text-slate-500"}`}
                    />
                  )}
                  <span className={`text-xs font-medium ${active ? "text-emerald-100" : "text-slate-400"}`}>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {step === "instructions" && (
          <Card className="border-slate-700/60 bg-slate-900/70 backdrop-blur shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Before you begin
              </CardTitle>
              <CardDescription className="text-slate-400">
                A quick environment check keeps the exam fair for everyone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="grid sm:grid-cols-2 gap-3 text-sm">
                {[
                  "Allow camera access when prompted.",
                  "Sit upright with face and shoulders visible.",
                  "Use good lighting and a tidy background.",
                  "The exam timer starts only after this setup.",
                ].map((text) => (
                  <li
                    key={text}
                    className="flex items-start gap-2 rounded-md border border-slate-700/50 bg-slate-800/40 px-3 py-2.5 text-slate-300"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    {text}
                  </li>
                ))}
              </ul>
              <Button
                size="lg"
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500"
                onClick={() => setStep("camera")}
              >
                Continue to camera check
              </Button>
            </CardContent>
          </Card>
        )}

        {(step === "camera" || step === "enroll" || step === "ready") && (
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3 border-slate-700/60 bg-slate-900/70 backdrop-blur shadow-2xl overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  Live proctoring preview
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Match your position to the user outline - green means you are aligned.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black ring-1 ring-slate-700/80 shadow-inner">
                  <video
                    ref={monitoring.videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-cover scale-x-[-1]"
                  />
                  <MonitoringVideoOverlay
                    videoRef={monitoring.videoRef}
                    analysis={monitoring.analysis}
                    showPostureGuide
                    mirrored
                  />
                  {webcamLive && (
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-red-600/90 border-0 text-[10px] uppercase tracking-wider">
                        Rec
                      </Badge>
                    </div>
                  )}
                </div>
                {step === "camera" && webcamLive && (
                  <Button
                    className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500"
                    onClick={() => setStep("enroll")}
                  >
                    Camera looks good - verify identity
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-slate-700/60 bg-slate-900/70 backdrop-blur shadow-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ScanFace className="w-4 h-4 text-emerald-400" />
                  Readiness checklist
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {checklistScore}/{checklist.length} checks passing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {checklist.map((item) => (
                    <li
                      key={item.label}
                      className={`rounded-lg border px-3 py-2.5 transition-colors ${
                        item.ok
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-slate-700/50 bg-slate-800/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {item.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        {item.label}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 pl-6">{item.hint}</p>
                    </li>
                  ))}
                </ul>

                {step === "enroll" && (
                  <div className="space-y-3 pt-2 border-t border-slate-700/50">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      {enrolling
                        ? "Capturing reference face - first run may take up to a minute…"
                        : faceDetected
                          ? "Face detected - enrolling automatically"
                          : "Align yourself in the guide, then capture"}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full border-slate-600 hover:bg-slate-800"
                      disabled={!canCaptureIdentity}
                      onClick={() => void runEnroll()}
                    >
                      {enrolling ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Enrolling…
                        </>
                      ) : (
                        "Capture identity now"
                      )}
                    </Button>
                  </div>
                )}

                {step === "ready" && (
                  <div className="pt-2 border-t border-slate-700/50 space-y-3">
                    <p className="text-sm text-emerald-300/90 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Identity verified - you are cleared to start.
                    </p>
                    <Button
                      size="lg"
                      className="w-full bg-emerald-600 hover:bg-emerald-500"
                      disabled={!identityOk || beginning || refreshingSession}
                      onClick={handleBegin}
                    >
                      {beginning ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Starting exam…
                        </>
                      ) : (
                        "Begin exam"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
