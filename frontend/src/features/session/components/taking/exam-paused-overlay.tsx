import { formatTime } from "@/features/session/components/taking/exam-timer";
import { Pause } from "@/shared/icons";

interface ExamPausedOverlayProps {
  /** Optional note the proctor left when pausing. */
  reason?: string;
  /** Exam time left; frozen for as long as the pause lasts. */
  secondsRemaining: number;
}

/**
 * Shown over the exam while a proctor has it paused. It sits under the sticky
 * header (z-50) and the monitoring dock (z-40) so the examinee still sees that
 * the camera is on, and it is opaque so the questions aren't on display. The
 * exam itself stays mounted underneath - made `inert` by the page - so the
 * camera feed is never torn down and no answer can be edited during the pause.
 */
export function ExamPausedOverlay({ reason, secondsRemaining }: ExamPausedOverlayProps) {
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-background">
      <div className="flex min-h-full items-center justify-center px-4 pb-8 pt-28">
        <div
          aria-live="polite"
          aria-atomic="true"
          className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-status-watch/12 text-status-watch">
            <Pause className="h-8 w-8" weight="fill" />
          </div>
          <h2 className="mb-2 text-2xl font-semibold">Exam paused</h2>
          <p className="text-muted-foreground">
            Your proctor has paused this exam. Your timer is stopped, so no exam time is being used.
            Stay on this page &mdash; the exam continues automatically when it is resumed.
          </p>

          {reason && (
            <div className="mt-5 rounded-lg bg-accent/50 p-4 text-left text-sm">
              <p className="text-muted-foreground">Note from your proctor</p>
              <p className="mt-1 whitespace-pre-wrap break-words font-medium">{reason}</p>
            </div>
          )}

          <p className="mt-5 text-sm text-muted-foreground">
            Time remaining:{" "}
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {formatTime(secondsRemaining)}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
