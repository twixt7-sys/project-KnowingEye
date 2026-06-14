import { useCallback, useEffect, useState } from "react";
import { ApiError, type ExamSession } from "../../../core/config/api";
import { fetchSession } from "../api/session-api";

export function useSession(sessionId: string | undefined) {
  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      setSession(await fetchSession(sessionId));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail() : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { session, loading, error, reload };
}
