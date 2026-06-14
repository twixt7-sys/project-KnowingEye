import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router";

import {
  apiClient,
  type ReportSummary,
  type SessionReportRow,
} from "../core/config/api";

const PIE_COLORS = ["#15803d", "#0d9488", "#22c55e", "#84cc16", "#14b8a6", "#f59e0b"];

export function Reports() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [sessions, setSessions] = useState<SessionReportRow[]>([]);
  const [series, setSeries] = useState<
    { day: string; sessions: number; alerts: number; behaviors: number }[]
  >([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [s, list, ts] = await Promise.all([
        apiClient.getReportSummary(),
        apiClient.listSessionReports(statusFilter ? { status: statusFilter } : undefined),
        apiClient.getTimeseries(),
      ]);
      setSummary(s);
      setSessions(list.results);
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
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Failed to load reports");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = useMemo(
    () =>
      sessions.filter(
        (s) =>
          !query ||
          s.user.toLowerCase().includes(query.toLowerCase()) ||
          s.exam_title.toLowerCase().includes(query.toLowerCase())
      ),
    [sessions, query]
  );

  const eventsData = summary?.events_by_type.map((e) => ({
    name: e.event_type.replace("_", " "),
    value: e.count,
  })) ?? [];

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-1">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              KPIs, exam outcomes, and behavioral patterns across all sessions.
            </p>
          </div>
          <a
            href={apiClient.exportSessionsCSV()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Download className="w-4 h-4" /> Export CSV
          </a>
        </header>

        {error && (
          <div className="px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/5 text-red-600 text-sm">
            {error}
          </div>
        )}

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Total sessions" value={summary.total_sessions} />
            <Kpi label="Active" value={summary.active_sessions} tint="text-emerald-500" />
            <Kpi
              label="Average score"
              value={summary.average_score ? `${summary.average_score.toFixed(1)}%` : "—"}
            />
            <Kpi
              label="Pass rate"
              value={summary.pass_rate != null ? `${summary.pass_rate.toFixed(1)}%` : "—"}
              tint={
                summary.pass_rate != null && summary.pass_rate >= 60
                  ? "text-emerald-500"
                  : "text-amber-500"
              }
            />
            <Kpi label="Unresolved alerts" value={summary.unresolved_alerts} tint="text-rose-500" />
            <Kpi label="Resolved alerts" value={summary.resolved_alerts} />
            <Kpi label="Behavior events" value={summary.behavior_events} />
            <Kpi label="Completed" value={summary.completed_sessions} tint="text-emerald-500" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-2">Activity timeline</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="day" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sessions" stroke="#15803d" strokeWidth={2} />
                  <Line type="monotone" dataKey="alerts" stroke="#ef4444" strokeWidth={2} />
                  <Line type="monotone" dataKey="behaviors" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-2">Event distribution</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={eventsData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label
                  >
                    {eventsData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-2">Alerts by severity</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary?.alerts_by_severity ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="severity" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="#15803d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Session log</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search user or exam"
                  className="pl-8 pr-3 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-md border border-border bg-background text-sm"
              >
                <option value="">All statuses</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Exam</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-right">Score</th>
                  <th className="px-4 py-2 text-right">Alerts</th>
                  <th className="px-4 py-2 text-right">Events</th>
                  <th className="px-4 py-2 text-left">Started</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{s.user_full_name || s.user}</td>
                    <td className="px-4 py-2">{s.exam_title}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {s.percentage_score != null ? `${s.percentage_score.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {s.alert_count}{" "}
                      {s.unresolved_alert_count > 0 && (
                        <span className="text-rose-500">({s.unresolved_alert_count}!)</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{s.behavior_event_count}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(s.started_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link to={`/monitoring/${s.id}`} className="text-primary hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-muted-foreground text-sm">
                      No sessions match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tint = "text-foreground",
}: {
  label: string;
  value: number | string;
  tint?: string;
}) {
  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${tint}`}>{value}</p>
    </div>
  );
}
