/** Parse backend error payloads into a user-facing message. */

function formatFieldErrors(details: Record<string, unknown>): string {
  if (typeof details.detail === "string") return details.detail;

  const parts: string[] = [];
  for (const [key, val] of Object.entries(details)) {
    if (key === "detail") continue;
    if (Array.isArray(val)) parts.push(`${key}: ${val.map(String).join(", ")}`);
    else if (typeof val === "string") parts.push(`${key}: ${val}`);
    else if (val && typeof val === "object") {
      parts.push(`${key}: ${JSON.stringify(val)}`);
    }
  }
  return parts.join("; ");
}

export function extractApiErrorMessage(payload: unknown): string {
  if (payload == null) return "Request failed";
  if (typeof payload === "string") return payload.trim() || "Request failed";
  if (typeof payload !== "object") return String(payload);

  const body = payload as Record<string, unknown>;

  if (body.error && typeof body.error === "object") {
    const err = body.error as Record<string, unknown>;
    if (typeof err.message === "string" && err.message) return err.message;

    const details = err.details;
    if (typeof details === "string" && details) return details;
    if (details && typeof details === "object") {
      const formatted = formatFieldErrors(details as Record<string, unknown>);
      if (formatted) return formatted;
    }
  }

  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) return body.detail.map(String).join("; ");
  if (typeof body.error === "string") return body.error;
  if (typeof body.message === "string") return body.message;

  try {
    return JSON.stringify(payload);
  } catch {
    return "Request failed";
  }
}
