import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, Loader2, Users } from "@/shared/icons";

import { formatApiError } from "@/core/config/api";
import { useAuth } from "@/core/providers/auth-provider";
import { reportsQueries } from "@/features/reports/queries/queries";
import { DataTablePagination } from "@/shared/components/common/data-table-pagination";
import { IconAction } from "@/shared/components/common/icon-action";
import { ScrollableDataTable } from "@/shared/components/common/scrollable-data-table";
import { SectionPanel } from "@/shared/components/layout/section-panel";
import { EmptyState } from "@/shared/components/patterns/empty-state";
import { PageHeaderV2 } from "@/shared/components/patterns/page-header-v2";
import { usePagination } from "@/shared/hooks/use-pagination";

function CorrectnessBar({ pct }: { pct: number }) {
  const tone =
    pct >= 70 ? "bg-status-safe" : pct >= 40 ? "bg-status-watch" : "bg-status-alert";
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span
          className={`block h-full rounded-full ${tone}`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </span>
      <span className="font-mono text-xs tabular-nums">{pct}%</span>
    </div>
  );
}

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
    <div className="page-flow">
      <Link
        to={backHref}
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>

      {displayError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {displayError}
        </div>
      )}

      <PageHeaderV2
        eyebrow="Exam summary"
        title={title}
        actions={
          <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs tabular-nums text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {totalCount} session{totalCount === 1 ? "" : "s"}
          </span>
        }
      />

      {analytics && analytics.questions.length > 0 && (
        <SectionPanel
          title="Item analysis"
          description="Per-question difficulty at a glance — correctness and average time spent."
        >
          <ScrollableDataTable>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Q#</th>
                  <th>Type</th>
                  <th>Correct</th>
                  <th>Avg time (s)</th>
                </tr>
              </thead>
              <tbody>
                {analytics.questions.map((q) => (
                  <tr key={q.question_id}>
                    <td className="font-mono text-sm tabular-nums">{q.order}</td>
                    <td className="capitalize text-muted-foreground">
                      {q.question_type.replace("_", " ")}
                    </td>
                    <td>
                      <CorrectnessBar pct={q.correct_pct} />
                    </td>
                    <td className="font-mono text-sm tabular-nums">{q.avg_time_spent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableDataTable>
        </SectionPanel>
      )}

      <SectionPanel
        title="Sessions"
        description="Every attempt recorded for this examination."
      >
        <ScrollableDataTable>
          <table className="data-table">
            <thead>
              <tr>
                <th>Examinee</th>
                <th>Status</th>
                <th>Score</th>
                <th className="hidden sm:table-cell">Alerts</th>
                <th className="hidden md:table-cell">Submitted</th>
                <th className="text-right"> </th>
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
                  <tr key={row.id}>
                    <td className="font-medium">{row.user_full_name || row.user}</td>
                    <td>
                      <span className="status-pill bg-muted text-muted-foreground">
                        {row.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="font-mono text-sm tabular-nums">
                      {row.percentage_score != null
                        ? `${row.percentage_score.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td
                      className={`hidden font-mono text-sm tabular-nums sm:table-cell ${
                        row.unresolved_alert_count > 0 ? "text-status-alert" : ""
                      }`}
                    >
                      {row.unresolved_alert_count}
                    </td>
                    <td className="hidden font-mono text-xs tabular-nums text-muted-foreground md:table-cell">
                      {row.submitted_at ? new Date(row.submitted_at).toLocaleString() : "—"}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <IconAction
                          label="Inspect session"
                          icon={Eye}
                          tone="primary"
                          to={`/monitoring/${row.id}`}
                        />
                      </div>
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
      </SectionPanel>
    </div>
  );
}
