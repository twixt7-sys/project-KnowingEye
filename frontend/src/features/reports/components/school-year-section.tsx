import { useQuery } from "@tanstack/react-query";
import { BarChart } from "@tremor/react";
import { useState } from "react";

import { formatApiError } from "@/core/config/api";
import {
  compareSchoolYears,
  formatDelta,
} from "@/features/reports/lib/school-year-compare";
import { reportsQueries } from "@/features/reports/queries/queries";
import { ScrollableDataTable } from "@/shared/components/common/scrollable-data-table";
import { SectionPanel } from "@/shared/components/layout/section-panel";
import { TableLoadingRow } from "@/shared/components/patterns/loading-state";
import type { OutcomeMetrics } from "@/shared/types/api";

const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);

const TREND_TONE = {
  better: "text-status-safe",
  worse: "text-destructive",
  same: "text-muted-foreground",
  unknown: "text-muted-foreground",
} as const;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function MetricCells({ m }: { m: OutcomeMetrics }) {
  return (
    <>
      <td className="text-right">{m.completed_sessions}</td>
      <td className="text-right font-medium">{pct(m.pass_rate)}</td>
      <td className="text-right">{pct(m.average_score)}</td>
      <td className="text-right">{pct(m.average_ebi)}</td>
      <td className="text-right">
        {m.flagged_sessions} ({pct(m.flagged_rate)})
      </td>
    </>
  );
}

const METRIC_HEAD = (
  <>
    <th className="text-right">Completed</th>
    <th className="text-right">Pass rate</th>
    <th className="text-right">Avg score</th>
    <th className="text-right" title="Exam Behavior Index">Avg EBI</th>
    <th className="text-right">Flagged</th>
  </>
);

/**
 * Metrics and insights per school year (only years with completed results),
 * a side-by-side comparison of two years, and a per-exam/department breakdown.
 * A school year runs from the configured start month, by submission date.
 */
export function SchoolYearSection() {
  const yearsQuery = useQuery(reportsQueries.schoolYears());
  const years = yearsQuery.data?.years ?? [];

  const [fromYear, setFromYear] = useState<number | null>(null);
  const [toYear, setToYear] = useState<number | null>(null);
  const [detailYear, setDetailYear] = useState<number | null>(null);

  // Default the comparison to the two most recent years until the user picks.
  const latest = years.at(-1);
  const previous = years.length > 1 ? years[years.length - 2] : undefined;
  const from = years.find((y) => y.start_year === fromYear) ?? previous;
  const to = years.find((y) => y.start_year === toYear) ?? latest;
  const detailStart = detailYear ?? latest?.start_year ?? null;

  const detailQuery = useQuery(reportsQueries.schoolYearDetail(detailStart));

  const chartData = years.map((y) => ({
    year: y.school_year,
    "Pass rate": y.pass_rate ?? 0,
    "Avg score": y.average_score ?? 0,
    "Flagged rate": y.flagged_rate ?? 0,
  }));

  const comparison = from && to ? compareSchoolYears(from, to) : [];
  const startMonth = yearsQuery.data?.start_month;

  return (
    <div className="space-y-5">
      <SectionPanel
        title="School years"
        description={
          startMonth
            ? `Results grouped by the school year they were submitted in. A school year starts in ${MONTHS[startMonth - 1]}.`
            : "Results grouped by the school year they were submitted in."
        }
      >
        {yearsQuery.error && (
          <p className="mb-3 text-sm text-destructive">{formatApiError(yearsQuery.error)}</p>
        )}
        <ScrollableDataTable>
          <table className="data-table">
            <thead>
              <tr>
                <th>School year</th>
                <th className="hidden text-right sm:table-cell">Exams</th>
                <th className="hidden text-right sm:table-cell">Examinees</th>
                {METRIC_HEAD}
              </tr>
            </thead>
            <tbody>
              {yearsQuery.isLoading && <TableLoadingRow colSpan={8} label="Loading school years…" />}
              {[...years].reverse().map((y) => (
                <tr key={y.start_year}>
                  <td>
                    <p className="font-medium">SY {y.school_year}</p>
                    <p className="text-xs text-muted-foreground">
                      {y.period_start} to {y.period_end}
                    </p>
                  </td>
                  <td className="hidden text-right sm:table-cell">{y.exams}</td>
                  <td className="hidden text-right sm:table-cell">{y.examinees}</td>
                  <MetricCells m={y} />
                </tr>
              ))}
              {!yearsQuery.isLoading && years.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    No school year has completed exam results yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollableDataTable>
      </SectionPanel>

      {years.length > 0 && (
        <SectionPanel title="Trend" description="Pass rate, average score and flagged rate by school year.">
          <BarChart
            className="h-64 p-4 pt-0"
            data={chartData}
            index="year"
            categories={["Pass rate", "Avg score", "Flagged rate"]}
            colors={["emerald", "blue", "rose"]}
            yAxisWidth={40}
            showAnimation
            valueFormatter={(v) => `${v.toFixed(0)}%`}
          />
        </SectionPanel>
      )}

      {years.length > 1 && from && to && (
        <SectionPanel
          title="Compare school years"
          description="Change from the first year to the second, in percentage points."
          toolbar={
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <select
                aria-label="Compare from"
                value={from.start_year}
                onChange={(e) => setFromYear(Number(e.target.value))}
                className="form-field text-sm"
              >
                {years.map((y) => (
                  <option key={y.start_year} value={y.start_year}>
                    SY {y.school_year}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground">to</span>
              <select
                aria-label="Compare to"
                value={to.start_year}
                onChange={(e) => setToYear(Number(e.target.value))}
                className="form-field text-sm"
              >
                {years.map((y) => (
                  <option key={y.start_year} value={y.start_year}>
                    SY {y.school_year}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          <ScrollableDataTable>
            <table className="data-table" data-testid="school-year-compare">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className="text-right">SY {from.school_year}</th>
                  <th className="text-right">SY {to.school_year}</th>
                  <th className="text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((c) => (
                  <tr key={c.key}>
                    <td className="font-medium">{c.label}</td>
                    <td className="text-right">{pct(c.from)}</td>
                    <td className="text-right">{pct(c.to)}</td>
                    <td className={`text-right font-medium ${TREND_TONE[c.trend]}`} data-trend={c.trend}>
                      {formatDelta(c.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableDataTable>
        </SectionPanel>
      )}

      {years.length > 0 && (
        <SectionPanel
          title="Breakdown"
          description="The same metrics per department and per exam within one school year."
          toolbar={
            <select
              aria-label="Breakdown school year"
              value={detailStart ?? ""}
              onChange={(e) => setDetailYear(Number(e.target.value))}
              className="form-field text-sm"
            >
              {years.map((y) => (
                <option key={y.start_year} value={y.start_year}>
                  SY {y.school_year}
                </option>
              ))}
            </select>
          }
        >
          {detailQuery.error && (
            <p className="mb-3 text-sm text-destructive">{formatApiError(detailQuery.error)}</p>
          )}
          <ScrollableDataTable>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Department</th>
                  {METRIC_HEAD}
                </tr>
              </thead>
              <tbody>
                {detailQuery.isLoading && <TableLoadingRow colSpan={6} label="Loading breakdown…" />}
                {detailQuery.data?.by_department.map((d) => (
                  <tr key={d.department_id ?? d.department_name}>
                    <td className="font-medium">
                      {d.department_name}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {d.department_abbreviation}
                      </span>
                    </td>
                    <MetricCells m={d} />
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableDataTable>
          <div className="mt-4" />
          <ScrollableDataTable>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  {METRIC_HEAD}
                </tr>
              </thead>
              <tbody>
                {detailQuery.data?.by_exam.map((e) => (
                  <tr key={e.exam_id}>
                    <td className="font-medium">{e.exam_title}</td>
                    <MetricCells m={e} />
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableDataTable>
        </SectionPanel>
      )}
    </div>
  );
}
