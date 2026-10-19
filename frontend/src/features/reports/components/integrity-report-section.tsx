import { useQuery } from "@tanstack/react-query";
import { BarChart } from "@tremor/react";
import { Fragment, useState } from "react";
import { Link } from "react-router";

import { formatApiError } from "@/core/config/api";
import {
  downloadIntegrityCsv,
  downloadIntegrityPdf,
} from "@/features/reports/api/reports-api";
import { reportsQueries } from "@/features/reports/queries/queries";
import { ScrollableDataTable } from "@/shared/components/common/scrollable-data-table";
import { SectionPanel } from "@/shared/components/layout/section-panel";
import { TableLoadingRow } from "@/shared/components/patterns/loading-state";
import { Button } from "@/shared/components/ui/button";
import { Download } from "@/shared/icons";
import type { IntegrityExamRow, IntegrityParams } from "@/shared/types/api";

const label = (key: string) => key.replace(/_/g, " ");

const SEVERITY_TONE: Record<string, string> = {
  high: "text-destructive",
  medium: "text-status-watch",
  low: "text-muted-foreground",
};

function Tile({ name, value, hint, danger }: { name: string; value: string; hint?: string; danger?: boolean }) {
  return (
    <div className="surface-panel px-4 py-3">
      <p className="text-xs text-muted-foreground">{name}</p>
      <p className={`mt-0.5 text-xl font-semibold tracking-tight ${danger ? "text-destructive" : ""}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(0)}%`);

/**
 * Overall exam-integrity report: how many candidates were flagged for
 * suspected cheating / monitoring violations, per exam, with drill-down to the
 * flagged sessions and their alerts, and CSV/PDF export.
 */
export function IntegrityReportSection() {
  const [schoolYear, setSchoolYear] = useState("");
  const [department, setDepartment] = useState("");
  const [openExam, setOpenExam] = useState<number | null>(null);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const params: IntegrityParams = {
    ...(schoolYear ? { school_year: Number(schoolYear) } : {}),
    ...(department ? { department: Number(department) } : {}),
  };

  const reportQuery = useQuery(reportsQueries.integrity(params));
  const yearsQuery = useQuery(reportsQueries.schoolYears());
  const departmentsQuery = useQuery(reportsQueries.departments());

  const report = reportQuery.data;
  const totals = report?.totals;
  const typeData = Object.entries(totals?.alerts_by_type ?? {}).map(([type, count]) => ({
    type: label(type),
    Alerts: count,
  }));

  const runExport = async (kind: "csv" | "pdf") => {
    setExporting(kind);
    setExportError(null);
    try {
      await (kind === "csv" ? downloadIntegrityCsv(params) : downloadIntegrityPdf(params));
    } catch (err) {
      setExportError(formatApiError(err));
    } finally {
      setExporting(null);
    }
  };

  const error = exportError ?? (reportQuery.error ? formatApiError(reportQuery.error) : null);

  return (
    <div className="space-y-5">
      <SectionPanel
        title="Exam integrity"
        description="Candidates flagged for suspected cheating or monitoring violations: a session is flagged when monitoring raised an alert or a proctor terminated it. Each candidate is counted once."
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <select
              aria-label="School year"
              value={schoolYear}
              onChange={(e) => {
                setSchoolYear(e.target.value);
                setOpenExam(null);
              }}
              className="form-field text-sm"
            >
              <option value="">All school years</option>
              {yearsQuery.data?.years.map((y) => (
                <option key={y.start_year} value={y.start_year}>
                  SY {y.school_year}
                </option>
              ))}
            </select>
            <select
              aria-label="Department"
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setOpenExam(null);
              }}
              className="form-field text-sm"
            >
              <option value="">All departments</option>
              {departmentsQuery.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.abbreviation} — {d.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2 sm:ml-auto">
              <Button variant="outline" onClick={() => runExport("csv")} disabled={exporting !== null}>
                <Download className="h-4 w-4" />
                {exporting === "csv" ? "Exporting…" : "Export CSV"}
              </Button>
              <Button onClick={() => runExport("pdf")} disabled={exporting !== null}>
                <Download className="h-4 w-4" />
                {exporting === "pdf" ? "Exporting…" : "Export PDF"}
              </Button>
            </div>
          </div>
        }
      >
        {error && (
          <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {totals && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5" data-testid="integrity-tiles">
            <Tile
              name="Flagged candidates"
              value={`${totals.flagged_candidates} of ${totals.candidates}`}
              hint={`${pct(totals.candidate_flag_rate)} of candidates`}
              danger={totals.flagged_candidates > 0}
            />
            <Tile
              name="Flagged sessions"
              value={`${totals.flagged_sessions} of ${totals.sessions}`}
            />
            <Tile name="Terminated sessions" value={String(totals.terminated_sessions)} danger={totals.terminated_sessions > 0} />
            <Tile name="Alerts" value={String(totals.alert_count)} />
            <Tile name="Unresolved alerts" value={String(totals.unresolved_alerts)} danger={totals.unresolved_alerts > 0} />
          </div>
        )}
      </SectionPanel>

      {typeData.length > 0 && (
        <SectionPanel title="Alerts by type" description="What the monitoring flagged, across the exams in scope.">
          <BarChart
            className="h-56 p-4 pt-0"
            data={typeData}
            index="type"
            categories={["Alerts"]}
            colors={["rose"]}
            yAxisWidth={40}
            showAnimation
          />
        </SectionPanel>
      )}

      <SectionPanel title="By exam" description="Select an exam to see its flagged candidates and the alerts raised.">
        <ScrollableDataTable>
          <table className="data-table">
            <thead>
              <tr>
                <th>Exam</th>
                <th className="text-right">Candidates</th>
                <th className="text-right">Flagged</th>
                <th className="hidden text-right sm:table-cell">Terminated</th>
                <th className="text-right">Alerts</th>
                <th className="hidden text-right md:table-cell">Unresolved</th>
                <th className="hidden md:table-cell">Top alert types</th>
                <th className="text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {reportQuery.isLoading && <TableLoadingRow colSpan={8} label="Loading integrity report…" />}
              {report?.by_exam.map((exam) => {
                const open = openExam === exam.exam_id;
                return (
                  <Fragment key={exam.exam_id}>
                    <tr>
                      <td>
                        <p className="font-medium">{exam.exam_title}</p>
                        {exam.department_abbreviation && (
                          <p className="text-xs text-muted-foreground">{exam.department_abbreviation}</p>
                        )}
                      </td>
                      <td className="text-right">{exam.candidates}</td>
                      <td className={`text-right font-medium ${exam.flagged_candidates ? "text-destructive" : ""}`}>
                        {exam.flagged_candidates} ({pct(exam.candidate_flag_rate)})
                      </td>
                      <td className="hidden text-right sm:table-cell">{exam.terminated_sessions}</td>
                      <td className="text-right">{exam.alert_count}</td>
                      <td className="hidden text-right md:table-cell">{exam.unresolved_alerts}</td>
                      <td className="hidden text-xs text-muted-foreground md:table-cell">
                        {Object.entries(exam.alerts_by_type)
                          .slice(0, 3)
                          .map(([t, n]) => `${label(t)} ${n}`)
                          .join(", ") || "—"}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="section-link"
                          aria-expanded={open}
                          onClick={() => setOpenExam(open ? null : exam.exam_id)}
                        >
                          {open ? "Hide" : "View flagged"}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={8} className="bg-muted/30">
                          <FlaggedSessions exam={exam} params={params} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {report && report.by_exam.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    No sessions in scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollableDataTable>
      </SectionPanel>
    </div>
  );
}

function FlaggedSessions({ exam, params }: { exam: IntegrityExamRow; params: IntegrityParams }) {
  const query = useQuery(reportsQueries.integritySessions({ ...params, exam: exam.exam_id }));
  const rows = query.data?.results ?? [];

  if (query.isLoading) return <p className="p-3 text-sm text-muted-foreground">Loading flagged sessions…</p>;
  if (query.error) return <p className="p-3 text-sm text-destructive">{formatApiError(query.error)}</p>;
  if (rows.length === 0) return <p className="p-3 text-sm text-muted-foreground">No flagged sessions.</p>;

  return (
    <div className="space-y-3 p-3" data-testid={`flagged-${exam.exam_id}`}>
      {rows.map((r) => (
        <div key={r.session_id} className="rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">
                {r.full_name || r.username}{" "}
                <span className="text-xs font-normal text-muted-foreground">({r.username})</span>
                {r.seat_label && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">seat {r.seat_label}</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {label(r.status)} · {new Date(r.started_at).toLocaleString()}
                {r.percentage_score != null && ` · score ${r.percentage_score.toFixed(0)}%`}
                {r.ebi_average != null && ` · EBI ${r.ebi_average.toFixed(0)}%`}
              </p>
            </div>
            <Link to={`/monitoring/${r.session_id}`} className="section-link">
              Open session
            </Link>
          </div>
          {r.alerts.length > 0 ? (
            <ul className="mt-2 divide-y text-xs">
              {r.alerts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5">
                  <span className="font-medium capitalize">{label(a.alert_type)}</span>
                  <span className={`capitalize ${SEVERITY_TONE[a.severity] ?? ""}`}>{a.severity}</span>
                  <span className="min-w-0 flex-1 text-muted-foreground">{a.message}</span>
                  <span className="text-muted-foreground">
                    {a.resolved ? "resolved" : "unresolved"} · {new Date(a.created_at).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Terminated by a proctor; no alerts recorded.</p>
          )}
        </div>
      ))}
      {query.data?.truncated && (
        <p className="text-xs text-muted-foreground">Showing the most recent {rows.length} flagged sessions.</p>
      )}
    </div>
  );
}
