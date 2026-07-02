import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Eye,
  Plus,
  Search,
  TrendingUp,
  X,
} from "lucide-react";

import {
  apiClient,
  formatApiError,
  type Department,
  type Exam,
} from "../core/config/api";
import { useDashboard } from "../features/dashboard/hooks/use-dashboard";
import { useConfirm } from "../shared/components/common/confirm-dialog";
import { PageHeader } from "../shared/components/layout/page-header";
import { PageShell } from "../shared/components/layout/page-shell";
import { SectionPanel } from "../shared/components/layout/section-panel";
import { StatCard } from "../shared/components/layout/stat-card";
import { ScrollableDataTable } from "../shared/components/common/scrollable-data-table";
import { Button } from "../shared/components/ui/button";
import { Checkbox } from "../shared/components/ui/checkbox";

interface CreateExamForm {
  title: string;
  description: string;
  duration_minutes: number;
  passing_score: number;
  instructions?: string;
  department_id: number | "";
  max_attempts: number;
  monitoring_enabled: boolean;
}

const EMPTY_FORM: CreateExamForm = {
  title: "",
  description: "",
  duration_minutes: 120,
  passing_score: 50,
  instructions: "",
  department_id: "",
  max_attempts: 1,
  monitoring_enabled: true,
};

export function Dashboard() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { summary, exams, activeSessions, error: loadError, reload } = useDashboard();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateExamForm>(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? loadError;

  useEffect(() => {
    if (!showCreate) return;
    let cancelled = false;
    setDepartmentsLoading(true);
    apiClient
      .listDepartments({ active_only: true })
      .then((data) => {
        if (!cancelled) setDepartments(data);
      })
      .catch(() => {
        if (!cancelled) setDepartments([]);
      })
      .finally(() => {
        if (!cancelled) setDepartmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showCreate]);

  const selectedDepartment = departments.find((d) => d.id === form.department_id);
  const codePreview = selectedDepartment
    ? `${selectedDepartment.abbreviation}-${new Date().getFullYear()}-A`
    : null;

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
    if (!form.department_id) {
      setCreateError("Select a department.");
      return;
    }
    setCreateError(null);
    setCreateBusy(true);
    try {
      const created = await apiClient.createExam({
        title: form.title,
        description: form.description,
        instructions: form.instructions,
        department_id: form.department_id,
        duration_minutes: form.duration_minutes,
        passing_score: form.passing_score,
        max_attempts: form.max_attempts,
        monitoring_enabled: form.monitoring_enabled,
      });
      setForm(EMPTY_FORM);
      setShowCreate(false);
      navigate(`/examiner/exams/${created.id}/edit`);
    } catch (err) {
      setCreateError(formatApiError(err));
    } finally {
      setCreateBusy(false);
    }
  };

  const publish = async (exam: Exam) => {
    const confirmed = await confirm({
      title: "Publish exam?",
      description: `"${exam.title}" will become available to examinees during its scheduled window.`,
      confirmLabel: "Publish",
    });
    if (!confirmed) return;
    setActionError(null);
    try {
      await apiClient.publishExam(exam.id);
      await reload();
    } catch (e) {
      setActionError(formatApiError(e));
    }
  };

  const archive = async (exam: Exam) => {
    const confirmed = await confirm({
      title: "Archive exam?",
      description: `"${exam.title}" will no longer accept new attempts.`,
      confirmLabel: "Archive",
      destructive: true,
    });
    if (!confirmed) return;
    setActionError(null);
    try {
      await apiClient.archiveExam(exam.id);
      await reload();
    } catch (e) {
      setActionError(formatApiError(e));
    }
  };

  return (
    <PageShell fill>
      <PageHeader
        eyebrow="Examiner"
        title="Overview"
        description="Manage examinations and monitor live activity at a glance."
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Create exam
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="page-metrics mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active sessions"
          value={summary ? String(summary.active_sessions) : "-"}
          hint={summary ? `${summary.total_sessions} total` : undefined}
          icon={Activity}
        />
        <StatCard
          label="Behavior events"
          value={summary ? String(summary.behavior_events) : "-"}
          hint="CV pipeline"
          icon={BarChart3}
        />
        <StatCard
          label="Unresolved alerts"
          value={summary ? String(summary.unresolved_alerts) : "-"}
          hint="Needs review"
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard
          label="Average score"
          value={
            summary?.average_score != null
              ? `${summary.average_score.toFixed(1)}%`
              : "-"
          }
          hint={
            summary?.pass_rate != null
              ? `Pass rate ${summary.pass_rate.toFixed(0)}%`
              : undefined
          }
          icon={TrendingUp}
          tone="success"
        />
      </div>

      <div className="page-body page-body-grid page-body-grid--2-1 min-h-0">
        <SectionPanel
          fill
          title="Examinations"
          description="Draft, publish, and manage your exam catalog."
          toolbar={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title or code…"
                  className="form-field w-full py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["all", "draft", "active", "archived"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`filter-chip ${statusFilter === s ? "filter-chip--active" : ""}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          <ScrollableDataTable fill>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th className="hidden sm:table-cell">Code</th>
                  <th>Status</th>
                  <th className="hidden md:table-cell">Details</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExams.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                      No exams match your filters.
                    </td>
                  </tr>
                )}
                {filteredExams.map((exam) => (
                  <tr key={exam.id}>
                    <td className="max-w-[14rem] font-medium sm:max-w-md">
                      <span className="line-clamp-2">{exam.title}</span>
                    </td>
                    <td className="hidden font-mono text-sm text-primary sm:table-cell">
                      {exam.exam_code ?? "-"}
                    </td>
                    <td>
                      <StatusPill status={exam.status} />
                    </td>
                    <td className="hidden text-sm text-muted-foreground md:table-cell">
                      {exam.total_questions} questions · {exam.duration_minutes} min
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        {exam.status === "draft" && (
                          <Button variant="outline" size="sm" onClick={() => publish(exam)}>
                            Publish
                          </Button>
                        )}
                        {exam.status !== "archived" && (
                          <Button variant="outline" size="sm" onClick={() => archive(exam)}>
                            Archive
                          </Button>
                        )}
                        <Button asChild size="sm">
                          <Link to={`/examiner/exams/${exam.id}/edit`}>
                            <Eye className="h-4 w-4" />
                            Manage
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableDataTable>
        </SectionPanel>

        <SectionPanel
          fill
          title="Live sessions"
          description="Examinees currently in progress."
          actionHref="/monitoring"
          actionLabel="Open monitoring"
        >
          <ScrollableDataTable fill>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Examinee</th>
                  <th className="hidden lg:table-cell">Exam</th>
                  <th className="text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {activeSessions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-sm text-muted-foreground">
                      No live sessions right now.
                    </td>
                  </tr>
                )}
                {activeSessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <p className="font-medium">{s.user_full_name || s.user}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground lg:hidden">
                        {s.exam_title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {s.behavior_event_count} behavior events
                      </p>
                    </td>
                    <td className="hidden max-w-[10rem] text-sm text-muted-foreground lg:table-cell">
                      <span className="line-clamp-2">{s.exam_title}</span>
                    </td>
                    <td className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/monitoring/${s.id}`}>Inspect</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableDataTable>
        </SectionPanel>
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="surface-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-semibold">Create new exam</h3>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-2 hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm">Title</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Legacy College Entrance Exam 2026"
                  className="form-field"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm">Department</label>
                <select
                  required
                  value={form.department_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      department_id: e.target.value ? Number(e.target.value) : "",
                    })
                  }
                  className="form-field"
                  disabled={departmentsLoading}
                >
                  <option value="">
                    {departmentsLoading ? "Loading departments…" : "Select a department"}
                  </option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.abbreviation})
                    </option>
                  ))}
                </select>
                {departments.length === 0 && !departmentsLoading && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No active departments.{" "}
                    <Link to="/settings" className="text-primary underline">
                      Add one in Settings
                    </Link>
                    .
                  </p>
                )}
                {codePreview && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Exam code will be generated automatically (e.g. {codePreview}).
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="form-field"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm">Instructions</label>
                <textarea
                  rows={3}
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  className="form-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm">Duration (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                    className="form-field"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Passing score (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={form.passing_score}
                    onChange={(e) => setForm({ ...form, passing_score: Number(e.target.value) })}
                    className="form-field"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm">Max attempts per examinee</label>
                <input
                  type="number"
                  min={1}
                  value={form.max_attempts}
                  onChange={(e) => setForm({ ...form, max_attempts: Number(e.target.value) })}
                  className="form-field"
                />
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-4 cursor-pointer">
                <Checkbox
                  checked={form.monitoring_enabled}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, monitoring_enabled: checked === true })
                  }
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">Camera monitoring</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Require webcam proctoring during the exam. Turn off for unmonitored practice or
                    low-stakes assessments.
                  </span>
                </span>
              </label>

              {createError && <p className="text-sm text-red-500">{createError}</p>}

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createBusy} className="flex-1">
                  {createBusy ? "Creating…" : "Create & add questions"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    draft: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    archived: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`status-pill ${styles[status] ?? styles.archived}`}>{status}</span>
  );
}
