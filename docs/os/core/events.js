// Tiny pub/sub event bus. No project-specific logic - portable across projects.
export function createEventBus() {
  const listeners = new Map();

  function on(type, handler) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(handler);
    return () => off(type, handler);
  }

  function off(type, handler) {
    const set = listeners.get(type);
    if (set) set.delete(handler);
  }

  function emit(type, payload) {
    const set = listeners.get(type);
    if (set) {
      for (const handler of [...set]) {
        try {
          handler(payload);
        } catch (err) {
          console.warn(`[events] handler for "${type}" threw`, err);
        }
      }
    }
  }

  return { on, off, emit };
}
