import { AlertCircle, Sparkles } from "@/shared/icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { formatApiError } from "@/core/config/api";
import { brand } from "@/core/config/brand";
import { useAuth } from "@/core/providers/auth-provider";
import { StudentAvailableExams } from "@/features/dashboard/components/student-available-exams";
import { StudentCompletedExams } from "@/features/dashboard/components/student-completed-exams";
import { type DashboardExam, isTakeable } from "@/features/dashboard/lib/student-exams";
import { dashboardQueries } from "@/features/dashboard/queries/queries";
import { PageShell } from "@/shared/components/layout/page-shell";
import { Button } from "@/shared/components/ui/button";

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

  const examsQuery = useQuery(dashboardQueries.studentExams());

  const availableExams = useMemo(
    () => (examsQuery.data ?? []).filter(isTakeable),
    [examsQuery.data],
  );

  const loading = examsQuery.isLoading;
  const error =
    examsQuery.error != null ? formatApiError(examsQuery.error, "Could not load exams") : null;

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
              {loading ? (
                "Checking for your exams…"
              ) : availableExams.length > 0 ? (
                <>
                  You have{" "}
                  <strong className="font-semibold text-foreground">
                    {availableExams.length} exam{availableExams.length === 1 ? "" : "s"}
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

      <StudentAvailableExams
        exams={availableExams}
        loading={loading}
        fetching={examsQuery.isFetching}
        error={error}
        onStart={handleStartExam}
      />

      <StudentCompletedExams />

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
