import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Building2,
  CheckCircle,
  Clock,
  Loader2,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { BarChart, DonutChart } from "@tremor/react";

import {
  apiClient,
  formatApiError,
  type AlertRow,
  type BehaviorLogRow,
  type SessionDepartmentAnalytics,
  type SessionReportRow,
} from "../core/config/api";

function formatEventLabel(eventType: string): string {
  return eventType.replace(/_/g, " ");
}

export function ExamResults() {
  const { examId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionRow, setSessionRow] = useState<SessionReportRow | null>(null);
  const [behaviorSummary, setBehaviorSummary] = useState<
    { event_type: string; count: number; avg_score: number }[]
  >([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [logs, setLogs] = useState<BehaviorLogRow[]>([]);
  const [departmentAnalytics, setDepartmentAnalytics] =
    useState<SessionDepartmentAnalytics | null>(null);

  useEffect(() => {
    if (!examId) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { results } = await apiClient.listSessionReports({
          exam: Number(examId),
          status: "completed",
        });
        const latest = results[0];
        if (!latest) {
          setError("No completed session found for this exam.");
          return;
        }
        setSessionRow(latest);

        const report = await apiClient.getSessionReport(latest.id);
        setBehaviorSummary(report.behavior_summary);
        setAlerts(report.alerts);
        setLogs(report.behavior_logs);
        setDepartmentAnalytics(report.department_analytics);
      } catch (err) {
        setError(formatApiError(err, "Failed to load results."));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [examId]);

  const eventChartData = useMemo(
    () =>
      behaviorSummary.map((row) => ({
        name: formatEventLabel(row.event_type),
        Events: row.count,
      })),
    [behaviorSummary]
  );

  const alertSeverityData = useMemo(() => {
    const counts: Record<string, number> = { low: 0, medium: 0, high: 0 };
    for (const alert of alerts) {
      const key = alert.severity in counts ? alert.severity : "medium";
      counts[key] += 1;
    }
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([severity, count]) => ({
        name: severity.charAt(0).toUpperCase() + severity.slice(1),
        value: count,
      }));
  }, [alerts]);

  const scoreComparisonData = useMemo(() => {
    if (!sessionRow || !departmentAnalytics) return [];
    const yourScore = sessionRow.percentage_score;
    return [
      {
        label: "Your score",
        Score: yourScore ?? 0,
      },
      {
        label: "Exam average",
        Score: departmentAnalytics.exam_average_score ?? 0,
      },
      {
        label: `${departmentAnalytics.department_abbreviation} avg`,
        Score: departmentAnalytics.department_average_score ?? 0,
      },
    ];
  }, [sessionRow, departmentAnalytics]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const passed = sessionRow?.passed;
  const score = sessionRow?.percentage_score;

  return (
    <div className="min-h-screen py-8 bg-gradient-to-b from-background via-background to-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        <Link
          to="/examinee"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </Link>

        {error && (
          <div className="px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/5 text-red-600 text-sm mb-6">
            {error}
          </div>
        )}

        {sessionRow && (
          <>
            <header className="mb-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-primary mb-1">Exam results</p>
                  <h1 className="text-3xl font-bold tracking-tight mb-2">
                    {sessionRow.exam_title}
                  </h1>
                  <p className="text-muted-foreground">
                    Submitted{" "}
                    {sessionRow.submitted_at
                      ? new Date(sessionRow.submitted_at).toLocaleString()
                      : "—"}
                    {departmentAnalytics && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                        <Building2 className="w-3 h-3" />
                        {departmentAnalytics.department_name}
                      </span>
                    )}
                  </p>
                </div>
                <div
                  className={`rounded-2xl border px-6 py-4 text-center min-w-[9rem] ${
                    passed
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : passed === false
                        ? "border-rose-500/30 bg-rose-500/10"
                        : "border-border bg-card"
                  }`}
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Score
                  </p>
                  <p className="text-4xl font-bold tracking-tight">
                    {score != null ? `${score.toFixed(1)}%` : "—"}
                  </p>
                  <p
                    className={`mt-1 text-sm font-semibold ${
                      passed
                        ? "text-emerald-600 dark:text-emerald-400"
                        : passed === false
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {passed == null ? "Pending" : passed ? "Passed" : "Did not pass"}
                  </p>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
              <MetricCard
                icon={passed ? CheckCircle : XCircle}
                label="Outcome"
                value={passed == null ? "Pending" : passed ? "Passed" : "Not passed"}
                tone={passed ? "success" : passed === false ? "danger" : "default"}
              />
              <MetricCard
                icon={AlertTriangle}
                label="Alerts"
                value={String(sessionRow.unresolved_alert_count)}
                tone={sessionRow.unresolved_alert_count > 0 ? "warning" : "default"}
              />
              <MetricCard
                icon={Target}
                label="Behavior events"
                value={String(sessionRow.behavior_event_count)}
              />
              {departmentAnalytics?.percentile_in_department != null && (
                <MetricCard
                  icon={Award}
                  label="Dept. percentile"
                  value={`${departmentAnalytics.percentile_in_department.toFixed(0)}th`}
                  tone="success"
                />
              )}
              {departmentAnalytics?.percentile_in_department == null && (
                <MetricCard
                  icon={TrendingUp}
                  label="Vs department"
                  value={
                    departmentAnalytics?.score_vs_department_avg != null
                      ? `${departmentAnalytics.score_vs_department_avg >= 0 ? "+" : ""}${departmentAnalytics.score_vs_department_avg.toFixed(1)}%`
                      : "—"
                  }
                  tone={
                    departmentAnalytics?.score_vs_department_avg != null &&
                    departmentAnalytics.score_vs_department_avg >= 0
                      ? "success"
                      : "default"
                  }
                />
              )}
            </div>

            {departmentAnalytics && scoreComparisonData.length > 0 && (
              <section className="bg-card rounded-xl border border-border p-6 mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold">Department performance</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  How your score compares with others in{" "}
                  <span className="font-medium text-foreground">
                    {departmentAnalytics.department_name}
                  </span>{" "}
                  ({departmentAnalytics.department_completed_sessions} completed attempts
                  department-wide, {departmentAnalytics.exam_completed_sessions} on this exam).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <CompareTile
                    label="Your score"
                    value={score != null ? `${score.toFixed(1)}%` : "—"}
                    highlight
                  />
                  <CompareTile
                    label="Exam average"
                    value={
                      departmentAnalytics.exam_average_score != null
                        ? `${departmentAnalytics.exam_average_score.toFixed(1)}%`
                        : "—"
                    }
                  />
                  <CompareTile
                    label={`${departmentAnalytics.department_abbreviation} average`}
                    value={
                      departmentAnalytics.department_average_score != null
                        ? `${departmentAnalytics.department_average_score.toFixed(1)}%`
                        : "—"
                    }
                  />
                </div>
                <BarChart
                  className="h-56"
                  data={scoreComparisonData}
                  index="label"
                  categories={["Score"]}
                  colors={["emerald"]}
                  yAxisWidth={40}
                  showAnimation
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/40 px-4 py-3">
                    <p className="text-muted-foreground">Department pass rate</p>
                    <p className="text-lg font-semibold">
                      {departmentAnalytics.department_pass_rate != null
                        ? `${departmentAnalytics.department_pass_rate.toFixed(1)}%`
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 px-4 py-3">
                    <p className="text-muted-foreground">Exam pass rate</p>
                    <p className="text-lg font-semibold">
                      {departmentAnalytics.exam_pass_rate != null
                        ? `${departmentAnalytics.exam_pass_rate.toFixed(1)}%`
                        : "—"}
                    </p>
                  </div>
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {eventChartData.length > 0 && (
                <section className="bg-card rounded-xl border border-border p-6">
                  <h2 className="font-semibold mb-1">Behavior events</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Flags recorded during your session.
                  </p>
                  <BarChart
                    className="h-56"
                    data={eventChartData}
                    index="name"
                    categories={["Events"]}
                    colors={["amber"]}
                    yAxisWidth={40}
                    showAnimation
                    layout="vertical"
                  />
                </section>
              )}

              {alertSeverityData.length > 0 && (
                <section className="bg-card rounded-xl border border-border p-6">
                  <h2 className="font-semibold mb-1">Alert severity</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Distribution of proctoring alerts.
                  </p>
                  <DonutChart
                    className="h-56"
                    data={alertSeverityData}
                    index="name"
                    category="value"
                    colors={["emerald", "amber", "rose"]}
                    showAnimation
                  />
                </section>
              )}
            </div>

            {alerts.length > 0 && (
              <section className="bg-card rounded-xl border border-border p-6 mb-6">
                <h2 className="font-semibold mb-4">Alerts ({alerts.length})</h2>
                <ul className="space-y-2 text-sm">
                  {alerts.slice(0, 10).map((a) => (
                    <li
                      key={a.id}
                      className="flex gap-2 items-start rounded-lg bg-muted/30 px-3 py-2"
                    >
                      <Clock className="w-4 h-4 shrink-0 text-muted-foreground mt-0.5" />
                      <span>
                        <span className="font-medium capitalize">[{a.severity}]</span>{" "}
                        {a.message || a.alert_type}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {logs.length > 0 && (
              <section className="bg-card rounded-xl border border-border p-6">
                <h2 className="font-semibold mb-4">Recent behavior events</h2>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {logs.slice(0, 15).map((log) => (
                    <li key={log.id} className="flex justify-between gap-4">
                      <span className="capitalize">{formatEventLabel(log.event_type)}</span>
                      <span className="shrink-0">
                        score {log.score != null ? (log.score * 100).toFixed(0) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!behaviorSummary.length && !alerts.length && !logs.length && (
              <section className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
                No proctoring events were recorded for this session.
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Award;
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const tones = {
    default: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-rose-600 dark:text-rose-400",
  };
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <p className={`text-xl font-semibold tracking-tight ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function CompareTile({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-4 py-3 ${
        highlight
          ? "bg-primary/10 border border-primary/20"
          : "bg-muted/40 border border-transparent"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tracking-tight mt-0.5">{value}</p>
    </div>
  );
}
