import { extractApiErrorMessage } from "./extract-api-error";

export class ApiError extends Error {
  constructor(
    public status: number,
    public payload: unknown,
  ) {
    super(`API ${status}`);
  }

  detail(): string {
    return extractApiErrorMessage(this.payload);
  }

  /**
   * Machine-readable reason, when the server sent one (e.g. `session_paused`).
   * Switch on this, not on `detail()`: the prose is for display and can change.
   */
  get code(): string | undefined {
    const code = (this.payload as { code?: unknown } | null)?.code;
    return typeof code === "string" ? code : undefined;
  }
}

// Reasons the backend refuses an examinee's request because of the session's
// state (see `refusal_body` in features/session/services.py).
const PROCTOR_HALT_CODES = ["session_paused", "session_terminated"];
const SESSION_OVER_CODES = ["session_terminated", "session_expired", "session_submitted"];

/** The server refused because a proctor paused or terminated the session. */
export function isProctorHalt(err: unknown): boolean {
  return err instanceof ApiError && PROCTOR_HALT_CODES.includes(err.code ?? "");
}

/** The server refused because the attempt is over for good (terminated, timed out, or submitted). */
export function isSessionOver(err: unknown): boolean {
  return err instanceof ApiError && SESSION_OVER_CODES.includes(err.code ?? "");
}

function statusFallback(status: number): string {
  if (status === 401) return "Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you're looking for.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "Something went wrong on our end. Please try again.";
  return "Something went wrong. Please try again.";
}

export function formatApiError(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (err instanceof ApiError) {
    const detail = err.detail();
    if (detail && detail !== "Something went wrong. Please try again.") return detail;
    return statusFallback(err.status);
  }
  if (err instanceof Error) {
    if (/^API \d{3}$/.test(err.message)) return fallback;
    return err.message || fallback;
  }
  return fallback;
}
