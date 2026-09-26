import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Power,
  RefreshCw,
} from "@/shared/icons";

import { formatApiError } from "@/core/config/api";
import { resolveAlertsBulk, terminateSession } from "@/features/monitoring/api/monitoring-api";
import { useSessionObserver } from "@/features/monitoring/hooks/use-session-observer";
import { monitoringQueries } from "@/features/monitoring/queries/queries";
import { monitoringKeys } from "@/features/monitoring/queries/keys";
import { useConfirm } from "@/shared/components/common/confirm-dialog";
import { Button } from "@/shared/components/ui/button";
import { groupAlerts } from "@/shared/lib/alert-grouping";

const METRICS = [
  { key: "face_presence_pct", label: "Face" },
  { key: "gaze_focus_pct", label: "Head focus" },
  { key: "posture_compliance_pct", label: "Posture" },
  { key: "identity_match_pct", label: "Identity" },
] as const;

export function SessionMonitorPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const observer = useSessionObserver(sessionId);
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [terminating, setTerminating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingGroup, setResolvingGroup] = useState<string | null>(null);

  const reportQuery = useQuery(monitoringQueries.sessionReport(sessionId ?? ""));

  useEffect(() => {
    if (!sessionId) return;
    observer.connect();
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const history = {
    logs: reportQuery.data?.behavior_logs ?? [],
    alerts: reportQuery.data?.alerts ?? [],
  };

  const refreshHistory = () => {
    if (!sessionId) return;
    void queryClient.invalidateQueries({
      queryKey: monitoringKeys.sessionReport(sessionId),
    });
  };

  const metrics = observer.analysis?.metrics;
  const liveEbi =
    observer.analysis?.exam_behavior_index_pct ??
    metrics?.exam_behavior_index_pct ??
    observer.analysis?.overall_compliance_pct ??
    null;
  const ebiReport = reportQuery.data?.exam_behavior_index;

  const historyAlertGroups = useMemo(
    () =>
      groupAlerts(history.alerts.slice(0, 20), {
        keyOf: (a) => a.alert_type,
        typeOf: (a) => a.alert_type,
        severityOf: (a) => a.severity,
        messageOf: (a) => a.message,
        timeOf: (a) => a.created_at,
        idOf: (a) => a.id,
        resolvedOf: (a) => a.resolved,
      }),
    [history.alerts]
  );

  const liveAlertGroups = useMemo(
    () =>
      groupAlerts(observer.alerts.slice(0, 10), {
        keyOf: (a) => a.type,
        typeOf: (a) => a.type,
        severityOf: (a) => a.severity,
        messageOf: (a) => a.message,
        timeOf: () => null,
      }),
    [observer.alerts]
  );

  const handleResolveGroup = async (alertType: string, groupKey: string) => {
    if (!sessionId) return;
    setResolvingGroup(groupKey);
    try {
      await resolveAlertsBulk({ session: sessionId, alert_type: alertType });
      refreshHistory();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setResolvingGroup(null);
    }
  };

  const handleTerminate = async () => {
    if (!sessionId) return;
    const confirmed = await confirm({
      title: "Terminate session?",
      description:
        "This ends the live session immediately and logs the examinee out of the exam.",
      confirmLabel: "Terminate",
      destructive: true,
    });
    if (!confirmed) return;
    setTerminating(true);
    try {
      await terminateSession(sessionId);
      refreshHistory();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setTerminating(false);
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          to="/monitoring"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to monitoring
        </Link>

        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Session inspector</h1>
            <p className="text-sm text-muted-foreground">
              Live observe · <code className="text-xs">{sessionId}</code> · {observer.status}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refreshHistory}>
              <RefreshCw className="h-4 w-4" />
              Refresh log
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={terminating}
              onClick={handleTerminate}
            >
              {terminating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Power className="h-4 w-4" />
              )}
              Terminate
            </Button>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-4 lg:col-span-2">
            <h2 className="mb-3 font-semibold">Live feed</h2>
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
              {observer.snapshot ? (
                <img
                  src={observer.snapshot}
                  alt="Live snapshot"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Waiting for student frames…
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Exam Behavior Index (live)
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Equal-weight mean of the indicators below
                </p>
              </div>
              <p
                className={`text-2xl font-bold tabular-nums ${
                  liveEbi != null && liveEbi < 80 ? "text-destructive" : ""
                }`}
              >
                {liveEbi === null ? "—" : `${liveEbi.toFixed(0)}%`}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {METRICS.map((m) => {
                const raw = metrics?.[m.key];
                const val = typeof raw === "number" ? raw : null;
                return (
                  <div key={m.key} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-lg font-semibold">
                      {val === null ? "-" : `${val.toFixed(0)}%`}
                    </p>
                  </div>
                );
              })}
            </div>

            {ebiReport && ebiReport.average != null && (
              <div className="mt-4 rounded-lg border p-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <h3 className="font-semibold">Session EBI (average)</h3>
                    <p className="font-mono text-[0.7rem] text-muted-foreground">
                      {ebiReport.formula} · {ebiReport.indicator_count} indicators ·{" "}
                      {ebiReport.sample_count} frame
                      {ebiReport.sample_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p
                    className={`text-2xl font-bold tabular-nums ${
                      ebiReport.average < 80 ? "text-destructive" : ""
                    }`}
                  >
                    {ebiReport.average.toFixed(1)}%
                  </p>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: "Face presence (Fₚ)", v: ebiReport.components.face_presence },
                    { label: "Identity (Fᵢ)", v: ebiReport.components.face_identity },
                    { label: "Upper body (Uₚ)", v: ebiReport.components.upper_body_presence },
                    { label: "Looking-away (G𝒸)", v: ebiReport.components.looking_away_compliance },
                  ].map((c) => (
                    <div key={c.label} className="rounded-md bg-muted/40 px-2 py-1.5">
                      <dt className="text-[0.68rem] text-muted-foreground">{c.label}</dt>
                      <dd className="font-mono text-sm font-medium tabular-nums">
                        {c.v == null ? "n/e" : `${c.v.toFixed(0)}%`}
                      </dd>
                    </div>
                  ))}
                </dl>
                {ebiReport.identity_sample_count === 0 && (
                  <p className="mt-2 text-[0.7rem] text-muted-foreground">
                    Identity not evaluated (no reference face enrolled); averaged over 3 indicators.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col rounded-xl border bg-card p-4">
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Alerts
            </h2>
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto text-sm">
              {historyAlertGroups.map((g) => (
                <li key={g.key} className="rounded border px-3 py-2">
                  <p className="font-medium">
                    {g.message}
                    {g.count > 1 && (
                      <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        ×{g.count}
                      </span>
                    )}
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs capitalize text-muted-foreground">{g.severity}</p>
                    {g.unresolvedIds.length > 0 && (
                      <button
                        type="button"
                        disabled={resolvingGroup === g.key}
                        onClick={() => void handleResolveGroup(g.alertType, g.key)}
                        className="text-xs text-status-safe hover:underline disabled:opacity-50"
                      >
                        {g.unresolvedIds.length > 1
                          ? `Resolve all (${g.unresolvedIds.length})`
                          : "Resolve"}
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {liveAlertGroups.map((g) => (
                <li key={`live-${g.key}`} className="rounded border border-status-watch/30 px-3 py-2">
                  <p className="font-medium">
                    {g.message}
                    {g.count > 1 && (
                      <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        ×{g.count}
                      </span>
                    )}
                  </p>
                  <p className="text-xs capitalize text-muted-foreground">{g.severity} · live</p>
                </li>
              ))}
              {!liveAlertGroups.length && !historyAlertGroups.length && (
                <li className="text-muted-foreground">No alerts yet.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
