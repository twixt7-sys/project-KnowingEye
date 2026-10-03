import { AlertTriangle, Camera, Loader2 } from "@/shared/icons";
import type { ClipboardEvent, DragEvent, MouseEvent, ReactNode } from "react";

import { ExamTimer } from "@/features/session/components/taking/exam-timer";

interface FocusShellProps {
  monitoringEnabled: boolean;
  disableCopyPaste: boolean;
  webcamActive: boolean;
  behaviorAlerts: string[];
  tabSwitchWarning?: string | null;
  timeRemaining: number;
  /** A proctor has paused the exam: the clock is stopped and submitting is disabled. */
  paused?: boolean;
  submitting: boolean;
  onSubmitClick: () => void;
  children: ReactNode;
}

/** Directive Area 04 ("Browser-side deterrents", P2): right-click, selection,
 * and copy are disabled on the exam chrome (question text, navigator) to
 * deter casually copying exam content out - but never on an actual form
 * field by default, since a student must still be able to select/cut/copy/
 * paste while editing their own short-answer or essay response. Exams with
 * `disable_copy_paste` set additionally block copy, cut, paste, and drag-drop
 * inside form fields so answers must be typed, not pasted in; typing and
 * selecting text in a field still work. These are
 * deterrents, not security: a determined user can still bypass them (browser
 * devtools, a second device) - see the disclaimer in docs/documentation/
 * chapter2/03-system-design.html, "Browser-side deterrents." */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function FocusShell({
  monitoringEnabled,
  disableCopyPaste,
  webcamActive,
  behaviorAlerts,
  tabSwitchWarning,
  timeRemaining,
  paused = false,
  submitting,
  onSubmitClick,
  children,
}: FocusShellProps) {
  const guard = <T extends MouseEvent | ClipboardEvent>(e: T) => {
    if (!isEditableTarget(e.target)) e.preventDefault();
  };
  // Copy/cut are always blocked outside fields; with disableCopyPaste they're
  // blocked inside fields too, and paste/drop are blocked everywhere.
  const guardCopyCut = (e: ClipboardEvent) => {
    if (disableCopyPaste || !isEditableTarget(e.target)) e.preventDefault();
  };
  const blockPaste = (e: ClipboardEvent | DragEvent) => {
    if (disableCopyPaste) e.preventDefault();
  };

  return (
    <div
      className="min-h-screen bg-background select-none [&_input]:select-text [&_textarea]:select-text"
      onContextMenu={guard}
      onCopy={guardCopyCut}
      onCut={guardCopyCut}
      onPaste={blockPaste}
      onDrop={blockPaste}
    >
      <div className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {monitoringEnabled && (
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    webcamActive
                      ? "bg-primary/10 text-primary"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {webcamActive ? "Monitoring Active" : "Camera Offline"}
                  </span>
                </div>
              )}
              {monitoringEnabled && behaviorAlerts.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {behaviorAlerts[behaviorAlerts.length - 1]}
                  </span>
                </div>
              )}
              {tabSwitchWarning && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-status-alert/10 text-status-alert">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-sm font-medium">{tabSwitchWarning}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <ExamTimer seconds={timeRemaining} paused={paused} />
              <button
                type="button"
                onClick={onSubmitClick}
                disabled={submitting || paused}
                className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Exam"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
