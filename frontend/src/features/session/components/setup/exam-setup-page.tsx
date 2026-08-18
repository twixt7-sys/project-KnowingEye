import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  ScanFace,
} from "@/shared/icons";

import {
  apiClient,
  formatApiError,
  type Exam,
  type ExamSession,
} from "@/core/config/api";
import { CameraStep } from "@/features/session/components/setup/camera-step";
import { IdentityStep } from "@/features/session/components/setup/identity-step";
import { ReadyStep } from "@/features/session/components/setup/ready-step";
import { RulesStep } from "@/features/session/components/setup/rules-step";
import {
  SetupStepFlow,
  type SetupStep,
} from "@/features/session/components/setup/setup-step-flow";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { useMonitoring } from "@/shared/hooks/use-monitoring";

export function ExamSetupPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const id = Number(examId);

  const [step, setStep] = useState<SetupStep>("rules");
  const [exam, setExam] = useState<Exam | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollCount, setEnrollCount] = useState(0);
  const [enrolling, setEnrolling] = useState(false);
  const [beginning, setBeginning] = useState(false);
  const [refreshingSession, setRefreshingSession] = useState(false);
  const [systemCheck, setSystemCheck] = useState<"pending" | "ok" | "fail">("pending");
  const refreshLockRef = useRef(false);
  const refreshSetupSessionRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (step !== "camera") return;
    let cancelled = false;
    void navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        if (!cancelled) setSystemCheck("ok");
      })
      .catch(() => {
        if (!cancelled) setSystemCheck("fail");
      });
    return () => {
      cancelled = true;
    };
  }, [step]);

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

  const monitoringEnabled = exam?.monitoring_enabled !== false;

  useEffect(() => {
    if (!id || Number.isNaN(id)) return;
    (async () => {
      setLoading(true);
      try {
        const examData = await apiClient.getExam(id);
        setExam(examData);

        if (examData.monitoring_enabled === false) {
          const inProgress = await apiClient.listSessions({
            exam: id,
            status: "in_progress",
          });
          if (inProgress[0]) {
            navigate(`/examinee/exam/${id}`, {
              replace: true,
              state: { session: inProgress[0] },
            });
            return;
          }
          return;
        }

        const sess = await apiClient.startExamSession(id);
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
    const needsCamera = step === "camera" || step === "identity" || step === "ready";
    if (needsCamera && session?.id) {
      void monitoring.start();
    } else if (step === "rules") {
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
    if (step !== "identity" || !webcamLive || enrolling || enrollCount >= 1 || refreshingSession) {
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

  const checklist = useMemo(
    () => [
      { label: "Browser & camera", ok: systemCheck === "ok", hint: "Webcam permission granted" },
      { label: "Face detected", ok: faceDetected, hint: "Align your face inside the guide" },
      { label: "Identity enrolled", ok: identityOk, hint: "Reference photo captured securely" },
      { label: "Upper body visible", ok: postureOk, hint: "Shoulders and torso in frame" },
    ],
    [systemCheck, faceDetected, identityOk, postureOk]
  );

  const checklistScore = checklist.filter((c) => c.ok).length;

  const handleBegin = async () => {
    if (!monitoringEnabled) {
      setBeginning(true);
      setError(null);
      try {
        const updated = await apiClient.startExamSession(id);
        navigate(`/examinee/exam/${id}`, { state: { session: updated } });
      } catch (e) {
        setError(formatApiError(e));
      } finally {
        setBeginning(false);
      }
      return;
    }

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
        setError("Setup session expired — refreshing automatically…");
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {monitoringEnabled ? "Initializing proctoring environment…" : "Loading exam…"}
        </p>
      </div>
    );
  }

  if (error && !session && monitoringEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-md w-full border-destructive/30 bg-card backdrop-blur">
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative container max-w-5xl mx-auto py-10 px-4">
        <header className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <p className="kicker mb-2">
                {monitoringEnabled ? "Proctoring setup" : "Exam briefing"}
              </p>
              <h1 className="font-serif text-3xl font-semibold tracking-tight">
                {exam?.title ?? "Exam setup"}
              </h1>
              <p className="text-muted-foreground text-sm mt-1 max-w-xl">
                {monitoringEnabled
                  ? "Secure your session with identity verification and environment checks before the timed exam begins."
                  : "Review the instructions below, then start when you are ready. This exam does not use camera monitoring."}
              </p>
            </div>
            {monitoringEnabled && (
              <Badge variant={statusBadge.variant} className="mt-1">
                {webcamLive && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                )}
                {statusBadge.label}
              </Badge>
            )}
          </div>

          {monitoringEnabled && <SetupStepFlow step={step} />}
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-border bg-accent/50 px-4 py-3 text-sm text-accent-foreground flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {!monitoringEnabled && exam && (
          <RulesStep
            exam={exam}
            monitoringEnabled={false}
            beginning={beginning}
            onContinue={() => void handleBegin()}
          />
        )}

        {monitoringEnabled && step === "rules" && exam && (
          <RulesStep
            exam={exam}
            monitoringEnabled
            onContinue={() => setStep("camera")}
          />
        )}

        {monitoringEnabled && (step === "camera" || step === "identity" || step === "ready") && (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <CameraStep
                monitoring={monitoring}
                webcamLive={webcamLive}
                showContinue={step === "camera"}
                onContinue={() => setStep("identity")}
              />
            </div>

            <Card className="lg:col-span-2 border-border bg-card/70 backdrop-blur shadow-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ScanFace className="w-4 h-4 text-primary" />
                  Readiness checklist
                </CardTitle>
                <CardDescription className="text-muted-foreground">
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
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {item.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        {item.label}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 pl-6">{item.hint}</p>
                    </li>
                  ))}
                </ul>

                {step === "identity" && (
                  <IdentityStep
                    enrolling={enrolling}
                    faceDetected={faceDetected}
                    canCaptureIdentity={canCaptureIdentity}
                    onCapture={() => void runEnroll()}
                  />
                )}

                {step === "ready" && (
                  <ReadyStep
                    identityOk={identityOk}
                    beginning={beginning}
                    refreshingSession={refreshingSession}
                    onBegin={() => void handleBegin()}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
