import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  Radio,
} from "@/shared/icons";
import { Link } from "react-router";

import { formatApiError, type AlertRow } from "@/core/config/api";
import {
  buildAdminAlertsWsUrl,
  resolveAlertsBulk,
} from "@/features/monitoring/api/monitoring-api";
import { SessionGrid } from "@/features/monitoring/components/session-grid";
import { monitoringQueries } from "@/features/monitoring/queries/queries";
import { monitoringKeys } from "@/features/monitoring/queries/keys";
import { PageHeader } from "@/shared/components/layout/page-header";
import { PageShell } from "@/shared/components/layout/page-shell";
import { SectionPanel } from "@/shared/components/layout/section-panel";
import { StatCard } from "@/shared/components/layout/stat-card";
import { Button } from "@/shared/components/ui/button";
import { groupAlerts } from "@/shared/lib/alert-grouping";

type LiveAlert = {
  ts: number;
  type: string;
  severity: string;
  message: string;
  sessionId?: string;
  user?: string;
};

const SEVERITY_COLORS: Record<string, string> = {
  high: "bg-status-alert/10 text-status-alert border-status-alert/20",
  medium: "bg-status-watch/10 text-status-watch border-status-watch/20",
  low: "bg-secondary/10 text-secondary border-secondary/20",
};

export function MonitoringPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const sessionsQuery = useQuery(monitoringQueries.activeSessions());
  const alertsQuery = useQuery(monitoringQueries.unresolvedAlerts());
  const healthQuery = useQuery(monitoringQueries.health());

  const sessions = sessionsQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];
  const pipelineMode = healthQuery.data?.pipeline_mode ?? "…";
  const loading = sessionsQuery.isLoading || alertsQuery.isLoading;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: monitoringKeys.all });
  };

  useEffect(() => {
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
            window.setTimeout(refresh, 1500);
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
  }, [queryClient]);

  const [resolvingGroup, setResolvingGroup] = useState<string | null>(null);

  const alertGroups = useMemo(
    () =>
      groupAlerts(alerts, {
        keyOf: (a) => `${a.session}:${a.alert_type}`,
        typeOf: (a) => a.alert_type,
        severityOf: (a) => a.severity,
        messageOf: (a) => a.message,
        timeOf: (a) => a.created_at,
        idOf: (a) => a.id,
        resolvedOf: (a) => a.resolved,
      }),
    [alerts]
  );

  const handleResolveGroup = async (session: string, alertType: string, groupKey: string) => {
    setResolvingGroup(groupKey);
    try {
      await resolveAlertsBulk({ session, alert_type: alertType });
      queryClient.setQueryData<AlertRow[]>(
        monitoringKeys.alerts({ resolved: false }),
        (prev) => prev?.filter((a) => !(a.session === session && a.alert_type === alertType)) ?? []
      );
    } catch (e: unknown) {
      setError(formatApiError(e, "Failed to resolve alerts"));
    } finally {
      setResolvingGroup(null);
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
                  ? "border-status-safe/30 bg-status-safe/10 text-status-safe"
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
            <Button variant="outline" onClick={refresh} disabled={loading}>
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
              type="button"
              onClick={() => setLiveAlerts([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="max-h-44 divide-y divide-destructive/10 overflow-y-auto">
            {liveAlerts.map((a, i) => (
              <div key={`${a.ts}-${i}`} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className={`status-pill border ${SEVERITY_COLORS[a.severity] ?? ""}`}>
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
          description="Live snapshots via observer WebSocket; list refreshes every 5 seconds."
        >
          {sessions.length === 0 && !loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No active sessions right now.
            </div>
          ) : (
            <SessionGrid sessions={sessions} onTerminated={refresh} />
          )}
        </SectionPanel>

        <SectionPanel
          title="Unresolved alerts"
          description="Grouped by session and type; resolve a group once reviewed."
        >
          <div className="max-h-[640px] divide-y divide-border overflow-y-auto">
            {alertGroups.length === 0 && !loading && (
              <div className="p-10 text-center text-sm text-muted-foreground">No active alerts.</div>
            )}
            {alertGroups.map((g) => {
              const first = g.items[0];
              return (
                <div key={g.key} className="p-4">
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        SEVERITY_COLORS[g.severity] ?? ""
                      }`}
                    >
                      {g.severity}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {g.latestAt ? new Date(g.latestAt).toLocaleTimeString() : ""}
                    </span>
                  </div>
                  <p className="text-sm font-medium">
                    {g.alertType}
                    {g.count > 1 && (
                      <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        ×{g.count}
                      </span>
                    )}
                  </p>
                  <p className="mb-2 text-xs text-muted-foreground">{g.message}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate text-muted-foreground">
                      {first.session_user} · {first.exam_title}
                    </span>
                    <button
                      type="button"
                      disabled={resolvingGroup === g.key}
                      onClick={() => void handleResolveGroup(first.session, g.alertType, g.key)}
                      className="rounded-md bg-status-safe/10 px-2 py-1 text-status-safe hover:bg-status-safe/20 disabled:opacity-50"
                    >
                      {g.count > 1 ? `Resolve all (${g.count})` : "Resolve"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionPanel>
      </div>
    </PageShell>
  );
}
