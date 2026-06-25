import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle,
  Clock,
  Loader2,
} from "lucide-react";

import {
  apiClient,
  type AlertRow,
  type BehaviorLogRow,
  type SessionReportRow,
} from "../core/config/api";

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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load results.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [examId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
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
              <h1 className="text-3xl font-bold mb-2">{sessionRow.exam_title}</h1>
              <p className="text-muted-foreground">
                Submitted{" "}
                {sessionRow.submitted_at
                  ? new Date(sessionRow.submitted_at).toLocaleString()
                  : "-"}
              </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <StatCard
                icon={BarChart3}
                label="Score"
                value={
                  sessionRow.percentage_score != null
                    ? `${sessionRow.percentage_score.toFixed(1)}%`
                    : "-"
                }
              />
              <StatCard
                icon={CheckCircle}
                label="Result"
                value={
                  sessionRow.passed == null
                    ? "Pending"
                    : sessionRow.passed
                      ? "Passed"
                      : "Did not pass"
                }
              />
              <StatCard
                icon={AlertTriangle}
                label="Alerts"
                value={String(sessionRow.unresolved_alert_count)}
              />
            </div>

            {behaviorSummary.length > 0 && (
              <section className="bg-card rounded-xl border border-border p-6 mb-6">
                <h2 className="font-semibold mb-4">Behavior summary</h2>
                <ul className="space-y-2 text-sm">
                  {behaviorSummary.map((row) => (
                    <li key={row.event_type} className="flex justify-between">
                      <span className="text-muted-foreground">{row.event_type}</span>
                      <span>
                        {row.count} events · avg {row.avg_score?.toFixed(0) ?? "-"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {alerts.length > 0 && (
              <section className="bg-card rounded-xl border border-border p-6 mb-6">
                <h2 className="font-semibold mb-4">Alerts ({alerts.length})</h2>
                <ul className="space-y-2 text-sm">
                  {alerts.slice(0, 10).map((a) => (
                    <li key={a.id} className="flex gap-2">
                      <Clock className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <span>
                        [{a.severity}] {a.message || a.alert_type}
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
                    <li key={log.id}>
                      {log.event_type} · score {log.score ?? "-"}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
