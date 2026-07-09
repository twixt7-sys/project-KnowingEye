import { useMemo } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
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

import { formatApiError } from "@/core/config/api";
import { reportsQueries } from "@/features/reports/queries/queries";

function formatEventLabel(eventType: string): string {
  return eventType.replace(/_/g, " ");
}

export function ExamResultsPage() {
  const { examId } = useParams();
  const resultsQuery = useQuery(reportsQueries.examResults(examId ?? ""));

  const sessionRow = resultsQuery.data?.sessionRow ?? null;
  const behaviorSummary = resultsQuery.data?.behaviorSummary ?? [];
  const alerts = resultsQuery.data?.alerts ?? [];
  const logs = resultsQuery.data?.logs ?? [];
  const departmentAnalytics = resultsQuery.data?.departmentAnalytics ?? null;

  const loading = resultsQuery.isLoading;
  const error =
    resultsQuery.error != null
      ? formatApiError(resultsQuery.error, "Failed to load results.")
      : null;

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
      { label: "Your score", Score: yourScore ?? 0 },
      { label: "Exam average", Score: departmentAnalytics.exam_average_score ?? 0 },
      {
        label: `${departmentAnalytics.department_abbreviation} avg`,
        Score: departmentAnalytics.department_average_score ?? 0,
      },
    ];
  }, [sessionRow, departmentAnalytics]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const passed = sessionRow?.passed;
  const score = sessionRow?.percentage_score;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 py-8">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Link
          to="/examinee"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {sessionRow && (
          <>
            <header className="mb-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="mb-1 text-sm font-medium text-primary">Exam results</p>
                  <h1 className="mb-2 text-3xl font-bold tracking-tight">{sessionRow.exam_title}</h1>
                  <p className="text-muted-foreground">
                    Submitted{" "}
                    {sessionRow.submitted_at
                      ? new Date(sessionRow.submitted_at).toLocaleString()
                      : "—"}
                    {departmentAnalytics && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                        <Building2 className="h-3 w-3" />
                        {departmentAnalytics.department_name}
                      </span>
                    )}
                  </p>
                </div>
                <div
                  className={`min-w-[9rem] rounded-2xl border px-6 py-4 text-center ${
                    passed
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : passed === false
                        ? "border-rose-500/30 bg-rose-500/10"
                        : "border-border bg-card"
                  }`}
                >
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Score</p>
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

            <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
              {departmentAnalytics?.percentile_in_department != null ? (
                <MetricCard
                  icon={Award}
                  label="Dept. percentile"
                  value={`${departmentAnalytics.percentile_in_department.toFixed(0)}th`}
                  tone="success"
                />
              ) : (
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
              <section className="mb-6 rounded-xl border border-border bg-card p-6">
                <div className="mb-1 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Department performance</h2>
                </div>
                <p className="mb-4 text-sm text-muted-foreground">
                  How your score compares with others in{" "}
                  <span className="font-medium text-foreground">
                    {departmentAnalytics.department_name}
                  </span>{" "}
                  ({departmentAnalytics.department_completed_sessions} completed attempts
                  department-wide, {departmentAnalytics.exam_completed_sessions} on this exam).
                </p>
                <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
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

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {eventChartData.length > 0 && (
                <section className="rounded-xl border border-border bg-card p-6">
                  <h2 className="mb-1 font-semibold">Behavior events</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
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
                <section className="rounded-xl border border-border bg-card p-6">
                  <h2 className="mb-1 font-semibold">Alert severity</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
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
              <section className="mb-6 rounded-xl border border-border bg-card p-6">
                <h2 className="mb-4 font-semibold">Alerts ({alerts.length})</h2>
                <ul className="space-y-2 text-sm">
                  {alerts.slice(0, 10).map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2"
                    >
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
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
              <section className="rounded-xl border border-border bg-card p-6">
                <h2 className="mb-4 font-semibold">Recent behavior events</h2>
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
              <section className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
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
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
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
          ? "border border-primary/20 bg-primary/10"
          : "border border-transparent bg-muted/40"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
