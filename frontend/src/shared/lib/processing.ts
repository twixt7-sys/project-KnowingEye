import { useSyncExternalStore } from "react";

/**
 * Tiny store tracking user-initiated work that is still in flight, so one
 * overlay (see ProcessingOverlay) can tell the user the system is busy and
 * keep them from clicking around until it finishes.
 *
 * Background traffic - monitoring frames, autosave, heartbeats, polling - must
 * never register here: it would lock the exam screen mid-attempt.
 */

export const DEFAULT_PROCESSING_LABEL = "Processing…";

type Task = { id: number; label: string };

let tasks: Task[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Mark work as started. Call the returned function once it has finished or failed. */
export function beginProcessing(label: string = DEFAULT_PROCESSING_LABEL): () => void {
  const id = nextId++;
  tasks = [...tasks, { id, label }];
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    tasks = tasks.filter((task) => task.id !== id);
    emit();
  };
}

/**
 * Run `work` while the busy overlay is up. The overlay always comes down
 * afterwards, whether `work` resolves or throws.
 */
export async function withProcessing<T>(
  label: string,
  work: () => Promise<T>,
): Promise<T> {
  const done = beginProcessing(label);
  try {
    return await work();
  } finally {
    done();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return tasks;
}

/** The label of the most recent in-flight task, or null when nothing is running. */
export function useProcessingLabel(): string | null {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return current.length > 0 ? current[current.length - 1].label : null;
}
