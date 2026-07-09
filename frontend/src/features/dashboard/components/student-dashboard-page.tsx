import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  CalendarCheck,
  Camera,
  CameraOff,
  Clock,
  Eye,
  Loader2,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { type Exam, type SessionReportRow, formatApiError } from "@/core/config/api";
import { brand } from "@/core/config/brand";
import { useAuth } from "@/core/providers/auth-provider";
import { dashboardQueries } from "@/features/dashboard/queries/queries";
import { IconAction } from "@/shared/components/common/icon-action";
import { PageShell } from "@/shared/components/layout/page-shell";
import { SectionPanel } from "@/shared/components/layout/section-panel";
import { EmptyState } from "@/shared/components/patterns/empty-state";
import { Button } from "@/shared/components/ui/button";

type DashboardExam = {
  id: string;
  title: string;
  course: string;
  date: string;
  duration: string;
  type: "upcoming" | "completed";
  monitoringEnabled: boolean;
  score?: number;
  passed?: boolean | null;
  sessionId?: string;
  attemptsLabel?: string;
  extraTime?: string | null;
};

function mapExamToCard(exam: Exam, type: "upcoming" | "completed"): DashboardExam {
  return {
    id: String(exam.id),
    title: exam.title,
    course: exam.exam_code ?? `Exam #${exam.id}`,
    date: exam.available_from
      ? new Date(exam.available_from).toLocaleDateString()
      : new Date(exam.created_at).toLocaleDateString(),
    duration: `${exam.duration_minutes} mins`,
    type,
    monitoringEnabled: exam.monitoring_enabled !== false,
  };
}

function mapSessionToCard(session: SessionReportRow): DashboardExam {
  const submitted = session.submitted_at
    ? new Date(session.submitted_at).toLocaleDateString()
    : new Date(session.started_at).toLocaleDateString();
  return {
    id: String(session.exam_id),
    sessionId: session.id,
    title: session.exam_title,
    course: `Attempt · ${submitted}`,
    date: submitted,
    duration: "",
    type: "completed",
    monitoringEnabled: false,
    score: session.percentage_score ?? undefined,
    passed: session.passed,
  };
}

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const todayStamp = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export function StudentDashboardPage() {
  const [showExamInstructions, setShowExamInstructions] = useState(false);
  const [selectedExam, setSelectedExam] = useState<DashboardExam | null>(null);
  const { user } = useAuth();

  const studentQuery = useQuery(dashboardQueries.student());

  const upcomingExams = useMemo(() => {
    const exams = studentQuery.data?.exams ?? [];
    return exams
      .filter((e) => e.is_open !== false && (e.attempts_remaining ?? 1) > 0)
      .map((e) => ({
        ...mapExamToCard(e, "upcoming"),
        attemptsLabel:
          e.attempts_remaining == null
            ? "Unlimited attempts"
            : `${e.attempts_remaining} attempt(s) left`,
        extraTime: e.extra_time_minutes ? `+${e.extra_time_minutes} min accommodation` : null,
      }));
  }, [studentQuery.data?.exams]);

  const completedExams = useMemo(() => {
    const sessions = studentQuery.data?.sessions ?? [];
    return sessions.map(mapSessionToCard);
  }, [studentQuery.data?.sessions]);

  const loading = studentQuery.isLoading;
  const error =
    studentQuery.error != null ? formatApiError(studentQuery.error, "Could not load exams") : null;

  const handleStartExam = (exam: DashboardExam) => {
    setSelectedExam(exam);
    setShowExamInstructions(true);
  };

  return (
    <PageShell>
      {/* Greeting band — warm, personal, wellness-toned */}
      <section className="greeting-band greeting-band--examinee px-5 py-5 sm:px-6">
        <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="kicker">{brand.departmentName}</p>
            <h1 className="mt-2 font-serif text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
              {timeOfDayGreeting()}, {user?.username ?? "there"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {upcomingExams.length > 0 ? (
                <>
                  You have{" "}
                  <strong className="font-semibold text-foreground">
                    {upcomingExams.length} exam{upcomingExams.length === 1 ? "" : "s"}
                  </strong>{" "}
                  ready to take. Breathe, settle in, and start when you feel prepared.
                </>
              ) : (
                "Nothing is due right now — a good moment to rest and review."
              )}
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
              {todayStamp}
            </p>
            <p className="inline-flex items-center gap-1.5 rounded-md border border-care/30 bg-care/10 px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-care">
              <Sparkles className="h-3 w-3" />
              You've got this
            </p>
          </div>
        </div>
      </section>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading exams…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <SectionPanel title="Available" description="Exams published and ready to take.">
        {upcomingExams.length === 0 && !loading ? (
          <EmptyState
            icon={CalendarCheck}
            title="No active exams right now"
            description="Check back when your examiner publishes one — you'll see it here first."
          />
        ) : (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {upcomingExams.map((exam) => (
              <article
                key={exam.id}
                className="surface-panel-interactive relative flex flex-col overflow-hidden p-5"
              >
                <span
                  className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-secondary via-secondary/60 to-transparent"
                  aria-hidden
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-mono text-[0.6875rem] tracking-[0.06em] text-secondary">
                    {exam.course}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] ${
                      exam.monitoringEnabled
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                    title={
                      exam.monitoringEnabled
                        ? "Webcam proctoring is required"
                        : "No webcam required"
                    }
                  >
                    {exam.monitoringEnabled ? (
                      <Camera className="h-3 w-3" />
                    ) : (
                      <CameraOff className="h-3 w-3" />
                    )}
                    {exam.monitoringEnabled ? "Proctored" : "Open"}
                  </span>
                </div>

                <h3 className="mt-2.5 line-clamp-2 font-serif text-lg font-semibold leading-snug tracking-tight">
                  {exam.title}
                </h3>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {exam.date}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums">
                    <Clock className="h-3.5 w-3.5" />
                    {exam.duration}
                  </span>
                </div>

                {(exam.attemptsLabel || exam.extraTime) && (
                  <div className="mt-2 space-y-0.5">
                    {exam.attemptsLabel && (
                      <p className="text-xs font-medium text-secondary">{exam.attemptsLabel}</p>
                    )}
                    {exam.extraTime && <p className="text-xs text-care">{exam.extraTime}</p>}
                  </div>
                )}

                <Button className="mt-5 w-full" onClick={() => handleStartExam(exam)}>
                  <PlayCircle className="h-4 w-4" />
                  Start exam
                </Button>
              </article>
            ))}
          </div>
        )}
      </SectionPanel>

      <SectionPanel title="Completed" description="Past attempts and scores.">
        {completedExams.length === 0 && !loading ? (
          <EmptyState
            icon={Eye}
            title="No completed exams yet"
            description="Your submitted attempts and scores will be listed here."
          />
        ) : (
          <div className="divide-y divide-border/60">
            {completedExams.map((exam) => (
              <div key={exam.sessionId ?? exam.id} className="flex items-center gap-4 px-5 py-3.5">
                <span
                  className={`h-9 w-[3px] shrink-0 rounded ${
                    exam.passed == null
                      ? "bg-border"
                      : exam.passed
                        ? "bg-status-safe"
                        : "bg-status-alert"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-tight">{exam.title}</p>
                  <p className="mt-0.5 truncate font-mono text-[0.6875rem] text-muted-foreground">
                    {exam.course}
                  </p>
                </div>
                {exam.passed != null && (
                  <span
                    className={`status-pill hidden sm:inline-flex ${
                      exam.passed
                        ? "bg-status-safe/12 text-status-safe"
                        : "bg-status-alert/12 text-status-alert"
                    }`}
                  >
                    {exam.passed ? "Passed" : "Not passed"}
                  </span>
                )}
                <p className="w-16 text-right font-mono text-lg font-medium tabular-nums">
                  {exam.score != null ? `${exam.score}%` : "—"}
                </p>
                <IconAction
                  label="View results"
                  icon={Eye}
                  tone="primary"
                  to={`/examinee/exam/${exam.id}/results`}
                />
              </div>
            ))}
          </div>
        )}
      </SectionPanel>

      {showExamInstructions && selectedExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="surface-panel w-full max-w-lg p-6">
            <p className="kicker">Before you begin</p>
            <h3 className="mt-1.5 font-serif text-xl font-semibold tracking-tight">
              {selectedExam.title}
            </h3>
            <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-muted-foreground">
              {selectedExam.monitoringEnabled ? (
                <>
                  <li>Enable your webcam and stay in frame</li>
                  <li>Do not switch tabs during the session</li>
                  <li>Behavior monitoring stays active throughout</li>
                </>
              ) : (
                <>
                  <li>No webcam or identity check is required</li>
                  <li>Read each question carefully before answering</li>
                  <li>You can flag questions to revisit before submitting</li>
                </>
              )}
              <li>Duration: {selectedExam.duration}</li>
            </ul>
            {selectedExam.monitoringEnabled && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-status-watch/25 bg-status-watch/10 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-watch" />
                <p className="text-sm text-status-watch">
                  Suspicious activity may be flagged for examiner review.
                </p>
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowExamInstructions(false)}
              >
                Cancel
              </Button>
              <Button asChild className="flex-1">
                <Link
                  to={`/examinee/exam/${selectedExam.id}/setup`}
                  onClick={() => setShowExamInstructions(false)}
                >
                  Begin exam
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
