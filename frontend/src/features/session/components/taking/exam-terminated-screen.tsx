import { useEffect, useRef } from "react";

import { Button } from "@/shared/components/ui/button";
import { Home, PowerOff } from "@/shared/icons";

interface ExamTerminatedScreenProps {
  /** Shown for context so the examinee knows which attempt ended. */
  examTitle?: string;
  /** Leave the exam - there is nothing left to do on this page. */
  onExit: () => void;
}

/**
 * Shown in place of the exam when a proctor terminates the attempt. Unlike the
 * paused overlay, the exam is not kept mounted underneath: a termination is
 * final, so nothing of it stays on screen, focusable or editable (the page also
 * releases the camera).
 *
 * It announces itself to screen readers (`role="alert"`) and takes focus,
 * because whatever the examinee was typing into has just disappeared. Focus
 * goes to the message, not the button: someone mid-sentence who hits Enter or
 * Space must not be sent off the page before they have read why.
 */
export function ExamTerminatedScreen({ examTitle, onExit }: ExamTerminatedScreenProps) {
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageRef.current?.focus();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div
        ref={messageRef}
        role="alert"
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm outline-none"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-status-alert/12 text-status-alert">
          <PowerOff className="h-8 w-8" weight="fill" aria-hidden />
        </div>
        <h1 className="mb-2 text-2xl font-semibold">Exam terminated</h1>
        {examTitle && <p className="mb-3 font-medium text-foreground">{examTitle}</p>}
        <p className="text-muted-foreground">
          Your proctor has ended this exam session. You can no longer answer or submit it.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          If you think this is a mistake, contact your proctor or instructor.
        </p>

        <Button className="mt-6" onClick={onExit}>
          <Home aria-hidden />
          Return to dashboard
        </Button>
      </div>
    </div>
  );
}
