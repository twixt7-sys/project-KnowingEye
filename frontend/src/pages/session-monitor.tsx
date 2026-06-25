import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Power,
  RefreshCw,
} from "lucide-react";

import { apiClient, formatApiError, type AlertRow, type BehaviorLogRow } from "../core/config/api";
import { useSessionObserver } from "../features/monitoring/hooks/use-session-observer";
import { Button } from "../shared/components/ui/button";

const METRICS = [
  { key: "face_presence_pct", label: "Face" },
  { key: "gaze_focus_pct", label: "Head focus" },
  { key: "posture_compliance_pct", label: "Posture" },
  { key: "identity_match_pct", label: "Identity" },
  { key: "object_clear_pct", label: "Objects clear" },
] as const;

export function SessionMonitor() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const observer = useSessionObserver(sessionId);
  const [history, setHistory] = useState<{ logs: BehaviorLogRow[]; alerts: AlertRow[] }>({
    logs: [],
    alerts: [],
  });
  const [terminating, setTerminating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    observer.connect();
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const refreshHistory = async () => {
    if (!sessionId) return;
    const res = await apiClient.getSessionReport(sessionId);
    setHistory({ logs: res.behavior_logs, alerts: res.alerts });
  };

  useEffect(() => {
    refreshHistory().catch(() => null);
  }, [sessionId]);

  const metrics = observer.analysis?.metrics;

  const handleResolve = async (alertId: string) => {
    try {
      await apiClient.resolveAlert(alertId);
      await refreshHistory();
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  const handleTerminate = async () => {
    if (!sessionId || !confirm("Terminate this session?")) return;
    setTerminating(true);
    try {
      await apiClient.terminateSession(sessionId);
      await refreshHistory();
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
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to monitoring
        </Link>

        <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Session inspector</h1>
            <p className="text-muted-foreground text-sm">
              Live observe · <code className="text-xs">{sessionId}</code> · {observer.status}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refreshHistory()}>
              <RefreshCw className="w-4 h-4" />
              Refresh log
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={terminating}
              onClick={handleTerminate}
            >
              {terminating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
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
          <div className="lg:col-span-2 rounded-xl border bg-card p-4">
            <h2 className="font-semibold mb-3">Live feed</h2>
            <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
              {observer.snapshot ? (
                <img src={observer.snapshot} alt="Live snapshot" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  Waiting for student frames…
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {METRICS.map((m) => {
                const raw = metrics?.[m.key];
                const val = typeof raw === "number" ? raw : null;
                return (
                  <div key={m.key} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-lg font-semibold">{val === null ? "—" : `${val.toFixed(0)}%`}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Alerts
            </h2>
            <ul className="space-y-2 max-h-96 overflow-y-auto text-sm">
              {history.alerts.slice(0, 20).map((a) => (
                <li key={a.id} className="rounded border px-3 py-2">
                  <p className="font-medium">{a.message}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground capitalize">{a.severity}</p>
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
                <li key={`live-${a.type}-${i}`} className="rounded border border-amber-500/30 px-3 py-2">
                  <p className="font-medium">{a.message}</p>
                  <p className="text-xs text-muted-foreground capitalize">{a.severity} · live</p>
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
