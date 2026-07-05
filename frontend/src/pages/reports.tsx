import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Building2,
  CheckCircle,
  Download,
  Search,
  TrendingUp,
} from "lucide-react";
import { BarChart, DonutChart, LineChart } from "@tremor/react";
import { Link } from "react-router";

import {
  apiClient,
  formatApiError,
  type Department,
  type ReportSummary,
  type SessionReportRow,
} from "../core/config/api";
import { DataTablePagination } from "../shared/components/common/data-table-pagination";
import { ScrollableDataTable } from "../shared/components/common/scrollable-data-table";
import { PageHeader } from "../shared/components/layout/page-header";
import { PageShell } from "../shared/components/layout/page-shell";
import { SectionPanel } from "../shared/components/layout/section-panel";
import { StatCard } from "../shared/components/layout/stat-card";
import { Button } from "../shared/components/ui/button";
import { useDebounce } from "../shared/hooks/use-debounce";
import { usePagination } from "../shared/hooks/use-pagination";

export function Reports() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [sessions, setSessions] = useState<SessionReportRow[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [series, setSeries] = useState<
    { day: string; sessions: number; alerts: number; behaviors: number }[]
  >([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const { page, pageSize, setPage, setPageSize } = usePagination(10);

  const handleExportCsv = async () => {
    setExporting("csv");
    try {
      await apiClient.downloadSessionsCSV();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setExporting("pdf");
    try {
      await apiClient.downloadSessionsPDF();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setExporting(null);
    }
  };

  const loadCharts = async () => {
    try {
      const [s, ts] = await Promise.all([
        apiClient.getReportSummary(),
        apiClient.getTimeseries(),
      ]);
      setSummary(s);
      const dayMap = new Map<string, { sessions: number; alerts: number; behaviors: number }>();
      ts.sessions.forEach((r) =>
        dayMap.set(r.day, { sessions: r.count, alerts: 0, behaviors: 0 })
      );
      ts.alerts.forEach((r) => {
        const v = dayMap.get(r.day) ?? { sessions: 0, alerts: 0, behaviors: 0 };
        v.alerts = r.count;
        dayMap.set(r.day, v);
      });
      ts.behaviors.forEach((r) => {
        const v = dayMap.get(r.day) ?? { sessions: 0, alerts: 0, behaviors: 0 };
        v.behaviors = r.count;
        dayMap.set(r.day, v);
      });
      setSeries(
        Array.from(dayMap.entries())
          .map(([day, v]) => ({ day, ...v }))
          .sort((a, b) => a.day.localeCompare(b.day))
      );
    } catch (e: unknown) {
      setError(formatApiError(e, "Failed to load reports"));
    }
  };

  const loadSessions = async () => {
    setTableLoading(true);
    try {
      const list = await apiClient.listSessionReports({
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(departmentFilter ? { department: Number(departmentFilter) } : {}),
        ...(debouncedQuery ? { search: debouncedQuery } : {}),
        page,
        page_size: pageSize,
      });
      setSessions(list.results);
      setSessionCount(list.count);
    } catch (e: unknown) {
      setError(formatApiError(e, "Failed to load session log"));
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    loadCharts();
    apiClient
      .listDepartments({ active_only: true })
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, departmentFilter, debouncedQuery, page, pageSize]);

  const eventsData = summary?.events_by_type.map((e) => ({
    name: e.event_type.replace("_", " "),
    value: e.count,
  })) ?? [];

  const departmentScoreData =
    summary?.by_department.map((d) => ({
      department: d.department_abbreviation || d.department_name,
      "Avg score": d.average_score ?? 0,
      "Pass rate": d.pass_rate ?? 0,
    })) ?? [];

  const departmentSessionsData =
    summary?.by_department.map((d) => ({
      department: d.department_abbreviation || d.department_name,
      Sessions: d.completed_sessions,
      Alerts: d.alert_count,
    })) ?? [];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Examiner"
        title="Reports & analytics"
        description="KPIs, exam outcomes, and behavioral patterns across all sessions."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleExportCsv}
              disabled={exporting !== null}
            >
              <Download className="h-4 w-4" />
              {exporting === "csv" ? "Exporting…" : "Export CSV"}
            </Button>
            <Button onClick={handleExportPdf} disabled={exporting !== null}>
              <Download className="h-4 w-4" />
              {exporting === "pdf" ? "Exporting…" : "Export PDF"}
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {summary && (
        <>
          <div className="page-metrics grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Total sessions"
              value={String(summary.total_sessions)}
              icon={Activity}
            />
            <StatCard
              label="Active now"
              value={String(summary.active_sessions)}
              icon={BarChart3}
              tone="success"
            />
            <StatCard
              label="Average score"
              value={
                summary.average_score != null
                  ? `${summary.average_score.toFixed(1)}%`
                  : "-"
              }
              icon={TrendingUp}
            />
            <StatCard
              label="Pass rate"
              value={
                summary.pass_rate != null ? `${summary.pass_rate.toFixed(1)}%` : "-"
              }
              icon={CheckCircle}
              tone={
                summary.pass_rate != null && summary.pass_rate >= 60 ? "success" : "warning"
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricTile label="Unresolved alerts" value={summary.unresolved_alerts} tone="danger" />
            <MetricTile label="Resolved alerts" value={summary.resolved_alerts} />
            <MetricTile label="Behavior events" value={summary.behavior_events} />
            <MetricTile label="Completed" value={summary.completed_sessions} tone="success" />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SectionPanel
          className="lg:col-span-2"
          title="Activity timeline"
          description="Sessions, alerts, and behavior events over time."
        >
          <LineChart
            className="h-72 p-4 pt-0"
            data={series}
            index="day"
            categories={["sessions", "alerts", "behaviors"]}
            colors={["emerald", "rose", "amber"]}
            yAxisWidth={40}
            showAnimation
          />
        </SectionPanel>

        <SectionPanel title="Event distribution" description="Breakdown by event type.">
          <DonutChart
            className="h-72 p-4 pt-0"
            data={eventsData}
            index="name"
            category="value"
            colors={["emerald", "teal", "lime", "amber", "cyan", "orange"]}
            showAnimation
          />
        </SectionPanel>
      </div>

      <SectionPanel title="Alerts by severity" description="Unresolved alert volume by level.">
        <BarChart
          className="h-56 p-4 pt-0"
          data={summary?.alerts_by_severity ?? []}
          index="severity"
          categories={["count"]}
          colors={["emerald"]}
          yAxisWidth={40}
          showAnimation
        />
      </SectionPanel>

      {departmentScoreData.length > 0 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SectionPanel
            title="Performance by department"
            description="Average score and pass rate across completed sessions."
          >
            <BarChart
              className="h-72 p-4 pt-0"
              data={departmentScoreData}
              index="department"
              categories={["Avg score", "Pass rate"]}
              colors={["emerald", "teal"]}
              yAxisWidth={40}
              showAnimation
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />
          </SectionPanel>
          <SectionPanel
            title="Volume by department"
            description="Completed attempts and alert volume per department."
          >
            <BarChart
              className="h-72 p-4 pt-0"
              data={departmentSessionsData}
              index="department"
              categories={["Sessions", "Alerts"]}
              colors={["cyan", "rose"]}
              yAxisWidth={40}
              showAnimation
            />
          </SectionPanel>
        </div>
      )}

      {summary?.by_department && summary.by_department.length > 0 && (
        <SectionPanel
          title="Department summary"
          description="Completed-session KPIs grouped by exam department."
        >
          <ScrollableDataTable>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th className="text-right">Completed</th>
                  <th className="text-right">Avg score</th>
                  <th className="text-right">Pass rate</th>
                  <th className="text-right">Alerts</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_department.map((d) => (
                  <tr key={d.department_id ?? d.department_name}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{d.department_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.department_abbreviation}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right">{d.completed_sessions}</td>
                    <td className="text-right font-medium">
                      {d.average_score != null ? `${d.average_score.toFixed(1)}%` : "—"}
                    </td>
                    <td className="text-right">
                      {d.pass_rate != null ? `${d.pass_rate.toFixed(1)}%` : "—"}
                    </td>
                    <td className="text-right">{d.alert_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableDataTable>
        </SectionPanel>
      )}

      <SectionPanel
        title="Session log"
        description="Search and filter completed or in-progress sessions."
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search user or exam…"
                className="form-field w-full py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <select
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
              }}
              className="form-field text-sm"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.abbreviation} — {d.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="form-field text-sm"
            >
              <option value="">All statuses</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
        }
      >
        <ScrollableDataTable>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th className="hidden sm:table-cell">Exam</th>
                <th className="hidden md:table-cell">Dept</th>
                <th>Status</th>
                <th className="text-right">Score</th>
                <th className="hidden md:table-cell text-right">Alerts</th>
                <th className="hidden lg:table-cell text-right">Events</th>
                <th className="hidden xl:table-cell">Started</th>
                <th className="text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <p className="font-medium">{s.user_full_name || s.user}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">{s.exam_title}</p>
                  </td>
                  <td className="hidden max-w-[12rem] text-sm text-muted-foreground sm:table-cell">
                    <span className="line-clamp-2">{s.exam_title}</span>
                  </td>
                  <td className="hidden text-sm text-muted-foreground md:table-cell">
                    {s.department_abbreviation ?? "—"}
                  </td>
                  <td>
                    <span className="status-pill bg-muted text-muted-foreground">{s.status}</span>
                  </td>
                  <td className="text-right font-medium">
                    {s.percentage_score != null ? `${s.percentage_score.toFixed(1)}%` : "-"}
                  </td>
                  <td className="hidden text-right md:table-cell">
                    {s.alert_count}
                    {s.unresolved_alert_count > 0 && (
                      <span className="text-destructive"> ({s.unresolved_alert_count}!)</span>
                    )}
                  </td>
                  <td className="hidden text-right text-muted-foreground lg:table-cell">
                    {s.behavior_event_count}
                  </td>
                  <td className="hidden text-sm text-muted-foreground xl:table-cell">
                    {new Date(s.started_at).toLocaleString()}
                  </td>
                  <td className="text-right">
                    <Link to={`/monitoring/${s.id}`} className="section-link">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && !tableLoading && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    No sessions match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollableDataTable>

        <DataTablePagination
          page={page}
          pageSize={pageSize}
          totalCount={sessionCount}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          loading={tableLoading}
        />
      </SectionPanel>
    </PageShell>
  );
}

function MetricTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "danger";
}) {
  const tones = {
    default: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    danger: "text-destructive",
  };
  return (
    <div className="surface-panel px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tracking-tight ${tones[tone]}`}>{value}</p>
    </div>
  );
}
