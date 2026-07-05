/** Parse backend error payloads into a user-facing message. */

const FALLBACK = "Something went wrong. Please try again.";

/** Known API field names → labels shown to users. */
const FIELD_LABELS: Record<string, string> = {
  non_field_errors: "",
  detail: "",
  username: "Username",
  password: "Password",
  password2: "Confirm password",
  email: "Email",
  first_name: "First name",
  last_name: "Last name",
  avatar: "Profile photo",
  exam: "Exam",
  session: "Session",
  session_id: "Session",
  question: "Question",
  question_id: "Question",
  question_ids: "Questions",
  question_text: "Question text",
  answer_text: "Answer",
  responses: "Responses",
  time_remaining: "Time remaining",
  time_spent: "Time spent",
  role: "Role",
  status: "Status",
  title: "Title",
  description: "Description",
  duration_minutes: "Duration",
  start_time: "Start time",
  end_time: "End time",
  csv: "CSV file",
  image: "Image",
};

function humanizeFieldName(key: string): string {
  if (Object.prototype.hasOwnProperty.call(FIELD_LABELS, key)) {
    return FIELD_LABELS[key];
  }
  // Skip pure numeric keys (array indices from DRF list errors).
  if (/^\d+$/.test(key)) return "";

  return key
    .replace(/_/g, " ")
    .replace(/\bid\b/gi, "ID")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function ensureSentence(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "";
  if (/[.!?]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

function withFieldLabel(fieldKey: string | undefined, message: string): string {
  const label = fieldKey ? humanizeFieldName(fieldKey) : "";
  if (!label) return message;

  // Avoid "Username: Username is already taken." style duplication.
  const lowerMsg = message.toLowerCase();
  const lowerLabel = label.toLowerCase();
  if (lowerMsg.startsWith(lowerLabel)) return message;

  return `${label}: ${message}`;
}

/** Recursively collect human-readable messages from DRF-style error trees. */
function collectMessages(value: unknown, fieldKey?: string): string[] {
  if (value == null) return [];

  if (typeof value === "string") {
    const msg = value.trim();
    if (!msg) return [];
    return [withFieldLabel(fieldKey, msg)];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [withFieldLabel(fieldKey, String(value))];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectMessages(item, fieldKey));
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
      collectMessages(nested, key)
    );
  }

  return [];
}

function joinMessages(messages: string[]): string {
  const unique = [...new Set(messages.map((m) => m.trim()).filter(Boolean))];
  if (unique.length === 0) return "";
  return unique.map(ensureSentence).join(" ");
}

function formatFieldErrors(details: unknown): string {
  return joinMessages(collectMessages(details));
}

function looksLikeHtml(text: string): boolean {
  const start = text.slice(0, 32).toLowerCase();
  return start.startsWith("<!doctype") || start.startsWith("<html") || start.startsWith("<");
}

export function extractApiErrorMessage(payload: unknown): string {
  if (payload == null) return FALLBACK;

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) return FALLBACK;
    if (looksLikeHtml(trimmed)) return FALLBACK;

    // Some proxies/gateways return JSON as a plain string body.
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return extractApiErrorMessage(JSON.parse(trimmed));
      } catch {
        /* keep as plain text */
      }
    }
    return ensureSentence(trimmed);
  }

  if (typeof payload !== "object") return ensureSentence(String(payload));

  const body = payload as Record<string, unknown>;

  // Structured Knowing Eye envelope: { success, error: { message, details, code } }
  if (body.error && typeof body.error === "object") {
    const err = body.error as Record<string, unknown>;

    if (typeof err.message === "string" && err.message.trim()) {
      return ensureSentence(err.message);
    }

    const details = err.details;
    if (details != null) {
      const formatted = formatFieldErrors(details);
      if (formatted) return formatted;
    }

    // Recognized envelope but no usable message — don't scrape meta fields.
    return FALLBACK;
  }

  // Legacy / alternate shapes
  if (typeof body.detail === "string" && body.detail.trim()) {
    return ensureSentence(body.detail);
  }
  if (Array.isArray(body.detail)) {
    const formatted = joinMessages(body.detail.map(String));
    if (formatted) return formatted;
  }
  if (typeof body.error === "string" && body.error.trim()) {
    return ensureSentence(body.error);
  }
  if (typeof body.message === "string" && body.message.trim()) {
    return ensureSentence(body.message);
  }

  // Flat DRF validation map: { username: ["…"], password: ["…"] }
  const flat = formatFieldErrors(body);
  if (flat) return flat;

  return FALLBACK;
}
