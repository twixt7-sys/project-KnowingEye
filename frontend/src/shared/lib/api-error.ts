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
