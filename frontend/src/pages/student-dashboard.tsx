import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Calendar,
  Clock,
  AlertCircle,
  PlayCircle,
  Eye,
  Loader2,
} from "lucide-react";
import { apiClient, type Exam } from "../core/config/api";
import { PageHeader } from "../shared/components/layout/page-header";
import { PageShell } from "../shared/components/layout/page-shell";
import { SectionPanel } from "../shared/components/layout/section-panel";
import { Button } from "../shared/components/ui/button";

type DashboardExam = {
  id: string;
  title: string;
  course: string;
  date: string;
  duration: string;
  type: "upcoming" | "completed";
  score?: number;
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
  };
}

export function StudentDashboard() {
  const [showExamInstructions, setShowExamInstructions] = useState(false);
  const [selectedExam, setSelectedExam] = useState<DashboardExam | null>(null);
  const [upcomingExams, setUpcomingExams] = useState<DashboardExam[]>([]);
  const [completedExams, setCompletedExams] = useState<DashboardExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const exams = await apiClient.getExams();
        setUpcomingExams(
          exams.filter((e) => e.status === "active").map((e) => mapExamToCard(e, "upcoming"))
        );
        setCompletedExams(
          exams.filter((e) => e.status === "archived").map((e) => mapExamToCard(e, "completed"))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load exams");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleStartExam = (exam: DashboardExam) => {
    setSelectedExam(exam);
    setShowExamInstructions(true);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Examinee"
        title="My exams"
        description="Start an available exam or review your completed attempts."
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading exams…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <SectionPanel
        title="Available"
        description="Exams published and ready to take."
      >
        {upcomingExams.length === 0 && !loading ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No active exams right now. Check back when your examiner publishes one.
          </div>
        ) : (
          <div className="grid gap-4 p-4 pt-0 md:grid-cols-2 xl:grid-cols-3">
            {upcomingExams.map((exam) => (
              <article key={exam.id} className="surface-panel-interactive p-5">
                <p className="text-xs font-medium text-primary">{exam.course}</p>
                <h3 className="mt-2 text-lg font-semibold">{exam.title}</h3>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {exam.date}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {exam.duration}
                  </div>
                </div>
                <Button className="mt-5 w-full" onClick={() => handleStartExam(exam)}>
                  <PlayCircle className="h-4 w-4" />
                  Start exam
                </Button>
              </article>
            ))}
          </div>
        )}
      </SectionPanel>

      <SectionPanel
        title="Completed"
        description="Past attempts and scores."
      >
        {completedExams.length === 0 && !loading ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No completed exams yet.
          </div>
        ) : (
          <div className="grid gap-4 p-4 pt-0 md:grid-cols-2">
            {completedExams.map((exam) => (
              <article key={exam.id} className="surface-panel p-5">
                <p className="text-xs text-muted-foreground">{exam.course}</p>
                <h3 className="mt-1 font-semibold">{exam.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{exam.date}</p>
                {exam.score != null && (
                  <p className="mt-3 text-2xl font-semibold text-primary">{exam.score}%</p>
                )}
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link to={`/examinee/exam/${exam.id}/results`}>
                    <Eye className="h-4 w-4" />
                    View results
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        )}
      </SectionPanel>

      {showExamInstructions && selectedExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="surface-panel w-full max-w-lg p-6">
            <h3 className="text-xl font-semibold">Before you begin</h3>
            <p className="mt-2 text-sm text-muted-foreground">{selectedExam.title}</p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-muted-foreground">
              <li>Enable your webcam and stay in frame</li>
              <li>Do not switch tabs during the session</li>
              <li>Behavior monitoring stays active throughout</li>
              <li>Duration: {selectedExam.duration}</li>
            </ul>
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Suspicious activity may be flagged for examiner review.
              </p>
            </div>
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
                  to={`/examinee/exam/${selectedExam.id}`}
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
