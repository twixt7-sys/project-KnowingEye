import { useState } from "react";
import { toast } from "sonner";

import { formatApiError } from "@/core/config/api";
import { useAuth } from "@/core/providers/auth-provider";
import { pauseSession, resumeSession } from "@/features/monitoring/api/monitoring-api";

interface UseSessionPauseOptions {
  sessionId: string;
  /** The session's current status (a live-pushed one is fresher than a polled row). */
  status: string | undefined;
  /** Called after a successful pause/resume so the caller can refetch. */
  onChanged: () => void;
}

/**
 * Pause / resume controls for one live exam session: whether to show them
 * (needs the `sessions.pause` permission and a running or paused session) and
 * the actions behind them.
 */
export function useSessionPause({ sessionId, status, onChanged }: UseSessionPauseOptions) {
  const { can } = useAuth();
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const paused = status === "paused";
  const visible = can("sessions.pause") && (status === "in_progress" || paused);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      onChanged();
      return true;
    } catch (e) {
      toast.error(formatApiError(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return {
    visible,
    paused,
    busy,
    dialogOpen,
    setDialogOpen,
    pause: async (reason: string) => {
      if (await run(() => pauseSession(sessionId, reason), "Exam paused.")) setDialogOpen(false);
    },
    resume: () => run(() => resumeSession(sessionId), "Exam resumed."),
  };
}
