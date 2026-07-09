import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Power,
  RefreshCw,
} from "lucide-react";

import { formatApiError } from "@/core/config/api";
import { resolveAlert, terminateSession } from "@/features/monitoring/api/monitoring-api";
import { useSessionObserver } from "@/features/monitoring/hooks/use-session-observer";
import { monitoringQueries } from "@/features/monitoring/queries/queries";
import { monitoringKeys } from "@/features/monitoring/queries/keys";
import { useConfirm } from "@/shared/components/common/confirm-dialog";
import { Button } from "@/shared/components/ui/button";

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

  const handleResolve = async (alertId: string) => {
    try {
      await resolveAlert(alertId);
      refreshHistory();
    } catch (e) {
      setError(formatApiError(e));
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
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
          </div>

          <div className="space-y-4 rounded-xl border bg-card p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Alerts
            </h2>
            <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
              {history.alerts.slice(0, 20).map((a) => (
                <li key={a.id} className="rounded border px-3 py-2">
                  <p className="font-medium">{a.message}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs capitalize text-muted-foreground">{a.severity}</p>
                    {!a.resolved && (
                      <button
                        type="button"
                        onClick={() => void handleResolve(a.id)}
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {observer.alerts.slice(0, 10).map((a, i) => (
                <li
                  key={`live-${a.type}-${i}`}
                  className="rounded border border-amber-500/30 px-3 py-2"
                >
                  <p className="font-medium">{a.message}</p>
                  <p className="text-xs capitalize text-muted-foreground">{a.severity} · live</p>
                </li>
              ))}
              {!observer.alerts.length && !history.alerts.length && (
                <li className="text-muted-foreground">No alerts yet.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
