import { Clock } from "@/shared/icons";

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function ExamTimer({ seconds }: { seconds: number }) {
  // Escalate visually as time runs out: calm -> watch (<5 min) -> alert (<1 min).
  const tone =
    seconds <= 60
      ? "bg-status-alert/12 text-status-alert animate-pulse"
      : seconds <= 300
        ? "bg-status-watch/12 text-status-watch"
        : "bg-primary/10 text-primary";

  return (
    <div
      className={`flex items-center gap-2 rounded-md border border-current/15 px-4 py-2 ${tone}`}
      role="timer"
      aria-live={seconds <= 60 ? "assertive" : "off"}
      aria-label={`Time remaining ${formatTime(seconds)}`}
    >
      <Clock className="h-4 w-4" />
      <span className="font-mono text-lg font-semibold tabular-nums tracking-tight">
        {formatTime(seconds)}
      </span>
    </div>
  );
}
