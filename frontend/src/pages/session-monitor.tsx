import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Power,
  RefreshCw,
  ScanFace,
  Video,
  VideoOff,
} from "lucide-react";

import { apiClient, type AlertRow, type BehaviorLogRow } from "../core/config/api";
import { useMonitoring } from "../shared/hooks/use-monitoring";

const METRICS: { key: keyof MetricBag; label: string }[] = [
  { key: "face_presence_pct", label: "Face presence" },
  { key: "gaze_focus_pct", label: "Gaze focus" },
  { key: "posture_compliance_pct", label: "Posture" },
  { key: "identity_match_pct", label: "Identity match" },
  { key: "object_clear_pct", label: "Object clear" },
];

interface MetricBag {
  face_presence_pct: number;
  gaze_focus_pct: number;
  posture_compliance_pct: number;
  identity_match_pct: number | null;
  object_clear_pct: number;
  overall_compliance_pct: number;
}

export function SessionMonitor() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const monitoring = useMonitoring({ sessionId, intervalMs: 1000 });
  const { status, error, videoRef, analysis, alerts, start, stop, enrollReference } = monitoring;

  const [history, setHistory] = useState<{ logs: BehaviorLogRow[]; alerts: AlertRow[] }>(
    { logs: [], alerts: [] }
  );

  useEffect(() => {
    if (!sessionId) return;
    apiClient
      .getSessionReport(sessionId)
      .then((res) => setHistory({ logs: res.behavior_logs, alerts: res.alerts }))
      .catch(() => null);
  }, [sessionId]);

  const refreshHistory = async () => {
    if (!sessionId) return;
    const res = await apiClient.getSessionReport(sessionId);
    setHistory({ logs: res.behavior_logs, alerts: res.alerts });
  };

  const isLive = status === "live" || status === "fallback-rest";

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          to="/monitoring"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to monitoring
        </Link>

        <header className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Session inspector</h1>
            <p className="text-muted-foreground text-sm">
              Session <code className="text-xs">{sessionId}</code> · status{" "}
              <strong className="text-foreground">{status}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isLive && (
              <button
                onClick={start}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Video className="w-4 h-4" /> Start
              </button>
            )}
            {isLive && (
              <button
                onClick={stop}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-rose-500 text-white hover:bg-rose-600"
              >
                <VideoOff className="w-4 h-4" /> Stop
              </button>
            )}
            <button
              onClick={enrollReference}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 border border-border hover:bg-accent text-sm"
              disabled={!isLive}
              title="Capture the current frame as the reference face for identity verification"
            >
              <ScanFace className="w-4 h-4" /> Enroll reference
            </button>
            <button
              onClick={refreshHistory}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 border border-border hover:bg-accent text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Refresh history
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
            <CircleAlert className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="aspect-video bg-black relative">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                {!isLive && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
                    <Power className="w-5 h-5 mr-2" /> Stream stopped
                  </div>
                )}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      isLive
                        ? "bg-emerald-500 text-white"
                        : "bg-gray-700 text-gray-200"
                    }`}
                  >
                    {isLive ? "LIVE" : "OFFLINE"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {METRICS.map((m) => {
                const v = analysis?.metrics?.[m.key as keyof MetricBag] as number | null;
                return (
                  <MetricCard key={m.key} label={m.label} value={v} />
                );
              })}
              <MetricCard
                label="Overall compliance"
                value={analysis?.overall_compliance_pct ?? null}
                highlight
              />
            </div>

            <div className="bg-card rounded-xl border border-border">
              <div className="p-4 border-b border-border">
                <h2 className="text-lg font-semibold">Recent behavior events</h2>
              </div>
              <ul className="divide-y divide-border max-h-96 overflow-y-auto">
                {history.logs.length === 0 && (
                  <li className="p-6 text-center text-sm text-muted-foreground">
                    No behavior events recorded yet.
                  </li>
                )}
                {history.logs.slice(0, 50).map((log) => (
                  <li key={log.id} className="p-4 flex items-start gap-3 text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">{log.event_type}</p>
                      <p className="text-xs text-muted-foreground">
                        score {(log.score * 100).toFixed(0)}% · confidence{" "}
                        {(log.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                    <time className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </time>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card rounded-xl border border-border">
              <div className="p-4 border-b border-border">
                <h2 className="text-lg font-semibold">Live alerts</h2>
              </div>
              <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                {alerts.length === 0 && (
                  <li className="p-6 text-center text-sm text-muted-foreground">
                    No live alerts yet.
                  </li>
                )}
                {alerts.map((a, idx) => (
                  <li key={idx} className="p-4 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{a.type}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          a.severity === "high"
                            ? "bg-red-500/10 text-red-600"
                            : a.severity === "medium"
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-blue-500/10 text-blue-600"
                        }`}
                      >
                        {a.severity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{a.message}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-card rounded-xl border border-border">
              <div className="p-4 border-b border-border">
                <h2 className="text-lg font-semibold">Historical alerts</h2>
              </div>
              <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                {history.alerts.length === 0 && (
                  <li className="p-6 text-center text-sm text-muted-foreground">
                    No alerts recorded.
                  </li>
                )}
                {history.alerts.map((a) => (
                  <li key={a.id} className="p-4 text-sm flex items-start gap-3">
                    {a.resolved ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-500 mt-1" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{a.alert_type}</p>
                      <p className="text-xs text-muted-foreground">{a.message}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number | null | undefined;
  highlight?: boolean;
}) {
  const numeric = typeof value === "number" ? value : null;
  const formatted = numeric == null ? "—" : `${numeric.toFixed(1)}%`;
  const color =
    numeric == null
      ? "text-muted-foreground"
      : numeric >= 90
      ? "text-emerald-600"
      : numeric >= 75
      ? "text-amber-500"
      : "text-rose-500";

  return (
    <div
      className={`p-4 rounded-xl border ${
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{formatted}</p>
      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${
            numeric == null
              ? "bg-muted-foreground/30 w-0"
              : numeric >= 90
              ? "bg-emerald-500"
              : numeric >= 75
              ? "bg-amber-500"
              : "bg-rose-500"
          }`}
          style={{ width: `${numeric ?? 0}%` }}
        />
      </div>
    </div>
  );
}
