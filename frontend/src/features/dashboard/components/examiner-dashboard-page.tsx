import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  ClipboardCheck,
  Copy,
  Eye,
  FileText,
  Inbox,
  Plus,
  Send,
  TrendingUp,
  Users,
  X,
} from "@/shared/icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { type Exam, apiClient, formatApiError } from "@/core/config/api";
import { brand } from "@/core/config/brand";
import { useAuth } from "@/core/providers/auth-provider";
import { dashboardQueries } from "@/features/dashboard/queries/queries";
import { archiveExam, createExam, publishExam } from "@/features/exams/api/exam-api";
import { useConfirm } from "@/shared/components/common/confirm-dialog";
import { IconAction } from "@/shared/components/common/icon-action";
import { PageShell } from "@/shared/components/layout/page-shell";
import { SectionPanel } from "@/shared/components/layout/section-panel";
import { StatCard } from "@/shared/components/layout/stat-card";
import { EmptyState } from "@/shared/components/patterns/empty-state";
import { FilterBar } from "@/shared/components/patterns/filter-bar";
import { IrisGauge } from "@/shared/components/patterns/iris-gauge";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";

interface CreateExamForm {
  title: string;
  description: string;
  duration_minutes: number;
  passing_score: number;
  instructions?: string;
  department_id: number | "";
  category_id: number | "";
  max_attempts: number;
  monitoring_enabled: boolean;
  shuffle_questions: boolean;
}

const EMPTY_FORM: CreateExamForm = {
  title: "",
  description: "",
  duration_minutes: 120,
  passing_score: 50,
  instructions: "",
  department_id: "",
  category_id: "",
  max_attempts: 1,
  monitoring_enabled: true,
  shuffle_questions: false,
};

const SORT_OPTIONS = [
  { value: "-created_at", label: "Newest first" },
  { value: "created_at", label: "Oldest first" },
  { value: "title", label: "Title (A-Z)" },
  { value: "-available_until", label: "Closing soonest" },
] as const;

function sortValueOf(exam: Exam, key: string): string {
  if (key === "title") return exam.title;
  if (key === "available_until") return exam.available_until ?? "";
  return exam.created_at;
}

function sortExams(exams: Exam[], sort: string): Exam[] {
  const desc = sort.startsWith("-");
  const key = desc ? sort.slice(1) : sort;
  const sorted = [...exams].sort((a, b) => {
    const av = sortValueOf(a, key);
    const bv = sortValueOf(b, key);
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
  return desc ? sorted.reverse() : sorted;
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

export function ExaminerDashboardPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user } = useAuth();
  const dashboardQuery = useQuery(dashboardQueries.examiner());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState<string>("-created_at");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateExamForm>(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const departmentsQuery = useQuery({
    ...dashboardQueries.departments(true),
    enabled: showCreate,
  });
  const categoriesQuery = useQuery(dashboardQueries.categories(true));

  const summary = dashboardQuery.data?.summary ?? null;
  const exams = dashboardQuery.data?.exams ?? [];
  const activeSessions = dashboardQuery.data?.activeSessions ?? [];
  const departments = departmentsQuery.data ?? [];
  const departmentsLoading = departmentsQuery.isLoading;
  const categories = categoriesQuery.data ?? [];

  const loadError = dashboardQuery.error != null ? formatApiError(dashboardQuery.error) : null;
  const error = actionError ?? loadError;

  const reload = () => void dashboardQuery.refetch();

  const selectedDepartment = departments.find((d) => d.id === form.department_id);
  const codePreview = selectedDepartment
    ? `${selectedDepartment.abbreviation}-${new Date().getFullYear()}-A`
    : null;

  const filteredExams = useMemo(() => {
    const filtered = exams.filter((e) => {
      const matchesQuery =
        e.title.toLowerCase().includes(query.toLowerCase()) ||
        (e.exam_code ?? "").toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === "all" || e.status === statusFilter;
      const matchesCategory =
        categoryFilter === "all" || String(e.category?.id ?? "") === categoryFilter;
      return matchesQuery && matchesStatus && matchesCategory;
    });
    return sortExams(filtered, sort);
  }, [exams, query, statusFilter, categoryFilter, sort]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.department_id) {
      setCreateError("Select a department.");
      return;
    }
    setCreateError(null);
    setCreateBusy(true);
    try {
      const created = await createExam({
        title: form.title,
        description: form.description,
        instructions: form.instructions,
        department_id: form.department_id,
        category_id: form.category_id || null,
        duration_minutes: form.duration_minutes,
        passing_score: form.passing_score,
        max_attempts: form.max_attempts,
        monitoring_enabled: form.monitoring_enabled,
        shuffle_questions: form.shuffle_questions,
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
      await publishExam(exam.id);
      reload();
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
      await archiveExam(exam.id);
      reload();
    } catch (e) {
      setActionError(formatApiError(e));
    }
  };

  const duplicate = async (exam: Exam) => {
    const res = await apiClient.duplicateExam(exam.id);
    navigate(`/examiner/exams/${res.exam.id}/edit`);
  };

  return (
    <PageShell fill>
      {/* Greeting band — warm welcome + quick actions */}
      <section className="greeting-band mb-5 shrink-0 px-5 py-5 sm:px-6">
        <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="kicker">{brand.departmentName}</p>
            <h1 className="mt-2 font-serif text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
              {timeOfDayGreeting()}, {user?.username ?? "Examiner"}
            </h1>
            <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
              {summary && summary.active_sessions > 0 ? (
                <>
                  <span className="live-dot" aria-hidden />
                  {summary.active_sessions} examinee
                  {summary.active_sessions === 1 ? " is" : "s are"} taking an exam right now.
                </>
              ) : (
                "All quiet — no exams in progress."
              )}
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
              {todayStamp}
            </p>
            <div className="flex items-center gap-1.5">
              <div className="mr-1 flex items-center gap-0.5 rounded-lg border border-border bg-card/70 p-0.5">
                <IconAction to="/monitoring" label="Live monitoring" icon={Eye} tone="primary" />
                <IconAction
                  to="/reports"
                  label="Reports & analytics"
                  icon={BarChart3}
                  tone="primary"
                />
                <IconAction to="/users" label="Manage users" icon={Users} tone="primary" />
              </div>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                Create exam
              </Button>
            </div>
          </div>
        </div>
      </section>

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
          value={summary?.average_score != null ? `${summary.average_score.toFixed(1)}%` : "-"}
          hint={
            summary?.pass_rate != null ? `Pass rate ${summary.pass_rate.toFixed(0)}%` : undefined
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
            <div className="flex flex-col gap-2">
              <FilterBar
                search={query}
                onSearchChange={setQuery}
                searchPlaceholder="Search by title or code…"
                chips={(["all", "draft", "active", "archived"] as const).map((s) => ({
                  value: s,
                  label: s,
                }))}
                activeChip={statusFilter}
                onChipChange={setStatusFilter}
                sortOptions={SORT_OPTIONS as unknown as { value: string; label: string }[]}
                sortValue={sort}
                onSortChange={setSort}
              />
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("all")}
                    className={`filter-chip ${categoryFilter === "all" ? "filter-chip--active" : ""}`}
                  >
                    all categories
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoryFilter(String(c.id))}
                      className={`filter-chip ${categoryFilter === String(c.id) ? "filter-chip--active" : ""}`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          }
        >
          {filteredExams.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No exams match your filters"
              description="Adjust the search or status filters, or create a new exam to get started."
              action={
                <Button variant="outline" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" />
                  Create exam
                </Button>
              }
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid content-start gap-3 sm:grid-cols-2">
                {filteredExams.map((exam) => (
                  <article key={exam.id} className="surface-panel-interactive flex flex-col p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-mono text-[0.6875rem] tracking-[0.06em] text-primary">
                        {exam.exam_code ?? "UNCODED"}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {exam.status === "draft" && <ApprovalPill status={exam.approval_status} />}
                        <ScheduleStatePill state={exam.schedule_state} />
                        <StatusPill status={exam.status} />
                      </div>
                    </div>

                    <h3 className="mt-2 line-clamp-2 font-serif text-[1.0625rem] font-semibold leading-snug tracking-tight">
                      {exam.title}
                    </h3>

                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {exam.category?.name ?? "Uncategorized"}
                    </p>

                    <p className="mt-1.5 font-mono text-xs tabular-nums text-muted-foreground">
                      {exam.total_questions} questions · {exam.duration_minutes} min
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                      <div className="flex items-center gap-0.5">
                        {exam.status === "draft" && (
                          <IconAction
                            label="Publish"
                            icon={Send}
                            tone="primary"
                            onClick={() => publish(exam)}
                          />
                        )}
                        {exam.status !== "archived" && (
                          <IconAction
                            label="Archive"
                            icon={Archive}
                            tone="danger"
                            onClick={() => archive(exam)}
                          />
                        )}
                        <IconAction label="Duplicate" icon={Copy} onClick={() => duplicate(exam)} />
                        <IconAction label="Summary" icon={FileText} to={`/exams/${exam.id}`} />
                        <IconAction
                          label="Grade submissions"
                          icon={ClipboardCheck}
                          to={`/examiner/exams/${exam.id}/grading`}
                        />
                      </div>
                      <Button asChild size="sm">
                        <Link to={`/examiner/exams/${exam.id}/edit`}>
                          <Eye className="h-4 w-4" />
                          Manage
                        </Link>
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </SectionPanel>

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <SectionPanel title="Performance" description="Across all completed sessions.">
            <div className="flex items-center justify-center gap-6 px-4 py-5">
              <IrisGauge value={summary?.average_score ?? 0} label="Avg. score" tone="default" />
              <IrisGauge
                value={summary?.pass_rate ?? 0}
                label="Pass rate"
                tone={summary?.pass_rate != null && summary.pass_rate >= 60 ? "success" : "warning"}
              />
            </div>
          </SectionPanel>

          <SectionPanel
            fill
            title="Live sessions"
            description="Examinees currently in progress."
            actionHref="/monitoring"
            actionLabel="Open monitoring"
          >
            {activeSessions.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No live sessions"
                description="When an examinee starts a monitored exam, their session appears here."
              />
            ) : (
              <div className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
                {activeSessions.map((s) => {
                  const name = s.user_full_name || s.user;
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary/15 font-serif text-sm font-semibold text-secondary">
                        {(name?.[0] ?? "?").toUpperCase()}
                        <span className="live-dot absolute -right-1 -top-1 !h-2 !w-2" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.exam_title}</p>
                      </div>
                      <span
                        className="shrink-0 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[0.65rem] tabular-nums text-muted-foreground"
                        title="Behavior events"
                      >
                        {s.behavior_event_count} ev
                      </span>
                      <IconAction
                        label="Inspect session"
                        icon={Eye}
                        tone="primary"
                        to={`/monitoring/${s.id}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </SectionPanel>
        </div>
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
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="kicker">New examination</p>
                <h3 className="mt-1.5 font-serif text-2xl font-semibold tracking-tight">
                  Create new exam
                </h3>
              </div>
              <IconAction label="Close" icon={X} onClick={() => setShowCreate(false)} />
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
                <label className="mb-1 block text-sm">Category (optional)</label>
                <select
                  value={form.category_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category_id: e.target.value ? Number(e.target.value) : "",
                    })
                  }
                  className="form-field"
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
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

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-4">
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

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-4">
                <Checkbox
                  checked={form.shuffle_questions}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, shuffle_questions: checked === true })
                  }
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">Shuffle questions</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Randomize question order for each examinee to reduce answer sharing.
                  </span>
                </span>
              </label>

              {createError && <p className="text-sm text-destructive">{createError}</p>}

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
    active: "bg-status-safe/12 text-status-safe",
    draft: "bg-chart-5/12 text-chart-5",
    archived: "bg-muted text-muted-foreground",
  };
  return <span className={`status-pill ${styles[status] ?? styles.archived}`}>{status}</span>;
}

/** Derived Upcoming/Active/Closed/Expired window state (Directive A3 - "show clear states"). */
function ScheduleStatePill({ state }: { state?: Exam["schedule_state"] }) {
  if (!state) return null;
  const styles: Record<string, string> = {
    upcoming: "bg-chart-4/12 text-chart-4",
    active: "bg-status-safe/12 text-status-safe",
    closed: "bg-muted text-muted-foreground",
    expired: "bg-status-alert/12 text-status-alert",
  };
  return <span className={`status-pill ${styles[state] ?? ""}`}>{state}</span>;
}

/** Surfaces where a draft sits in the submit -> review -> approve chain (Directive A1). */
function ApprovalPill({ status }: { status?: Exam["approval_status"] }) {
  if (!status || status === "not_submitted") return null;
  const styles: Record<string, string> = {
    pending: "bg-status-watch/12 text-status-watch",
    approved: "bg-status-safe/12 text-status-safe",
    rejected: "bg-status-alert/12 text-status-alert",
  };
  const labels: Record<string, string> = {
    pending: "pending review",
    approved: "approved",
    rejected: "rejected",
  };
  return <span className={`status-pill ${styles[status] ?? ""}`}>{labels[status] ?? status}</span>;
}
