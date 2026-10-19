import { Link } from "react-router";

import { Radio } from "@/shared/icons";

export type LiveAlert = {
  ts: number;
  type: string;
  severity: string;
  message: string;
  sessionId?: string;
  user?: string;
};

export const SEVERITY_COLORS: Record<string, string> = {
  high: "bg-status-alert/10 text-status-alert border-status-alert/20",
  medium: "bg-status-watch/10 text-status-watch border-status-watch/20",
  low: "bg-secondary/10 text-secondary border-secondary/20",
};

type LiveAlertFeedProps = {
  alerts: LiveAlert[];
  onClear: () => void;
  /** Exam the alert's session belongs to, when known - shown so a global feed says where it came from. */
  examTitleFor?: (sessionId: string) => string | undefined;
};

/** Alerts pushed over the admin websocket, newest first. */
export function LiveAlertFeed({ alerts, onClear, examTitleFor }: LiveAlertFeedProps) {
  if (alerts.length === 0) return null;
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5">
      <div className="flex items-center justify-between border-b border-destructive/20 px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <Radio className="h-4 w-4 animate-pulse" />
          Live alert feed
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      </div>
      <div className="max-h-44 divide-y divide-destructive/10 overflow-y-auto">
        {alerts.map((a, i) => {
          const exam = a.sessionId ? examTitleFor?.(a.sessionId) : undefined;
          return (
            <div key={`${a.ts}-${i}`} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <span className={`status-pill border ${SEVERITY_COLORS[a.severity] ?? ""}`}>
                {a.severity}
              </span>
              <span className="font-medium">{a.type}</span>
              <span className="flex-1 truncate text-muted-foreground">
                {a.message}
                {(a.user || exam) && (
                  <span className="ml-2 text-xs">
                    · {[a.user, exam].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              {a.sessionId && (
                <Link to={`/monitoring/${a.sessionId}`} className="section-link text-xs">
                  Inspect
                </Link>
              )}
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {new Date(a.ts).toLocaleTimeString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
