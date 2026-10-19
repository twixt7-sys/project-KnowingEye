import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import { buildAdminAlertsWsUrl } from "@/features/monitoring/api/monitoring-api";
import { ExamMonitorView } from "@/features/monitoring/components/exam-monitor-view";
import { ExamOverview } from "@/features/monitoring/components/exam-overview";
import { type LiveAlert, LiveAlertFeed } from "@/features/monitoring/components/live-alert-feed";
import { groupSessionsByExam, parseExamParam } from "@/features/monitoring/lib/exam-groups";
import { monitoringKeys } from "@/features/monitoring/queries/keys";
import { monitoringQueries } from "@/features/monitoring/queries/queries";
import { PageHeader } from "@/shared/components/layout/page-header";
import { PageShell } from "@/shared/components/layout/page-shell";
import { StatCard } from "@/shared/components/layout/stat-card";
import { EmptyState } from "@/shared/components/patterns/empty-state";
import { LoadingState } from "@/shared/components/patterns/loading-state";
import { Button } from "@/shared/components/ui/button";
import { Activity, AlertTriangle, Radio, RefreshCw, ShieldAlert, Users } from "@/shared/icons";

export function MonitoringPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const sessionsQuery = useQuery(monitoringQueries.activeSessions());
  const alertsQuery = useQuery(monitoringQueries.unresolvedAlerts());
  const healthQuery = useQuery(monitoringQueries.health());

  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const alerts = useMemo(() => alertsQuery.data ?? [], [alertsQuery.data]);
  const pipelineMode = healthQuery.data?.pipeline_mode ?? "…";
  const loading = sessionsQuery.isLoading || alertsQuery.isLoading;

  const groups = useMemo(() => groupSessionsByExam(sessions), [sessions]);
  const selectedExamId = parseExamParam(searchParams.get("exam"));
  const selected = groups.find((g) => g.examId === selectedExamId) ?? null;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: monitoringKeys.all });
  };

  useEffect(() => {
    let cancelled = false;
    let retry: number | undefined;
    // Alerts repeat while a condition persists, so coalesce them into one
    // refetch instead of one per alert.
    let pendingRefresh: number | undefined;
    const invalidate = () =>
      void queryClient.invalidateQueries({ queryKey: monitoringKeys.all });
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
            if (msg?.type === "session_state") {
              // Another proctor paused/resumed a session: update the grid.
              invalidate();
              return;
            }
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
            if (pendingRefresh === undefined) {
              pendingRefresh = window.setTimeout(() => {
                pendingRefresh = undefined;
                invalidate();
              }, 1500);
            }
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
      if (pendingRefresh !== undefined) window.clearTimeout(pendingRefresh);
      wsRef.current?.close();
    };
  }, [queryClient]);

  const examTitleBySession = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) map.set(s.id, s.exam_title);
    return map;
  }, [sessions]);

  const summary = useMemo(
    () => ({
      exams: groups.length,
      candidates: sessions.length,
      flagged: sessions.filter((s) => s.unresolved_alert_count > 0).length,
      events: sessions.reduce((sum, s) => sum + s.behavior_event_count, 0),
    }),
    [groups, sessions]
  );

  const actions = (
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
  );

  const errorBanner = error && (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {error}
    </div>
  );

  // An exam picked from a link or bookmark that has since ended: say so rather
  // than showing an empty grid, and offer the way back.
  const selectedGone = selectedExamId !== null && !selected && !sessionsQuery.isLoading;

  if (selected) {
    return (
      <PageShell>
        {errorBanner}
        <ExamMonitorView
          group={selected}
          allGroups={groups}
          actions={actions}
          alerts={alerts}
          alertsLoading={alertsQuery.isLoading}
          liveAlerts={liveAlerts}
          onClearLiveAlerts={() => setLiveAlerts([])}
          onChanged={refresh}
          onError={setError}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Examiner"
        title="Live monitoring"
        description="Every examination running right now. Pick one to watch its candidates."
        actions={actions}
      />

      {errorBanner}

      {selectedGone && (
        <div
          role="status"
          className="rounded-lg border border-status-watch/30 bg-status-watch/10 px-4 py-3 text-sm"
        >
          That exam has no live candidates any more - it may have finished.
        </div>
      )}

      <div className="page-metrics grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Ongoing exams"
          value={String(summary.exams)}
          tone="success"
        />
        <StatCard icon={Users} label="Candidates live" value={String(summary.candidates)} />
        <StatCard
          icon={ShieldAlert}
          label="Candidates with alerts"
          value={String(summary.flagged)}
          tone="danger"
        />
        <StatCard
          icon={AlertTriangle}
          label="Behavior events captured"
          value={String(summary.events)}
          tone="warning"
        />
      </div>

      <LiveAlertFeed
        alerts={liveAlerts}
        onClear={() => setLiveAlerts([])}
        examTitleFor={(sessionId) => examTitleBySession.get(sessionId)}
      />

      {sessionsQuery.isLoading ? (
        <LoadingState label="Loading ongoing exams…" />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No exams are running right now"
          description="Once a candidate starts an exam it shows up here, grouped under its exam."
        />
      ) : (
        <ExamOverview groups={groups} />
      )}
    </PageShell>
  );
}
