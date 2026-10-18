import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ClipboardCheck,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Inbox,
  PlayCircle,
  Plus,
  SearchX,
  Send,
  Trash2,
} from "@/shared/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { type Exam, apiClient, formatApiError } from "@/core/config/api";
import { dashboardKeys } from "@/features/dashboard/queries/keys";
import { dashboardQueries } from "@/features/dashboard/queries/queries";
import {
  archiveExam,
  deleteExam,
  publishExam,
  unarchiveExam,
  unpublishExam,
} from "@/features/exams/api/exam-api";
import { useCanPreviewExam } from "@/features/exams/hooks/use-can-preview-exam";
import { examPreviewPath } from "@/features/exams/lib/exam-paths";
import { useConfirm } from "@/shared/components/common/confirm-dialog";
import { IconAction } from "@/shared/components/common/icon-action";
import { SectionPanel } from "@/shared/components/layout/section-panel";
import { EmptyState } from "@/shared/components/patterns/empty-state";
import { FilterBar } from "@/shared/components/patterns/filter-bar";
import { LoadingState } from "@/shared/components/patterns/loading-state";
import { Button } from "@/shared/components/ui/button";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { withProcessing } from "@/shared/lib/processing";

/** Which slice of the catalog a page shows: everything still in use, or the archive. */
export type ExamCatalogView = "active" | "archived";

const VIEW_COPY: Record<ExamCatalogView, { title: string; description: string }> = {
  active: {
    title: "Examinations",
    description: "Draft, publish, and manage your exam catalog.",
  },
  archived: {
    title: "Archived exams",
    description: "Closed exams kept for the record. Unarchive one to bring it back.",
  },
};

const ACTIVE_STATUS_CHIPS = ["all", "draft", "active"] as const;

const SORT_OPTIONS = [
  { value: "-created_at", label: "Newest first" },
  { value: "created_at", label: "Oldest first" },
  { value: "title", label: "Title (A-Z)" },
  { value: "-available_until", label: "Closing soonest" },
];

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

/** Whether an exam belongs on the page for `view`. Archived exams live only on the archive page. */
export function belongsToView(exam: Exam, view: ExamCatalogView): boolean {
  return view === "archived" ? exam.status === "archived" : exam.status !== "archived";
}

type ExamCatalogProps = {
  view: ExamCatalogView;
  /** Every exam the examiner can see; the catalog picks out the ones for `view`. */
  exams: Exam[];
  /** True only while the very first fetch is in flight, so "no exams" is never shown early. */
  loading: boolean;
  /** Set when the exam list could not be loaded. */
  error: string | null;
  onRetry: () => void;
  /** Opens the create-exam dialog; the empty state offers it when given. */
  onCreate?: () => void;
};

/**
 * Searchable, sortable card list of exams with their lifecycle actions
 * (publish, unpublish, archive, unarchive, delete, duplicate, preview).
 *
 * Shared by the active-exams dashboard and the archive page so both behave the
 * same and only differ in which exams they list.
 */
export function ExamCatalog({
  view,
  exams,
  loading,
  error,
  onRetry,
  onCreate,
}: ExamCatalogProps) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const canPreviewExam = useCanPreviewExam();
  const categoriesQuery = useQuery(dashboardQueries.categories(true));
  const categories = categoriesQuery.data ?? [];

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState<string>("-created_at");
  const [actionError, setActionError] = useState<string | null>(null);

  const copy = VIEW_COPY[view];
  const inView = useMemo(() => exams.filter((e) => belongsToView(e, view)), [exams, view]);
  const archivedCount = useMemo(
    () => exams.filter((e) => belongsToView(e, "archived")).length,
    [exams],
  );

  const filteredExams = useMemo(() => {
    const needle = debouncedQuery.toLowerCase();
    const filtered = inView.filter((e) => {
      const matchesQuery =
        e.title.toLowerCase().includes(needle) ||
        (e.exam_code ?? "").toLowerCase().includes(needle);
      const matchesStatus = statusFilter === "all" || e.status === statusFilter;
      const matchesCategory =
        categoryFilter === "all" || String(e.category?.id ?? "") === categoryFilter;
      return matchesQuery && matchesStatus && matchesCategory;
    });
    return sortExams(filtered, sort);
  }, [inView, debouncedQuery, statusFilter, categoryFilter, sort]);

  const filtersActive =
    debouncedQuery.trim() !== "" || statusFilter !== "all" || categoryFilter !== "all";

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setCategoryFilter("all");
  };

  /**
   * Run one lifecycle action behind the busy overlay, then refetch the exam
   * lists so the card moves (or disappears) before the user can click again.
   */
  const run = async (label: string, work: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await withProcessing(label, async () => {
        await work();
        await queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      });
    } catch (e) {
      setActionError(formatApiError(e));
    }
  };

  const publish = async (exam: Exam) => {
    const confirmed = await confirm({
      title: "Publish exam?",
      description: `"${exam.title}" will become available to examinees during its scheduled window.`,
      confirmLabel: "Publish",
    });
    if (confirmed) await run("Publishing exam…", () => publishExam(exam.id));
  };

  const unpublish = async (exam: Exam) => {
    const confirmed = await confirm({
      title: "Unpublish exam?",
      description: `"${exam.title}" returns to draft and examinees can no longer see it. Exams that have already been attempted can't be unpublished.`,
      confirmLabel: "Unpublish",
    });
    if (confirmed) await run("Unpublishing exam…", () => unpublishExam(exam.id));
  };

  const archive = async (exam: Exam) => {
    const confirmed = await confirm({
      title: "Archive exam?",
      description: `"${exam.title}" will no longer accept new attempts and moves to the Archived exams page.`,
      confirmLabel: "Archive",
      destructive: true,
    });
    if (confirmed) await run("Archiving exam…", () => archiveExam(exam.id));
  };

  const unarchive = async (exam: Exam) => {
    const confirmed = await confirm({
      title: "Unarchive exam?",
      description: `"${exam.title}" will return to the status it had before it was archived. If it was published, it reopens to examinees during its scheduled window. Exams archived earlier come back as drafts.`,
      confirmLabel: "Unarchive",
    });
    if (confirmed) await run("Unarchiving exam…", () => unarchiveExam(exam.id));
  };

  const remove = async (exam: Exam) => {
    const confirmed = await confirm({
      title: "Delete exam?",
      description: `"${exam.title}" and its questions will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) await run("Deleting exam…", () => deleteExam(exam.id));
  };

  const duplicate = async (exam: Exam) => {
    setActionError(null);
    try {
      const res = await withProcessing("Duplicating exam…", () => apiClient.duplicateExam(exam.id));
      navigate(`/examiner/exams/${res.exam.id}/edit`);
    } catch (e) {
      setActionError(formatApiError(e));
    }
  };

  // A refetch that fails while rows are already on screen keeps those rows and
  // only warns; with nothing loaded yet the error replaces the list instead.
  const banner = actionError ?? (inView.length > 0 ? error : null);

  return (
    <SectionPanel
      fill
      title={copy.title}
      description={copy.description}
      actionHref={view === "active" ? "/examiner/archived" : "/examiner"}
      actionLabel={view === "active" ? `Archived exams (${archivedCount})` : "Active exams"}
      toolbar={
        <div className="flex flex-col gap-2">
          <FilterBar
            search={query}
            onSearchChange={setQuery}
            searchPlaceholder="Search by title or code…"
            chips={
              view === "active"
                ? ACTIVE_STATUS_CHIPS.map((s) => ({
                    value: s,
                    label: s === "active" ? "published" : s,
                  }))
                : undefined
            }
            activeChip={statusFilter}
            onChipChange={setStatusFilter}
            sortOptions={SORT_OPTIONS}
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
      {banner && (
        <div className="m-4 mb-0 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          {banner}
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading exams…" />
      ) : error && inView.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load exams"
          description={error}
          action={
            <Button variant="outline" onClick={onRetry}>
              Try again
            </Button>
          }
        />
      ) : inView.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={view === "archived" ? "No archived exams" : "No exams available"}
          description={
            view === "archived"
              ? "Exams you archive are kept here until you unarchive or delete them."
              : "Create an exam to get started."
          }
          action={
            view === "active" && onCreate ? (
              <Button variant="outline" onClick={onCreate}>
                <Plus className="h-4 w-4" />
                Create exam
              </Button>
            ) : undefined
          }
        />
      ) : filteredExams.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No exams match your filters"
          description="Adjust the search or filters to see more exams."
          action={
            filtersActive ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
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
                    {exam.status === "active" && (
                      <IconAction label="Unpublish" icon={EyeOff} onClick={() => unpublish(exam)} />
                    )}
                    {exam.status !== "archived" && (
                      <IconAction
                        label="Archive"
                        icon={Archive}
                        tone="danger"
                        onClick={() => archive(exam)}
                      />
                    )}
                    {exam.status === "archived" && (
                      <>
                        <IconAction
                          label="Unarchive"
                          icon={ArchiveRestore}
                          tone="primary"
                          onClick={() => unarchive(exam)}
                        />
                        <IconAction
                          label="Delete"
                          icon={Trash2}
                          tone="danger"
                          onClick={() => remove(exam)}
                        />
                      </>
                    )}
                    <IconAction label="Duplicate" icon={Copy} onClick={() => duplicate(exam)} />
                    {canPreviewExam(exam.created_by) && (
                      <IconAction
                        label="Preview as student"
                        icon={PlayCircle}
                        to={examPreviewPath(exam.id)}
                      />
                    )}
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
                      {exam.status === "archived" ? "View" : "Manage"}
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </SectionPanel>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-status-safe/12 text-status-safe",
    draft: "bg-chart-5/12 text-chart-5",
    archived: "bg-muted text-muted-foreground",
  };
  const labels: Record<string, string> = { active: "published" };
  return (
    <span className={`status-pill ${styles[status] ?? styles.archived}`}>
      {labels[status] ?? status}
    </span>
  );
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
