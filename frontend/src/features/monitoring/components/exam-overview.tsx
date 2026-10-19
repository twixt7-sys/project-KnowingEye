import { Link } from "react-router";

import type { ExamGroup } from "@/features/monitoring/lib/exam-groups";
import { ChevronRight, Clock, Pause, ShieldAlert, Users } from "@/shared/icons";

/** Where the monitoring page shows one exam's candidates. */
export function examMonitoringPath(examId: number): string {
  return `/monitoring?exam=${examId}`;
}

function formatStarted(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Figure({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone?: "alert" | "watch";
}) {
  const toneClass =
    value > 0 && tone === "alert"
      ? "text-status-alert"
      : value > 0 && tone === "watch"
        ? "text-status-watch"
        : "";
  return (
    <div className="px-3 py-2">
      <dt className="flex items-center gap-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </dt>
      <dd className={`mt-0.5 font-mono text-lg font-medium tabular-nums ${toneClass}`}>{value}</dd>
    </div>
  );
}

export function ExamCard({ group }: { group: ExamGroup }) {
  const started = formatStarted(group.startedAt);
  const hasAlerts = group.alerts > 0;
  return (
    <Link
      to={examMonitoringPath(group.examId)}
      aria-label={`Monitor ${group.title}`}
      className={`surface-panel-interactive group flex flex-col gap-4 p-5 ${
        hasAlerts ? "!border-status-alert/40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-serif text-lg font-semibold leading-snug tracking-tight">
            {group.title}
          </h3>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            {group.department && <span>{group.department}</span>}
            {started && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden />
                since {started}
              </span>
            )}
          </p>
        </div>
        <span className="status-pill shrink-0 bg-status-safe/12 text-status-safe">
          <span className="live-dot !h-1.5 !w-1.5" aria-hidden />
          <span className="ml-1.5">Ongoing</span>
        </span>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-border/60 rounded-lg border border-border/70 bg-muted/25">
        <Figure icon={Users} label="Live" value={group.live} />
        <Figure icon={Pause} label="Paused" value={group.paused} tone="watch" />
        <Figure icon={ShieldAlert} label="Flagged" value={group.flagged} tone="alert" />
      </dl>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {group.avgEbi == null ? "No EBI yet" : `Avg EBI ${group.avgEbi.toFixed(0)}%`}
          {hasAlerts && (
            <span className="ml-2 text-status-alert">
              {group.alerts} unresolved alert{group.alerts === 1 ? "" : "s"}
            </span>
          )}
        </span>
        <span className="inline-flex items-center gap-0.5 font-medium text-primary">
          Monitor
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

export function ExamOverview({ groups }: { groups: ExamGroup[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <ExamCard key={g.examId} group={g} />
      ))}
    </div>
  );
}
