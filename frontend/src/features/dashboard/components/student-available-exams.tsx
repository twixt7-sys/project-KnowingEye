import {
  Calendar,
  CalendarCheck,
  Camera,
  CameraOff,
  Clock,
  Loader2,
  PlayCircle,
  SearchX,
} from "@/shared/icons";
import { useMemo, useState } from "react";

import type { Exam } from "@/core/config/api";
import {
  AVAILABLE_SORT_OPTIONS,
  DEFAULT_AVAILABLE_SORT,
  type DashboardExam,
  type ProctoringFilter,
  filterAvailableExams,
  paginate,
  sortAvailableExams,
  toAvailableCard,
} from "@/features/dashboard/lib/student-exams";
import { DataTablePagination } from "@/shared/components/common/data-table-pagination";
import { SectionPanel } from "@/shared/components/layout/section-panel";
import { EmptyState } from "@/shared/components/patterns/empty-state";
import { FilterBar } from "@/shared/components/patterns/filter-bar";
import { LoadingState } from "@/shared/components/patterns/loading-state";
import { Button } from "@/shared/components/ui/button";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { usePagination } from "@/shared/hooks/use-pagination";

// Cards sit 2-3 across, so page in multiples of 6 to avoid a ragged last row.
const PAGE_SIZES = [6, 12, 24] as const;

const PROCTORING_CHIPS: { value: ProctoringFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "proctored", label: "Proctored" },
  { value: "open", label: "Open" },
];

type StudentAvailableExamsProps = {
  /** Every exam the examinee can start; this panel filters, sorts and pages it. */
  exams: Exam[];
  loading: boolean;
  fetching: boolean;
  error: string | null;
  onStart: (exam: DashboardExam) => void;
};

export function StudentAvailableExams({
  exams,
  loading,
  fetching,
  error,
  onStart,
}: StudentAvailableExamsProps) {
  const [search, setSearch] = useState("");
  const [proctoring, setProctoring] = useState<ProctoringFilter>("all");
  const [sort, setSort] = useState(DEFAULT_AVAILABLE_SORT);
  const debouncedSearch = useDebounce(search, 300);
  const { page, pageSize, setPage, setPageSize } = usePagination(PAGE_SIZES[0]);

  const filtered = useMemo(
    () =>
      sortAvailableExams(
        filterAvailableExams(exams, { search: debouncedSearch, proctoring }),
        sort,
      ),
    [exams, debouncedSearch, proctoring, sort],
  );
  const current = useMemo(() => paginate(filtered, page, pageSize), [filtered, page, pageSize]);
  const cards = useMemo(() => current.items.map(toAvailableCard), [current.items]);

  const filtersActive = debouncedSearch.trim() !== "" || proctoring !== "all";

  const clearFilters = () => {
    setSearch("");
    setProctoring("all");
    setPage(1);
  };

  return (
    <SectionPanel
      title="Available"
      description="Exams published and ready to take."
      action={
        fetching && !loading ? (
          <Loader2
            className="mt-1 h-4 w-4 shrink-0 animate-spin text-muted-foreground"
            aria-label="Refreshing"
          />
        ) : undefined
      }
      toolbar={
        <FilterBar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search by title, code, or author…"
          chips={PROCTORING_CHIPS}
          activeChip={proctoring}
          onChipChange={(value) => {
            setProctoring(value as ProctoringFilter);
            setPage(1);
          }}
          sortOptions={AVAILABLE_SORT_OPTIONS}
          sortValue={sort}
          onSortChange={(value) => {
            setSort(value);
            setPage(1);
          }}
        />
      }
    >
      {error && (
        <div className="m-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading exams…" />
      ) : filtered.length === 0 ? (
        filtersActive ? (
          <EmptyState
            icon={SearchX}
            title="No exams match"
            description="Try a different search or clear the filters."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={CalendarCheck}
            title="No active exams right now"
            description="Check back when your examiner publishes one — you'll see it here first."
          />
        )
      ) : (
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((exam) => (
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
                    exam.monitoringEnabled ? "Webcam proctoring is required" : "No webcam required"
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
              {exam.author && (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  Created by {exam.author}
                </p>
              )}

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

              <Button className="mt-5 w-full" onClick={() => onStart(exam)}>
                <PlayCircle className="h-4 w-4" />
                Start exam
              </Button>
            </article>
          ))}
        </div>
      )}

      <DataTablePagination
        page={current.page}
        pageSize={pageSize}
        totalCount={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={PAGE_SIZES}
        loading={loading}
      />
    </SectionPanel>
  );
}
