/**
 * DEC-246 (AI Quick Entry): a tiny pub/sub so any surface (FAB hero, a PWA
 * shortcut, a share target) can open the global assistant sheet without prop
 * drilling. Mirrors the lightweight listener pattern used by Toast and the
 * active-outing bar — no context provider needed.
 */
type OpenListener = (prefill?: string) => void;

const listeners = new Set<OpenListener>();

/** Opens the assistant sheet, optionally seeding the input with `prefill`. */
export function openAssistant(prefill?: string): void {
  listeners.forEach((listener) => listener(prefill));
}

/** Subscribes to open requests; returns an unsubscribe function. */
export function subscribeAssistantOpen(listener: OpenListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
