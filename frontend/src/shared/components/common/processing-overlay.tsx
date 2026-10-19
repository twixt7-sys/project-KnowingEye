import { useIsMutating } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Loader2 } from "@/shared/icons";
import { DEFAULT_PROCESSING_LABEL, useProcessingLabel } from "@/shared/lib/processing";

/** Quick requests finish before this and never flash the overlay. */
export const PROCESSING_OVERLAY_DELAY_MS = 300;

/**
 * Full-screen translucent overlay with a spinner and a "Processing…" message
 * while a user-initiated request is running. It covers the page, so the user
 * can't trigger a second action until the first one settles, and it is
 * removed the moment the work finishes or fails.
 *
 * Busy sources: any pending TanStack mutation, plus work wrapped in
 * `withProcessing` (for actions that call the API client directly).
 */
export function ProcessingOverlay() {
  const mutating = useIsMutating();
  const taskLabel = useProcessingLabel();
  const busy = mutating > 0 || taskLabel !== null;
  const label = taskLabel ?? DEFAULT_PROCESSING_LABEL;

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), PROCESSING_OVERLAY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [busy]);

  if (!busy || !visible) return null;

  return (
    <div className="fixed inset-0 z-[90] flex cursor-wait items-center justify-center bg-background/60 backdrop-blur-[2px]">
      <output
        aria-live="polite"
        className="surface-panel flex items-center gap-3 px-5 py-4 text-sm font-medium shadow-lg"
      >
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
        {label}
        <span className="sr-only"> Please wait.</span>
      </output>
    </div>
  );
}
