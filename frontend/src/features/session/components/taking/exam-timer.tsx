import { Clock, Pause } from "@/shared/icons";

export function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function ExamTimer({ seconds, paused = false }: { seconds: number; paused?: boolean }) {
  // Escalate visually as time runs out: calm -> watch (<5 min) -> alert (<1 min).
  // A paused clock is stopped, so it never escalates or pulses.
  const tone = paused
    ? "bg-muted text-muted-foreground"
    : seconds <= 60
      ? "bg-status-alert/12 text-status-alert animate-pulse"
      : seconds <= 300
        ? "bg-status-watch/12 text-status-watch"
        : "bg-primary/10 text-primary";

  return (
    <div
      className={`flex items-center gap-2 rounded-md border border-current/15 px-4 py-2 ${tone}`}
      role="timer"
      aria-live={!paused && seconds <= 60 ? "assertive" : "off"}
      aria-label={
        paused
          ? `Timer paused with ${formatTime(seconds)} remaining`
          : `Time remaining ${formatTime(seconds)}`
      }
    >
      {paused ? <Pause className="h-4 w-4" weight="fill" /> : <Clock className="h-4 w-4" />}
      <span className="font-mono text-lg font-semibold tabular-nums tracking-tight">
        {formatTime(seconds)}
      </span>
      {paused && <span className="text-xs font-semibold uppercase tracking-wide">Paused</span>}
    </div>
  );
}
