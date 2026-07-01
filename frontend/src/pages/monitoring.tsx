import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  Radio,
} from "lucide-react";
import { Link } from "react-router";

import {
  apiClient,
  buildAdminAlertsWsUrl,
  formatApiError,
  type AlertRow,
  type SessionReportRow,
} from "../core/config/api";
import { PageHeader } from "../shared/components/layout/page-header";
import { PageShell } from "../shared/components/layout/page-shell";
import { SectionPanel } from "../shared/components/layout/section-panel";
import { StatCard } from "../shared/components/layout/stat-card";
import { Button } from "../shared/components/ui/button";
import { LiveSessionCard } from "../features/monitoring/components/live-session-card";

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
        apiClient.listSessionReports({ status: "in_progress", page_size: 50 }),
        apiClient.listAlerts({ resolved: false }),
        apiClient.getMonitoringHealth().catch(() => null),
      ]);
      setSessions(sessionsRes.results);
      setAlerts(alertsRes);
      if (health) setPipelineMode(health.pipeline_mode);
    } catch (e: unknown) {
      setError(formatApiError(e, "Failed to load"));
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
    } catch (e: unknown) {
      setError(formatApiError(e, "Failed to resolve alert"));
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
    <PageShell>
      <PageHeader
        eyebrow="Examiner"
        title="Live monitoring"
        description="Real-time behavior analytics across every active exam session."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`status-pill inline-flex items-center gap-1.5 border ${
                wsConnected
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-border bg-muted text-muted-foreground"
              }`}
              title={wsConnected ? "Live WebSocket connected" : "Reconnecting…"}
            >
              <Radio className={`h-3 w-3 ${wsConnected ? "animate-pulse" : ""}`} />
              {wsConnected ? "Live" : "Offline"}
            </span>
            <span className="status-pill bg-muted text-muted-foreground">
              Pipeline: <strong className="ml-1">{pipelineMode}</strong>
            </span>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="page-metrics grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          icon={Activity}
          label="Active sessions"
          value={String(summary.active)}
          tone="success"
        />
        <StatCard
          icon={ShieldAlert}
          label="Sessions with alerts"
          value={String(summary.highRisk)}
          tone="danger"
        />
        <StatCard
          icon={AlertTriangle}
          label="Behavior events captured"
          value={String(summary.events)}
          tone="warning"
        />
      </div>

      {liveAlerts.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5">
          <div className="flex items-center justify-between border-b border-destructive/20 px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <Radio className="h-4 w-4 animate-pulse" />
              Live alert feed
            </div>
            <button
              onClick={() => setLiveAlerts([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="max-h-44 divide-y divide-destructive/10 overflow-y-auto">
            {liveAlerts.map((a, i) => (
              <div key={`${a.ts}-${i}`} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span
                  className={`status-pill border ${SEVERITY_COLORS[a.severity] ?? ""}`}
                >
                  {a.severity}
                </span>
                <span className="font-medium">{a.type}</span>
                <span className="flex-1 truncate text-muted-foreground">{a.message}</span>
                {a.sessionId && (
                  <Link to={`/monitoring/${a.sessionId}`} className="section-link text-xs">
                    Inspect
                  </Link>
                )}
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {new Date(a.ts).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionPanel
          className="xl:col-span-2"
          title="Active sessions"
          description="Live snapshots via observer WebSocket; list refreshes every 15 seconds."
        >
          {sessions.length === 0 && !loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No active sessions right now.
            </div>
          ) : (
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              {sessions.map((s) => (
                <LiveSessionCard key={s.id} session={s} onTerminated={load} />
              ))}
            </div>
          )}
        </SectionPanel>

        <SectionPanel
          title="Unresolved alerts"
          description="Newest first; resolve once reviewed."
        >
          <div className="max-h-[640px] divide-y divide-border overflow-y-auto">
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
        </SectionPanel>
      </div>
    </PageShell>
  );
}
