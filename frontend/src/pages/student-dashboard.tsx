import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Calendar,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  Eye,
  Loader2,
} from "lucide-react";
import { apiClient, type Exam } from "../core/config/api";

type DashboardExam = {
  id: string;
  title: string;
  course: string;
  date: string;
  time: string;
  duration: string;
  status: string;
  type: "upcoming" | "completed";
  score?: number;
  behaviorScore?: number;
};

function mapExamToCard(exam: Exam, type: "upcoming" | "completed"): DashboardExam {
  return {
    id: String(exam.id),
    title: exam.title,
    course: `Exam #${exam.id}`,
    date: new Date(exam.created_at).toLocaleDateString(),
    time: "—",
    duration: `${exam.duration_minutes} mins`,
    status: type === "upcoming" ? "Ready to Start" : "Completed",
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
        const active = exams
          .filter((e) => e.status === "active")
          .map((e) => mapExamToCard(e, "upcoming"));
        const archived = exams
          .filter((e) => e.status === "archived")
          .map((e) => mapExamToCard(e, "completed"));
        setUpcomingExams(active);
        setCompletedExams(archived);
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
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Student Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            View available exams and your completed attempts
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground mb-6">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading exams from server…
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
            {error} — ensure the Django API is running at{" "}
            <code className="text-sm">VITE_API_BASE_URL</code>.
          </div>
        )}

        {/* Upcoming Exams */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Available Exams
          </h2>
          {upcomingExams.length === 0 && !loading ? (
            <p className="text-muted-foreground">No active exams right now.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingExams.map((exam) => (
                <div
                  key={exam.id}
                  className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                        {exam.course}
                      </span>
                      <h3 className="text-lg font-semibold mt-2">{exam.title}</h3>
                    </div>
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {exam.date}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {exam.duration}
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartExam(exam)}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Start Exam
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Completed Exams */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Completed Exams
          </h2>
          {completedExams.length === 0 && !loading ? (
            <p className="text-muted-foreground">No completed exams yet.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {completedExams.map((exam) => (
                <div
                  key={exam.id}
                  className="bg-card border border-border rounded-xl p-6"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {exam.course}
                      </span>
                      <h3 className="text-lg font-semibold mt-1">{exam.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{exam.date}</p>
                    </div>
                    {exam.score != null && (
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">{exam.score}%</div>
                        <div className="text-xs text-muted-foreground">Score</div>
                      </div>
                    )}
                  </div>
                  <Link
                    to={`/student/exam/${exam.id}/results`}
                    className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Eye className="h-4 w-4" />
                    View Results
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Exam Instructions Modal */}
        {showExamInstructions && selectedExam && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6">
              <h3 className="text-xl font-bold mb-4">Exam Instructions</h3>
              <div className="space-y-4 text-sm text-muted-foreground mb-6">
                <p>
                  <strong className="text-foreground">{selectedExam.title}</strong>
                </p>
                <ul className="list-disc list-inside space-y-2">
                  <li>Ensure your webcam is enabled and working</li>
                  <li>Do not switch tabs or minimize the browser</li>
                  <li>Keep your face visible to the camera at all times</li>
                  <li>Behavior monitoring is active during the exam</li>
                  <li>Duration: {selectedExam.duration}</li>
                </ul>
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                  <p className="text-yellow-600 dark:text-yellow-400">
                    Suspicious behavior may be flagged and reviewed by administrators.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExamInstructions(false)}
                  className="flex-1 py-2 px-4 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <Link
                  to={`/student/exam/${selectedExam.id}`}
                  className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-center"
                  onClick={() => setShowExamInstructions(false)}
                >
                  Begin Exam
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
