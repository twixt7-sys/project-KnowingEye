import {
  Activity,
  AlertTriangle,
  BarChart3,
  Eye,
  Plus,
  TrendingUp,
  Users,
  X,
} from "@/shared/icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { formatApiError } from "@/core/config/api";
import { brand } from "@/core/config/brand";
import { useAuth } from "@/core/providers/auth-provider";
import { ExamCatalog } from "@/features/dashboard/components/exam-catalog";
import { dashboardQueries } from "@/features/dashboard/queries/queries";
import { createExam } from "@/features/exams/api/exam-api";
import {
  CheckboxSetting,
  DepartmentChecklist,
} from "@/features/exams/components/builder/builder-primitives";
import {
  type ExamForm,
  toDatetimeLocal,
  toIsoOrNull,
} from "@/features/exams/schemas/builder-schemas";
import { IconAction } from "@/shared/components/common/icon-action";
import { PageShell } from "@/shared/components/layout/page-shell";
import { SectionPanel } from "@/shared/components/layout/section-panel";
import { StatCard } from "@/shared/components/layout/stat-card";
import { EmptyState } from "@/shared/components/patterns/empty-state";
import { IrisGauge } from "@/shared/components/patterns/iris-gauge";
import { LoadingState } from "@/shared/components/patterns/loading-state";
import { Button } from "@/shared/components/ui/button";

/** Same settings as the exam builder's "Exam settings" tab, plus the locked-in home department. */
interface CreateExamForm
  extends Pick<
    ExamForm,
    | "title"
    | "description"
    | "instructions"
    | "duration_minutes"
    | "passing_score"
    | "max_attempts"
    | "monitoring_enabled"
    | "shuffle_questions"
    | "shuffle_options"
    | "disable_copy_paste"
    | "requires_assignment"
    | "is_practice"
    | "presentation_mode"
    | "available_from"
    | "available_until"
    | "results_release_at"
    | "department_ids"
  > {
  department_id: number | "";
  category_id: number | "";
}

const EMPTY_FORM: CreateExamForm = {
  title: "",
  description: "",
  duration_minutes: 120,
  passing_score: 50,
  instructions: "",
  department_id: "",
  department_ids: [],
  category_id: "",
  max_attempts: 1,
  monitoring_enabled: true,
  shuffle_questions: false,
  shuffle_options: false,
  disable_copy_paste: false,
  requires_assignment: false,
  is_practice: false,
  presentation_mode: "one_per_page",
  available_from: "",
  available_until: "",
  results_release_at: "",
};

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
  const { user } = useAuth();
  const dashboardQuery = useQuery(dashboardQueries.examiner());
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateExamForm>(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  const departmentsQuery = useQuery({
    ...dashboardQueries.departments(true),
    enabled: showCreate,
  });
  const categoriesQuery = useQuery(dashboardQueries.categories(true));

  const summary =dashboardQuery.data?.summary ?? null;
  const exams = dashboardQuery.data?.exams ?? [];
  const activeSessions = dashboardQuery.data?.activeSessions ?? [];
  const departments = departmentsQuery.data ?? [];
  const departmentsLoading = departmentsQuery.isLoading;
  const categories = categoriesQuery.data ?? [];

  // `isLoading` is true only for the first fetch with nothing cached, so the
  // lists show a spinner until the server has actually answered - and "no exams"
  // is only ever claimed after that.
  const loading = dashboardQuery.isLoading;
  const loadError =
    dashboardQuery.error != null
      ? formatApiError(dashboardQuery.error, "Could not load exams")
      : null;

  const selectedDepartment = departments.find((d) => d.id === form.department_id);
  const codePreview = selectedDepartment
    ? `${selectedDepartment.abbreviation}-${new Date().getFullYear()}-A`
    : null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.department_id) {
      setCreateError("Select a department.");
      return;
    }
    if (form.available_from && new Date(form.available_from) < new Date()) {
      setCreateError("The opening date can't be in the past.");
      return;
    }
    if (
      form.available_from &&
      form.available_until &&
      new Date(form.available_until) <= new Date(form.available_from)
    ) {
      setCreateError("The closing date must be after the opening date.");
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
        // The home department is always part of the visible-to set.
        department_ids: Array.from(new Set([form.department_id, ...form.department_ids])),
        category_id: form.category_id || null,
        duration_minutes: form.duration_minutes,
        passing_score: form.passing_score,
        max_attempts: form.max_attempts,
        monitoring_enabled: form.monitoring_enabled,
        shuffle_questions: form.shuffle_questions,
        shuffle_options: form.shuffle_options,
        disable_copy_paste: form.disable_copy_paste,
        requires_assignment: form.requires_assignment,
        is_practice: form.is_practice,
        presentation_mode: form.presentation_mode,
        available_from: toIsoOrNull(form.available_from),
        available_until: toIsoOrNull(form.available_until),
        results_release_at: toIsoOrNull(form.results_release_at),
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
        <ExamCatalog
          view="active"
          exams={exams}
          loading={loading}
          error={loadError}
          onRetry={() => void dashboardQuery.refetch()}
          onCreate={() => setShowCreate(true)}
        />

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
            {loading ? (
              <LoadingState label="Loading sessions…" />
            ) : loadError && activeSessions.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="Couldn't load sessions"
                description="Live sessions will appear here once the dashboard reloads."
              />
            ) : activeSessions.length === 0 ? (
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
                <span className="mb-1 block text-sm">
                  Also visible to (shared/general-ed departments)
                </span>
                <DepartmentChecklist
                  departments={departments}
                  value={form.department_ids}
                  onChange={(department_ids) => setForm({ ...form, department_ids })}
                  lockedId={form.department_id || null}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The home department above is always included. Add more for shared or
                  general-education exams discoverable from other departments too.
                </p>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm">Opens at (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.available_from}
                    onChange={(e) => setForm({ ...form, available_from: e.target.value })}
                    min={toDatetimeLocal(new Date().toISOString())}
                    className="form-field"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Closes at (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.available_until}
                    onChange={(e) => setForm({ ...form, available_until: e.target.value })}
                    min={form.available_from || undefined}
                    className="form-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm">Presentation mode</label>
                  <select
                    value={form.presentation_mode}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        presentation_mode: e.target.value as CreateExamForm["presentation_mode"],
                      })
                    }
                    className="form-field"
                  >
                    <option value="one_per_page">One question per page</option>
                    <option value="section_per_page">One section per page</option>
                    <option value="scroll_all">All questions (scroll)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm">Results release at (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.results_release_at}
                    onChange={(e) => setForm({ ...form, results_release_at: e.target.value })}
                    className="form-field"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <CheckboxSetting
                  checked={form.monitoring_enabled}
                  onCheckedChange={(monitoring_enabled) => setForm({ ...form, monitoring_enabled })}
                  title="Camera monitoring"
                  description="When enabled, examinees complete proctoring setup and their webcam stays active during the exam. Disable for practice quizzes or environments where monitoring is not required."
                />
                <CheckboxSetting
                  checked={form.shuffle_questions}
                  onCheckedChange={(shuffle_questions) => setForm({ ...form, shuffle_questions })}
                  title="Shuffle questions"
                  description="Present questions in a random order for each examinee. The order stays fixed for the duration of their attempt."
                />
                <CheckboxSetting
                  checked={form.shuffle_options}
                  onCheckedChange={(shuffle_options) => setForm({ ...form, shuffle_options })}
                  title="Shuffle answer options"
                  description="Randomize multiple-choice option order per attempt."
                />
                <CheckboxSetting
                  checked={form.disable_copy_paste}
                  onCheckedChange={(disable_copy_paste) => setForm({ ...form, disable_copy_paste })}
                  title="Disable copy and paste"
                  description="Block copy, cut, and paste while examinees take the exam, including inside answer fields, so answers must be typed."
                />
                <CheckboxSetting
                  checked={form.requires_assignment}
                  onCheckedChange={(requires_assignment) =>
                    setForm({ ...form, requires_assignment })
                  }
                  title="Assigned candidates only"
                  description="Only rostered examinees can see and start this exam."
                />
                <CheckboxSetting
                  checked={form.is_practice}
                  onCheckedChange={(is_practice) => setForm({ ...form, is_practice })}
                  title="Practice exam"
                  description="Unlimited attempts; use for dry runs before the real admission exam."
                />
              </div>

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
