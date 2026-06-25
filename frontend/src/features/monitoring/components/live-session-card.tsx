import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Eye, Loader2, Power } from "lucide-react";

import { apiClient, type SessionReportRow } from "../../../core/config/api";
import { Button } from "../../../shared/components/ui/button";
import { useSessionObserver } from "../hooks/use-session-observer";

export function LiveSessionCard({
  session,
  onTerminated,
}: {
  session: SessionReportRow;
  onTerminated: () => void;
}) {
  const observer = useSessionObserver(session.id);
  const [terminating, setTerminating] = useState(false);

  useEffect(() => {
    observer.connect();
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const compliance = observer.analysis?.overall_compliance_pct;
  const metrics = observer.analysis?.metrics;

  const handleTerminate = async () => {
    if (!confirm(`Terminate session for ${session.user_full_name || session.user}?`)) return;
    setTerminating(true);
    try {
      await apiClient.terminateSession(session.id);
      onTerminated();
    } catch (e) {
      console.warn(e);
    } finally {
      setTerminating(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="aspect-video bg-black relative">
        {observer.snapshot ? (
          <img
            src={observer.snapshot}
            alt={`${session.user_full_name || session.user} live`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {observer.status === "live" ? "Waiting for frames…" : "Connecting…"}
          </div>
        )}
        <span
          className={`absolute top-2 right-2 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
            observer.status === "live"
              ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
              : "border-border bg-black/50 text-muted-foreground"
          }`}
        >
          {observer.status}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="font-semibold truncate">{session.user_full_name || session.user}</p>
          <p className="text-xs text-muted-foreground truncate">{session.exam_title}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded border p-2">
            <p className="text-muted-foreground">Compliance</p>
            <p className="font-semibold tabular-nums">
              {compliance == null ? "—" : `${compliance.toFixed(0)}%`}
            </p>
          </div>
          <div className="rounded border p-2">
            <p className="text-muted-foreground">Face</p>
            <p className="font-semibold tabular-nums">
              {metrics?.face_presence_pct == null ? "—" : `${metrics.face_presence_pct.toFixed(0)}%`}
            </p>
          </div>
          <div className="rounded border p-2">
            <p className="text-muted-foreground">Alerts</p>
            <p className="font-semibold tabular-nums">{session.unresolved_alert_count}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link to={`/monitoring/${session.id}`}>
              <Eye className="w-4 h-4" />
              Inspect
            </Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={terminating}
            onClick={handleTerminate}
          >
            {terminating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
