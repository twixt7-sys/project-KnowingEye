import { Eye, Loader2, Power } from "@/shared/icons";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { type SessionReportRow, apiClient, formatApiError } from "../../../core/config/api";
import { useConfirm } from "../../../shared/components/common/confirm-dialog";
import { IconAction } from "../../../shared/components/common/icon-action";
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
  const confirm = useConfirm();
  const [terminating, setTerminating] = useState(false);

  useEffect(() => {
    observer.connect();
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const compliance = observer.analysis?.overall_compliance_pct;
  const metrics = observer.analysis?.metrics;

  const handleTerminate = async () => {
    const confirmed = await confirm({
      title: "Terminate session?",
      description: `This will end the active session for ${
        session.user_full_name || session.user
      }. They will be logged out of the exam.`,
      confirmLabel: "Terminate",
      destructive: true,
    });
    if (!confirmed) return;
    setTerminating(true);
    try {
      await apiClient.terminateSession(session.id);
      toast.success("Session terminated.");
      onTerminated();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setTerminating(false);
    }
  };

  const name = session.user_full_name || session.user;
  const isLive = observer.status === "live";
  const hasAlerts = session.unresolved_alert_count > 0;

  return (
    <div className={`surface-panel overflow-hidden ${hasAlerts ? "border-status-alert/40" : ""}`}>
      <div className="relative aspect-video bg-black">
        {observer.snapshot ? (
          <img
            src={observer.snapshot}
            alt={`${name} live`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
            {isLive ? "Waiting for frames…" : "Connecting…"}
          </div>
        )}

        {/* Monitor chrome: name plate + status */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-6">
          <p className="min-w-0 truncate font-mono text-[0.6875rem] tracking-[0.06em] text-white/90">
            {name}
            {session.seat_label && (
              <span className="ml-1.5 text-white/60">· Seat {session.seat_label}</span>
            )}
          </p>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-[0.3125rem] px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] ${
              isLive ? "bg-status-safe/25 text-emerald-100" : "bg-white/10 text-white/60"
            }`}
          >
            {isLive && <span className="live-dot !h-1.5 !w-1.5" aria-hidden />}
            {observer.status}
          </span>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-xs text-muted-foreground">{session.exam_title}</p>
          {hasAlerts && (
            <span className="status-pill shrink-0 bg-status-alert/12 text-status-alert">
              {session.unresolved_alert_count} alert
              {session.unresolved_alert_count === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <dl className="grid grid-cols-3 divide-x divide-border/60 rounded-lg border border-border/70 bg-muted/25">
          <div className="px-3 py-2">
            <dt className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
              Compliance
            </dt>
            <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums">
              {compliance == null ? "—" : `${compliance.toFixed(0)}%`}
            </dd>
          </div>
          <div className="px-3 py-2">
            <dt className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
              Face
            </dt>
            <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums">
              {metrics?.face_presence_pct == null
                ? "—"
                : `${metrics.face_presence_pct.toFixed(0)}%`}
            </dd>
          </div>
          <div className="px-3 py-2">
            <dt className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
              Alerts
            </dt>
            <dd
              className={`mt-0.5 font-mono text-sm font-medium tabular-nums ${
                hasAlerts ? "text-status-alert" : ""
              }`}
            >
              {session.unresolved_alert_count}
            </dd>
          </div>
        </dl>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link to={`/monitoring/${session.id}`}>
              <Eye className="h-4 w-4" />
              Inspect
            </Link>
          </Button>
          <IconAction
            label="Terminate session"
            icon={Power}
            tone="danger"
            disabled={terminating}
            onClick={handleTerminate}
          >
            {terminating ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          </IconAction>
        </div>
      </div>
    </div>
  );
}
