import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Loader2, Users } from "lucide-react";

import { apiClient, type SessionReportRow } from "../core/config/api";
import { useAuth } from "../core/providers/auth-provider";
import { DataTablePagination } from "../shared/components/common/data-table-pagination";
import { ScrollableDataTable } from "../shared/components/common/scrollable-data-table";
import { usePagination } from "../shared/hooks/use-pagination";

export function ExamSummary() {
  const { examId } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionReportRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const { page, pageSize, setPage, setPageSize } = usePagination(20);

  useEffect(() => {
    if (!examId) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.listSessionReports({
          exam: Number(examId),
          page,
          page_size: pageSize,
        });
        setSessions(res.results);
        setTotalCount(res.count);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load exam summary.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [examId, page, pageSize]);

  const title = sessions[0]?.exam_title ?? `Exam #${examId}`;
  const backHref = user?.role === "ADMIN" ? "/examiner" : "/examinee";

  if (loading && sessions.length === 0) {
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

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <header className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4" /> {totalCount} session{totalCount === 1 ? "" : "s"}
          </span>
        </p>
      </header>

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
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No sessions yet for this exam.
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
                      <Link
                        to={`/monitoring/${row.id}`}
                        className="text-primary hover:underline"
                      >
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
          loading={loading}
        />
      </div>
    </>
  );
}
