import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Users } from "lucide-react";

import { formatApiError } from "@/core/config/api";
import { useAuth } from "@/core/providers/auth-provider";
import { reportsQueries } from "@/features/reports/queries/queries";
import { DataTablePagination } from "@/shared/components/common/data-table-pagination";
import { ScrollableDataTable } from "@/shared/components/common/scrollable-data-table";
import { EmptyState } from "@/shared/components/patterns/empty-state";
import { PageHeaderV2 } from "@/shared/components/patterns/page-header-v2";
import { usePagination } from "@/shared/hooks/use-pagination";

export function ExamSummaryPage() {
  const { examId } = useParams();
  const { user } = useAuth();
  const examNumericId = Number(examId);
  const { page, pageSize, setPage, setPageSize } = usePagination(20);

  const sessionParams = { page, page_size: pageSize };
  const sessionsQuery = useQuery(reportsQueries.examSummary(examNumericId, sessionParams));
  const analyticsQuery = useQuery(
    reportsQueries.examAnalytics(examNumericId, user?.role === "ADMIN")
  );

  const sessions = sessionsQuery.data?.results ?? [];
  const totalCount = sessionsQuery.data?.count ?? 0;
  const analytics = analyticsQuery.data ?? null;
  const title = sessions[0]?.exam_title ?? `Exam #${examId}`;
  const backHref = user?.role === "ADMIN" ? "/examiner" : "/examinee";

  const displayError =
    sessionsQuery.error ?? analyticsQuery.error
      ? formatApiError(sessionsQuery.error ?? analyticsQuery.error, "Failed to load exam summary.")
      : null;

  if (sessionsQuery.isLoading && sessions.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Link
        to={backHref}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {displayError && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
          {displayError}
        </div>
      )}

      <PageHeaderV2 title={title} />
      <p className="mb-8 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Users className="h-4 w-4" /> {totalCount} session{totalCount === 1 ? "" : "s"}
        </span>
      </p>

      {analytics && analytics.questions.length > 0 && (
        <div className="mb-8 rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">Item analysis</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4">Q#</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">% correct</th>
                  <th className="py-2">Avg time (s)</th>
                </tr>
              </thead>
              <tbody>
                {analytics.questions.map((q) => (
                  <tr key={q.question_id} className="border-t">
                    <td className="py-2 pr-4">{q.order}</td>
                    <td className="py-2 pr-4">{q.question_type.replace("_", " ")}</td>
                    <td className="py-2 pr-4">{q.correct_pct}%</td>
                    <td className="py-2">{q.avg_time_spent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="surface-panel overflow-hidden">
        <ScrollableDataTable>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/95 text-left backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Alerts</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={Users}
                      title="No sessions yet"
                      description="Sessions will appear here once examinees submit this exam."
                    />
                  </td>
                </tr>
              ) : (
                sessions.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-3">{row.user_full_name || row.user}</td>
                    <td className="px-4 py-3 capitalize">{row.status.replace("_", " ")}</td>
                    <td className="px-4 py-3">
                      {row.percentage_score != null
                        ? `${row.percentage_score.toFixed(1)}%`
                        : "-"}
                    </td>
                    <td className="px-4 py-3">{row.unresolved_alert_count}</td>
                    <td className="px-4 py-3">
                      {row.submitted_at
                        ? new Date(row.submitted_at).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/monitoring/${row.id}`} className="text-primary hover:underline">
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollableDataTable>

        <DataTablePagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          loading={sessionsQuery.isLoading}
        />
      </div>
    </>
  );
}
