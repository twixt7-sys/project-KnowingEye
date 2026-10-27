/**
 * What kinds of data a write changed, so every screen showing that data can
 * refresh at once.
 *
 * Changes come from two places: this tab's own successful API writes (see
 * `changesForRequest`, called by the API client) and the server's
 * `/ws/updates/` socket, which reports writes made anywhere else - another
 * tab, another user, a background job. Both go through `publishDataChanges`;
 * `core/sync` turns them into React Query invalidations.
 */

/** Mirrors `core.realtime.events.Topic` on the backend. */
export type DataTopic = "exams" | "reference" | "sessions" | "alerts" | "users" | "me";

export type DataChange = {
  topic: DataTopic;
  /** The exam the change belongs to, when it is about one exam. */
  examId?: number | null;
};

export type DataChangeSource = "local" | "remote";

type Listener = (changes: DataChange[], source: DataChangeSource) => void;

const listeners = new Set<Listener>();

export function subscribeDataChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishDataChanges(changes: DataChange[], source: DataChangeSource): void {
  if (!changes.length) return;
  for (const listener of listeners) {
    try {
      listener(changes, source);
    } catch {
      // A broken subscriber must never fail the write that triggered it.
    }
  }
}

// Writes that change nothing another screen shows: sign-in, the exam
// screen's background traffic (timer heartbeat, answer autosave, integrity
// events, proctoring frames) and an option image that is only stored once
// its question is saved.
const SILENT_WRITES: RegExp[] = [
  /^\/auth\/token\//,
  /^\/auth\/register\//,
  /^\/auth\/profile\/verify-email\/request\//,
  /^\/auth\/profile\/change-password\//,
  /^\/sessions\/[^/]+\/(heartbeat|responses|log-event)\//,
  /^\/monitoring\//,
  /^\/exams\/\d+\/option-image\//,
];

const EXAM_PATH = /^\/exams\/(\d+)\//;

/**
 * The data a successful non-GET request to `endpoint` changed.
 * `body` is inspected only to spot dry runs, which change nothing.
 */
export function changesForRequest(
  method: string,
  endpoint: string,
  body?: BodyInit | null,
): DataChange[] {
  if (method.toUpperCase() === "GET") return [];
  const path = endpoint.split("?")[0];
  if (SILENT_WRITES.some((pattern) => pattern.test(path))) return [];
  if (typeof body === "string" && /"dry_run"\s*:\s*true/.test(body)) return [];

  if (path.startsWith("/auth/profile/")) return [{ topic: "me" }, { topic: "users" }];
  if (path.startsWith("/auth/users/")) return [{ topic: "users" }];
  if (path.startsWith("/departments/") || path.startsWith("/categories/")) {
    return [{ topic: "reference" }];
  }
  if (path.startsWith("/exams/")) {
    const match = EXAM_PATH.exec(path);
    return [{ topic: "exams", examId: match ? Number(match[1]) : null }];
  }
  if (path.startsWith("/sessions/") || path.startsWith("/responses/")) {
    return [{ topic: "sessions" }];
  }
  if (path.startsWith("/behavior/")) return [{ topic: "alerts" }];
  return [];
}
