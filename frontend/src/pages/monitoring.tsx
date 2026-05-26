import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  RefreshCw,
  ShieldAlert,
  Radio,
} from "lucide-react";
import { Link } from "react-router";

import {
  apiClient,
  buildAdminAlertsWsUrl,
  type AlertRow,
  type SessionReportRow,
} from "../core/config/api";

type LiveAlert = {
  ts: number;
  type: string;
  severity: string;
  message: string;
  sessionId?: string;
  user?: string;
};

const SEVERITY_COLORS: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  low: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
};

export function Monitoring() {
  const [sessions, setSessions] = useState<SessionReportRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pipelineMode, setPipelineMode] = useState<string>("…");
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionsRes, alertsRes, health] = await Promise.all([
        apiClient.listSessionReports({ status: "in_progress" }),
        apiClient.listAlerts({ resolved: false }),
        apiClient.getMonitoringHealth().catch(() => null),
      ]);
      setSessions(sessionsRes.results);
      setAlerts(alertsRes);
      if (health) setPipelineMode(health.pipeline_mode);
    } catch (e: any) {
      setError(e?.detail?.() ?? e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    // Live admin-alerts WebSocket. Falls back silently if the server-side
    // Channels layer is unavailable.
    let cancelled = false;
    let retry: number | undefined;
    const connect = () => {
      if (cancelled) return;
      try {
        const ws = new WebSocket(buildAdminAlertsWsUrl());
        wsRef.current = ws;
        ws.onopen = () => setWsConnected(true);
        ws.onclose = () => {
          setWsConnected(false);
          if (!cancelled) retry = window.setTimeout(connect, 4000);
        };
        ws.onerror = () => ws.close();
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg?.type !== "alert" || !msg.payload) return;
            const p = msg.payload;
            setLiveAlerts((prev) =>
              [
                {
                  ts: Date.now(),
                  type: p.type ?? p.alert_type ?? "alert",
                  severity: p.severity ?? "medium",
                  message: p.message ?? "Monitoring alert",
                  sessionId: p.session_id,
                  user: p.user,
                },
                ...prev,
              ].slice(0, 25)
            );
            // Force a refresh of the persisted alert list shortly after.
            window.setTimeout(load, 1500);
          } catch {
            /* ignore */
          }
        };
      } catch {
        retry = window.setTimeout(connect, 4000);
      }
    };
    connect();
    return () => {
      cancelled = true;
      if (retry) window.clearTimeout(retry);
      wsRef.current?.close();
    };
  }, []);

  const resolveAlert = async (id: string) => {
    try {
      await apiClient.resolveAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) {
      console.warn(e);
    }
  };

  const summary = useMemo(
    () => ({
      active: sessions.length,
      highRisk: sessions.filter((s) => s.unresolved_alert_count > 0).length,
      events: sessions.reduce((a, b) => a + b.behavior_event_count, 0),
    }),
    [sessions]
  );

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-1">Live Monitoring</h1>
            <p className="text-muted-foreground">
              Real-time behavior analytics across every active exam session.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${
                wsConnected
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border bg-muted text-muted-foreground"
              }`}
              title={wsConnected ? "Live WebSocket connected" : "Reconnecting…"}
            >
              <Radio className={`w-3 h-3 ${wsConnected ? "animate-pulse" : ""}`} />
              {wsConnected ? "Live" : "Offline"}
            </span>
            <span className="text-xs px-3 py-1.5 rounded-full bg-muted">
              Pipeline: <strong className="ml-1">{pipelineMode}</strong>
            </span>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm border border-border hover:bg-accent transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Stat icon={Activity} label="Active sessions" value={summary.active} tint="from-emerald-500 to-emerald-600" />
          <Stat
            icon={ShieldAlert}
            label="Sessions with unresolved alerts"
            value={summary.highRisk}
            tint="from-rose-500 to-rose-600"
          />
          <Stat
            icon={AlertTriangle}
            label="Behavior events captured"
            value={summary.events}
            tint="from-amber-500 to-amber-600"
          />
        </div>

        {liveAlerts.length > 0 && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/5">
            <div className="px-5 py-3 border-b border-rose-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-400">
                <Radio className="w-4 h-4 animate-pulse" />
                Live alert feed
              </div>
              <button
                onClick={() => setLiveAlerts([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
            <div className="max-h-44 overflow-y-auto divide-y divide-rose-500/10">
              {liveAlerts.map((a, i) => (
                <div
                  key={`${a.ts}-${i}`}
                  className="px-5 py-2 flex items-center gap-3 text-sm"
                >
                  <span
                    className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                      SEVERITY_COLORS[a.severity] ?? ""
                    }`}
                  >
                    {a.severity}
                  </span>
                  <span className="font-medium">{a.type}</span>
                  <span className="text-muted-foreground truncate flex-1">
                    {a.message}
                  </span>
                  {a.sessionId && (
                    <Link
                      to={`/monitoring/${a.sessionId}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Inspect
                    </Link>
                  )}
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {new Date(a.ts).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-card rounded-xl border border-border">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">Active sessions</h2>
              <span className="text-xs text-muted-foreground">
                Auto-refresh every 15s
              </span>
            </div>
            <div className="divide-y divide-border">
              {sessions.length === 0 && !loading && (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  No active sessions right now.
                </div>
              )}
              {sessions.map((s) => (
                <div key={s.id} className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold truncate">{s.user_full_name || s.user}</p>
                      <span className="text-xs text-muted-foreground">·</span>
                      <p className="text-xs text-muted-foreground truncate">{s.exam_title}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(s.started_at).toLocaleTimeString()}
                      </span>
                      <span>{s.behavior_event_count} events</span>
                      {s.unresolved_alert_count > 0 ? (
                        <span className="text-rose-500">
                          {s.unresolved_alert_count} unresolved alerts
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle className="w-3 h-3" /> clean
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    to={`/monitoring/${s.id}`}
                    className="text-sm rounded-lg px-3 py-1.5 border border-border hover:bg-accent transition-colors"
                  >
                    Inspect
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border">
            <div className="p-5 border-b border-border">
              <h2 className="text-lg font-semibold">Unresolved alerts</h2>
              <p className="text-xs text-muted-foreground">
                Newest first; click resolve once reviewed.
              </p>
            </div>
            <div className="divide-y divide-border max-h-[640px] overflow-y-auto">
              {alerts.length === 0 && !loading && (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  No active alerts.
                </div>
              )}
              {alerts.map((a) => (
                <div key={a.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <span
                      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                        SEVERITY_COLORS[a.severity] ?? ""
                      }`}
                    >
                      {a.severity}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(a.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{a.alert_type}</p>
                  <p className="text-xs text-muted-foreground mb-2">{a.message}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate">
                      {a.session_user} · {a.exam_title}
                    </span>
                    <button
                      onClick={() => resolveAlert(a.id)}
                      className="rounded-md px-2 py-1 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <div className="p-5 rounded-xl border border-border bg-card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${tint} flex items-center justify-center`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
