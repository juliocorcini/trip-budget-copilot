import { useEffect, useState } from 'react';
import { loadActiveSplitMeta, SPLIT_LIVE_CHANGED_EVENT, type ActiveSplitMeta } from './live-link';

/**
 * Read-only subscription to the owner's active live split — the "saída de bar"
 * that is still happening. Backed by the lightweight snapshot the live hook keeps
 * in localStorage, so the home card, the floating chip and the FAB all read the
 * same truth and refresh the instant it changes: in this tab (the change event),
 * across tabs (storage) and on resume (visibility). Returns null when no division
 * is live, so every consumer can early-return cleanly.
 */
export function useActiveSplit(): ActiveSplitMeta | null {
  const [meta, setMeta] = useState<ActiveSplitMeta | null>(() => loadActiveSplitMeta());

  useEffect(() => {
    const refresh = () => setMeta(loadActiveSplitMeta());
    // Re-read once on mount in case the snapshot changed between the initial
    // state and the effect attaching its listeners.
    refresh();
    window.addEventListener(SPLIT_LIVE_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener(SPLIT_LIVE_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return meta;
}
