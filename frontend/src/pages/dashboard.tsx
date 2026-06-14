import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  Clock,
  Eye,
  FileText,
  Plus,
  Search,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import {
  apiClient,
  type AlertRow,
  type Exam,
  type ReportSummary,
  type SessionReportRow,
} from "../core/config/api";

interface CreateExamForm {
  title: string;
  description: string;
  duration_minutes: number;
  passing_score: number;
  instructions?: string;
  exam_code?: string;
  max_attempts: number;
}

const EMPTY_FORM: CreateExamForm = {
  title: "",
  description: "",
  duration_minutes: 120,
  passing_score: 50,
  instructions: "",
  exam_code: "",
  max_attempts: 1,
};

export function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<AlertRow[]>([]);
  const [activeSessions, setActiveSessions] = useState<SessionReportRow[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateExamForm>(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setError(null);
    try {
      const [s, list, alerts, sessions] = await Promise.all([
        apiClient.getReportSummary(),
        apiClient.getExams(),
        apiClient.listAlerts({ resolved: false }),
        apiClient.listSessionReports({ status: "in_progress" }),
      ]);
      setSummary(s);
      setExams(list);
      setRecentAlerts(alerts.slice(0, 8));
      setActiveSessions(sessions.results);
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Failed to load dashboard");
    }
  };

  useEffect(() => {
    reload();
    const id = window.setInterval(reload, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const filteredExams = useMemo(
    () =>
      exams.filter((e) => {
        const matchesQuery =
          e.title.toLowerCase().includes(query.toLowerCase()) ||
          (e.exam_code ?? "").toLowerCase().includes(query.toLowerCase());
        const matchesStatus = statusFilter === "all" || e.status === statusFilter;
        return matchesQuery && matchesStatus;
      }),
    [exams, query, statusFilter]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateBusy(true);
    try {
      const created = await apiClient.createExam({
        title: form.title,
        description: form.description,
        instructions: form.instructions,
        exam_code: form.exam_code || undefined,
        duration_minutes: form.duration_minutes,
        passing_score: form.passing_score,
        max_attempts: form.max_attempts,
      });
      setForm(EMPTY_FORM);
      setShowCreate(false);
      navigate(`/examiner/exams/${created.id}/edit`);
    } catch (err: any) {
      setCreateError(err?.detail?.() ?? err?.message ?? "Could not create exam");
    } finally {
      setCreateBusy(false);
    }
  };

  const publish = async (exam: Exam) => {
    try {
      await apiClient.publishExam(exam.id);
      reload();
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Publish failed");
    }
  };

  const archive = async (exam: Exam) => {
    try {
      await apiClient.archiveExam(exam.id);
      reload();
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Archive failed");
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Examiner Dashboard</h1>
          <p className="text-muted-foreground">
            Manage examinations, monitor live sessions, and review behavioural analytics.
          </p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/5 text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Active sessions"
            value={summary ? String(summary.active_sessions) : "—"}
            hint={summary ? `${summary.total_sessions} total` : "Loading…"}
            icon={Activity}
            color="from-emerald-500 to-emerald-600"
          />
          <StatCard
            label="Behavior events"
            value={summary ? String(summary.behavior_events) : "—"}
            hint="From CV pipeline"
            icon={BarChart3}
            color="from-teal-500 to-teal-600"
          />
          <StatCard
            label="Unresolved alerts"
            value={summary ? String(summary.unresolved_alerts) : "—"}
            hint="Requires review"
            icon={AlertTriangle}
            color="from-amber-500 to-amber-600"
          />
          <StatCard
            label="Average score"
            value={
              summary?.average_score != null
                ? `${summary.average_score.toFixed(1)}%`
                : "—"
            }
            hint={
              summary?.pass_rate != null
                ? `pass rate ${summary.pass_rate.toFixed(0)}%`
                : "Across completed sessions"
            }
            icon={TrendingUp}
            color="from-green-600 to-green-700"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card rounded-xl border border-border">
              <div className="p-6 border-b border-border">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-xl font-semibold">Examinations</h2>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="w-4 h-4" />
                    Create exam
                  </button>
                </div>

                <div className="mt-4 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by title or exam code…"
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["all", "draft", "active", "archived"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={`text-xs px-3 py-1 rounded-full border capitalize ${
                        statusFilter === s
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-border">
                {filteredExams.length === 0 && (
                  <div className="p-10 text-center text-muted-foreground text-sm">
                    No exams found. Click "Create exam" to add your first one.
                  </div>
                )}
                {filteredExams.map((exam) => (
                  <div key={exam.id} className="p-6 hover:bg-accent/40 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{exam.title}</h3>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {exam.exam_code && (
                            <span className="font-mono text-primary">{exam.exam_code}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <FileText className="w-4 h-4" /> {exam.total_questions} questions
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" /> {exam.duration_minutes}m
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" /> {new Date(exam.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <StatusPill status={exam.status} />
                      {exam.status === "draft" && (
                        <button
                          onClick={() => publish(exam)}
                          className="text-xs px-3 py-1 rounded-md border border-border hover:bg-accent"
                        >
                          Publish
                        </button>
                      )}
                      {exam.status !== "archived" && (
                        <button
                          onClick={() => archive(exam)}
                          className="text-xs px-3 py-1 rounded-md border border-border hover:bg-accent"
                        >
                          Archive
                        </button>
                      )}
                      <Link
                        to={`/examiner/exams/${exam.id}/edit`}
                        className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <Eye className="w-4 h-4" /> Manage
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-semibold">Live sessions</h2>
                <Link to="/monitoring" className="text-sm text-primary hover:underline">
                  Open full monitoring
                </Link>
              </div>
              <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {activeSessions.length === 0 && (
                  <div className="p-10 text-center text-sm text-muted-foreground">
                    No live sessions right now.
                  </div>
                )}
                {activeSessions.map((s) => (
                  <div key={s.id} className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.user_full_name || s.user}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.exam_title}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {s.behavior_event_count} events
                    </span>
                    <Link
                      to={`/monitoring/${s.id}`}
                      className="text-sm rounded-md px-3 py-1 border border-border hover:bg-accent"
                    >
                      Inspect
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-card rounded-xl border border-border sticky top-20">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-semibold">Recent alerts</h2>
              </div>

              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {recentAlerts.length === 0 && (
                  <div className="p-10 text-center text-sm text-muted-foreground">
                    No alerts to review.
                  </div>
                )}
                {recentAlerts.map((alert) => (
                  <div key={alert.id} className="p-4 hover:bg-accent/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          alert.severity === "high"
                            ? "bg-red-500"
                            : alert.severity === "medium"
                            ? "bg-amber-500"
                            : "bg-blue-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm mb-1 truncate">
                          {alert.session_user ?? "Examinee"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {alert.exam_title}
                        </p>
                        <p className="text-sm mb-1">{alert.alert_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(alert.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-border">
                <Link
                  to="/monitoring"
                  className="block w-full text-center text-sm text-primary hover:underline"
                >
                  View all alerts
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-semibold">Create new exam</h3>
              <button
                onClick={() => setShowCreate(false)}
                className="p-2 hover:bg-accent rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Title</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Legacy College Entrance Exam 2026"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Exam code (optional)</label>
                <input
                  value={form.exam_code}
                  onChange={(e) => setForm({ ...form, exam_code: e.target.value })}
                  placeholder="ENT-2026-A"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Instructions</label>
                <textarea
                  rows={3}
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Passing score (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={form.passing_score}
                    onChange={(e) => setForm({ ...form, passing_score: Number(e.target.value) })}
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1">Max attempts per examinee</label>
                <input
                  type="number"
                  min={1}
                  value={form.max_attempts}
                  onChange={(e) => setForm({ ...form, max_attempts: Number(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                />
              </div>

              {createError && (
                <p className="text-sm text-red-500">{createError}</p>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBusy}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {createBusy ? "Creating…" : "Create & add questions"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Activity;
  color: string;
}) {
  return (
    <div className="p-6 rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <TrendingUp className="w-4 h-4 text-emerald-500" />
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    draft: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    archived: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  };
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium ${
        styles[status] ?? styles.archived
      }`}
    >
      {status}
    </span>
  );
}
