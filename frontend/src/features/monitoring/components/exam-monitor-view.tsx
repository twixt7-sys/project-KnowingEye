import type { ReactNode } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import type { AlertRow } from "@/core/config/api";
import { examMonitoringPath } from "@/features/monitoring/components/exam-overview";
import { type LiveAlert, LiveAlertFeed } from "@/features/monitoring/components/live-alert-feed";
import { SessionGrid } from "@/features/monitoring/components/session-grid";
import { UnresolvedAlertsPanel } from "@/features/monitoring/components/unresolved-alerts-panel";
import type { ExamGroup } from "@/features/monitoring/lib/exam-groups";
import { PageHeader } from "@/shared/components/layout/page-header";
import { SectionPanel } from "@/shared/components/layout/section-panel";
import { StatCard } from "@/shared/components/layout/stat-card";
import { Activity, AlertTriangle, ArrowLeft, ShieldAlert } from "@/shared/icons";

type ExamMonitorViewProps = {
  group: ExamGroup;
  /** Every ongoing exam, so the proctor can hop between them without going back. */
  allGroups: ExamGroup[];
  /** Live-connection badge, pipeline mode and refresh, shared with the overview. */
  actions: ReactNode;
  alerts: AlertRow[];
  alertsLoading: boolean;
  liveAlerts: LiveAlert[];
  onClearLiveAlerts: () => void;
  onChanged: () => void;
  onError: (message: string) => void;
};

/** One ongoing exam: its candidates' live tiles and its alerts. */
export function ExamMonitorView({
  group,
  allGroups,
  actions,
  alerts,
  alertsLoading,
  liveAlerts,
  onClearLiveAlerts,
  onChanged,
  onError,
}: ExamMonitorViewProps) {
  const sessionIds = new Set(group.sessions.map((s) => s.id));
  const examAlerts = alerts.filter((a) => sessionIds.has(a.session));
  const examLiveAlerts = liveAlerts.filter((a) => a.sessionId && sessionIds.has(a.sessionId));
  const events = group.sessions.reduce((sum, s) => sum + s.behavior_event_count, 0);
  const others = allGroups.filter((g) => g.examId !== group.examId);

  return (
    <>
      <Link
        to="/monitoring"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All ongoing exams
      </Link>

      <PageHeader
        eyebrow={group.department ?? "Ongoing exam"}
        actions={actions}
        title={group.title}
        description={`${group.live} live${
          group.paused ? `, ${group.paused} paused` : ""
        } - snapshots arrive over the observer WebSocket; the list refreshes every 5 seconds.`}
      />

      {others.length > 0 && (
        <nav aria-label="Other ongoing exams" className="mb-4 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
            Also running
          </span>
          {others.map((g) => (
            <Link
              key={g.examId}
              to={examMonitoringPath(g.examId)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs hover:border-primary/40"
            >
              {g.title}
              <span className="tabular-nums text-muted-foreground">{g.sessions.length}</span>
              {g.alerts > 0 && (
                <span className="rounded-full bg-status-alert/12 px-1.5 text-status-alert">
                  {g.alerts}
                </span>
              )}
            </Link>
          ))}
        </nav>
      )}

      <div className="page-metrics grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          icon={Activity}
          label="Candidates"
          value={String(group.sessions.length)}
          hint={group.paused ? `${group.paused} paused` : undefined}
          tone="success"
        />
        <StatCard
          icon={ShieldAlert}
          label="Candidates with alerts"
          value={String(group.flagged)}
          tone="danger"
        />
        <StatCard
          icon={AlertTriangle}
          label="Behavior events captured"
          value={String(events)}
          tone="warning"
        />
      </div>

      <LiveAlertFeed alerts={examLiveAlerts} onClear={onClearLiveAlerts} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionPanel
          className="xl:col-span-2"
          title="Candidates"
          description="Live snapshots via observer WebSocket."
        >
          <SessionGrid sessions={group.sessions} onChanged={onChanged} />
        </SectionPanel>

        <UnresolvedAlertsPanel
          alerts={examAlerts}
          loading={alertsLoading}
          description="This exam's alerts, grouped by candidate and type; resolve a group once reviewed."
          onError={onError}
        />
      </div>
    </>
  );
}
