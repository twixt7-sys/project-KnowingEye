import { Eye, Loader2, SearchX } from "@/shared/icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { formatApiError } from "@/core/config/api";
import { toCompletedCard } from "@/features/dashboard/lib/student-exams";
import { dashboardQueries } from "@/features/dashboard/queries/queries";
import { DataTablePagination } from "@/shared/components/common/data-table-pagination";
import { IconAction } from "@/shared/components/common/icon-action";
import { SectionPanel } from "@/shared/components/layout/section-panel";
import { EmptyState } from "@/shared/components/patterns/empty-state";
import { FilterBar } from "@/shared/components/patterns/filter-bar";
import { IrisGauge } from "@/shared/components/patterns/iris-gauge";
import { LoadingState } from "@/shared/components/patterns/loading-state";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/components/ui/utils";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { usePagination } from "@/shared/hooks/use-pagination";

type ResultFilter = "all" | "passed" | "failed";

const RESULT_CHIPS: { value: ResultFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Not passed" },
];

// Values the sessions endpoint accepts for `ordering` (`-` = descending).
const SORT_OPTIONS = [
  { value: "-started_at", label: "Newest first" },
  { value: "started_at", label: "Oldest first" },
  { value: "-percentage_score", label: "Highest score" },
  { value: "percentage_score", label: "Lowest score" },
  { value: "exam_title", label: "Exam title (A–Z)" },
];

export function StudentCompletedExams() {
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<ResultFilter>("all");
  const [sort, setSort] = useState("-started_at");
  const debouncedSearch = useDebounce(search.trim(), 300);
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

  const sessionsQuery = useQuery(
    dashboardQueries.studentSessions({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(result !== "all" ? { passed: result === "passed" } : {}),
      ordering: sort,
      page,
      page_size: pageSize,
    }),
  );

  const rows = (sessionsQuery.data?.results ?? []).map(toCompletedCard);
  const totalCount = sessionsQuery.data?.count ?? 0;
  const loading = sessionsQuery.isLoading;
  // True while a new page/sort/filter loads and the previous rows are still shown.
  const fetching = sessionsQuery.isFetching;
  const error = sessionsQuery.error
    ? formatApiError(sessionsQuery.error, "Could not load completed exams")
    : null;

  const filtersActive = debouncedSearch !== "" || result !== "all";

  const clearFilters = () => {
    setSearch("");
    setResult("all");
    setPage(1);
  };

  return (
    <SectionPanel
      title="Completed"
      description="Past attempts and scores."
      action={
        fetching && !loading ? (
          <Loader2
            className="mt-1 h-4 w-4 shrink-0 animate-spin text-muted-foreground"
            aria-label="Loading"
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
          searchPlaceholder="Search by exam title…"
          chips={RESULT_CHIPS}
          activeChip={result}
          onChipChange={(value) => {
            setResult(value as ResultFilter);
            setPage(1);
          }}
          sortOptions={SORT_OPTIONS}
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
        <LoadingState label="Loading results…" />
      ) : rows.length === 0 && !error ? (
        filtersActive ? (
          <EmptyState
            icon={SearchX}
            title="No results match"
            description="Try a different search or clear the filters."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Eye}
            title="No completed exams yet"
            description="Your submitted attempts and scores will be listed here."
          />
        )
      ) : (
        <div
          aria-busy={fetching}
          className={cn("divide-y divide-border/60 transition-opacity", fetching && "opacity-60")}
        >
          {rows.map((exam) => (
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
              {exam.score != null ? (
                <IrisGauge
                  value={exam.score}
                  size={44}
                  suffix=""
                  tone={exam.passed == null ? "default" : exam.passed ? "success" : "danger"}
                />
              ) : (
                <p className="w-11 text-right font-mono text-lg font-medium tabular-nums">—</p>
              )}
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

      <DataTablePagination
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        loading={fetching}
      />
    </SectionPanel>
  );
}
