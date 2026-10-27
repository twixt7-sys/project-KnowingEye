import { Eye, Loader2, Pause, Play, Power } from "@/shared/icons";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { type SessionReportRow, apiClient, formatApiError } from "../../../core/config/api";
import { useAuth } from "../../../core/providers/auth-provider";
import { useConfirm } from "../../../shared/components/common/confirm-dialog";
import { IconAction } from "../../../shared/components/common/icon-action";
import { Button } from "../../../shared/components/ui/button";
import { cn } from "../../../shared/components/ui/utils";
import { useSessionObserver } from "../hooks/use-session-observer";
import { useSessionPause } from "../hooks/use-session-pause";
import type { CardLayout } from "../lib/card-layout";
import { PauseSessionDialog } from "./pause-session-dialog";

export function LiveSessionCard({
  session,
  size = "medium",
  onChanged,
}: {
  session: SessionReportRow;
  /** Tile size from the monitoring grid; small tiles trade the stat strip for density. */
  size?: CardLayout;
  /** A pause, resume or termination succeeded - refetch the session list. */
  onChanged: () => void;
}) {
  const observer = useSessionObserver(session.id);
  const confirm = useConfirm();
  const { can } = useAuth();
  const [terminating, setTerminating] = useState(false);
  // A pushed state is fresher than the polled row.
  const status = observer.sessionState?.status ?? session.status;
  const pauseControls = useSessionPause({ sessionId: session.id, status, onChanged });
  const paused = pauseControls.paused;

  useEffect(() => {
    observer.connect();
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // A tile subscribes to snapshots + a summary, not the per-frame analysis stream.
  const compliance = observer.summary?.exam_behavior_index_pct;
  const facePresence = observer.summary?.face_presence_pct;

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
      onChanged();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setTerminating(false);
    }
  };

  const name = session.user_full_name || session.user;
  const isLive = observer.status === "live";
  const hasAlerts = session.unresolved_alert_count > 0;
  const small = size === "small";
  const large = size === "large";
  const inspectPath = `/monitoring/${session.id}`;
  const alertLabel = `${session.unresolved_alert_count} alert${
    session.unresolved_alert_count === 1 ? "" : "s"
  }`;

  const controls = (
    <>
      {pauseControls.visible &&
        (paused ? (
          <IconAction
            label="Resume exam"
            icon={Play}
            tone="primary"
            disabled={pauseControls.busy}
            onClick={() => void pauseControls.resume()}
          >
            {pauseControls.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          </IconAction>
        ) : (
          <IconAction
            label="Pause exam"
            icon={Pause}
            disabled={pauseControls.busy}
            onClick={() => pauseControls.setDialogOpen(true)}
          />
        ))}
      {can("sessions.terminate") && (
        <IconAction
          label="Terminate session"
          icon={Power}
          tone="danger"
          disabled={terminating}
          onClick={handleTerminate}
        >
          {terminating ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
        </IconAction>
      )}
    </>
  );

  return (
    <div className={`surface-panel overflow-hidden ${hasAlerts ? "border-status-alert/40" : ""}`}>
      <div className="relative aspect-video bg-black">
        {observer.snapshot ? (
          <img
            src={observer.snapshot}
            alt={`${name} live`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
            {isLive ? "Waiting for frames…" : "Connecting…"}
          </div>
        )}

        {paused && (
          <span
            className={cn(
              "absolute inline-flex items-center gap-1.5 rounded-[0.3125rem] bg-status-watch/90 px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-black",
              small ? "left-2 top-2" : "left-3 top-3",
            )}
          >
            <Pause className="h-3 w-3" weight="fill" aria-hidden />
            Paused
          </span>
        )}

        {/* Small tiles have no stat strip, so the alert count rides on the video. */}
        {small && hasAlerts && (
          <span className="absolute right-2 top-2 rounded-[0.3125rem] bg-status-alert px-1.5 py-0.5 font-mono text-[0.625rem] tabular-nums text-white">
            {alertLabel}
          </span>
        )}

        {/* Monitor chrome: name plate + status */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent",
            small ? "px-2 pb-1.5 pt-4" : "px-3 pb-2 pt-6",
          )}
        >
          <p
            className={cn(
              "min-w-0 truncate font-mono tracking-[0.06em] text-white/90",
              large ? "text-sm" : "text-[0.6875rem]",
            )}
          >
            {name}
            {session.seat_label && !small && (
              <span className="ml-1.5 text-white/60">· Seat {session.seat_label}</span>
            )}
          </p>
          {small ? (
            <span
              role="img"
              aria-label={observer.status}
              title={observer.status}
              className={cn(
                "shrink-0",
                isLive
                  ? "live-dot !h-1.5 !w-1.5"
                  : "inline-block h-1.5 w-1.5 rounded-full bg-white/40",
              )}
            />
          ) : (
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-[0.3125rem] px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] ${
                isLive ? "bg-status-safe/25 text-emerald-100" : "bg-white/10 text-white/60"
              }`}
            >
              {isLive && <span className="live-dot !h-1.5 !w-1.5" aria-hidden />}
              {observer.status}
            </span>
          )}
        </div>
      </div>

      {small ? (
        <div className="flex items-center gap-1 px-2 py-1.5">
          <p
            className="mr-auto min-w-0 truncate font-mono text-[0.6875rem] tabular-nums text-muted-foreground"
            title="Exam Behavior Index"
          >
            EBI {compliance == null ? "—" : `${compliance.toFixed(0)}%`}
          </p>
          <IconAction label="Inspect" icon={Eye} to={inspectPath} />
          {controls}
        </div>
      ) : (
        <div className={cn("space-y-3", large ? "p-5" : "p-4")}>
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-muted-foreground">{session.exam_title}</p>
            {hasAlerts && (
              <span className="status-pill shrink-0 bg-status-alert/12 text-status-alert">
                {alertLabel}
              </span>
            )}
          </div>

          <dl className="grid grid-cols-3 divide-x divide-border/60 rounded-lg border border-border/70 bg-muted/25">
            <div className={large ? "px-4 py-3" : "px-3 py-2"}>
              <dt
                className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground"
                title="Exam Behavior Index — equal-weight mean of face presence, identity, upper-body presence and looking-away compliance"
              >
                EBI
              </dt>
              <dd
                className={cn(
                  "mt-0.5 font-mono font-medium tabular-nums",
                  large ? "text-lg" : "text-sm",
                )}
              >
                {compliance == null ? "—" : `${compliance.toFixed(0)}%`}
              </dd>
            </div>
            <div className={large ? "px-4 py-3" : "px-3 py-2"}>
              <dt className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
                Face
              </dt>
              <dd
                className={cn(
                  "mt-0.5 font-mono font-medium tabular-nums",
                  large ? "text-lg" : "text-sm",
                )}
              >
                {facePresence == null ? "—" : `${facePresence.toFixed(0)}%`}
              </dd>
            </div>
            <div className={large ? "px-4 py-3" : "px-3 py-2"}>
              <dt className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
                Alerts
              </dt>
              <dd
                className={cn(
                  "mt-0.5 font-mono font-medium tabular-nums",
                  large ? "text-lg" : "text-sm",
                  hasAlerts && "text-status-alert",
                )}
              >
                {session.unresolved_alert_count}
              </dd>
            </div>
          </dl>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <Link to={inspectPath}>
                <Eye className="h-4 w-4" />
                Inspect
              </Link>
            </Button>
            {controls}
          </div>
        </div>
      )}

      <PauseSessionDialog
        open={pauseControls.dialogOpen}
        studentName={name}
        busy={pauseControls.busy}
        onOpenChange={pauseControls.setDialogOpen}
        onConfirm={(reason) => void pauseControls.pause(reason)}
      />
    </div>
  );
}
