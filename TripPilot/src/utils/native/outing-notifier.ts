import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isNativeApp } from './platform';

/**
 * N5/N6 (Gate 3): adapter for the custom `OutingNotifier` Capacitor plugin — the
 * rich fallback notification for the active outing on devices without the Android
 * 16 Live Update (SDK < 36). It renders an accent-colored ongoing notification
 * with quick-add VALUE buttons; tapping a button is handled natively (queued +
 * notification re-rendered) WITHOUT opening the app. The JS layer drains that
 * queue on resume and persists the real expenses.
 *
 * The domain stays pure: only the notification bridge (an infra boundary) talks
 * to this. No-op on the web.
 */
export interface OutingNotifierQuickAdd {
  amountCents: number;
  /** Pre-formatted button label, e.g. "+€5". */
  label: string;
}

export interface OutingNotifierState {
  title: string;
  accentColor: string;
  totalCents: number;
  /** -1 when the outing has no target. */
  targetCents: number;
  /** -1 when the profile has no average drink price. */
  avgDrinkCents: number;
  locale: string;
  /** ISO currency code (e.g. "EUR"). */
  currency: string;
  /** i18n body templates with {{total}}/{{left}}/{{over}}/{{count}} placeholders. */
  tplNoTarget: string;
  tplUnder: string;
  tplOver: string;
  tplDrinks: string;
  quickAdds: OutingNotifierQuickAdd[];
}

export interface OutingQuickAddItem {
  amountCents: number;
  ts: number;
}

interface OutingNotifierPlugin {
  show(options: OutingNotifierState): Promise<void>;
  cancel(): Promise<void>;
  drainQueue(): Promise<{ items: OutingQuickAddItem[] }>;
  /** FIELD item 10: fired natively when a quick-add button is tapped live. */
  addListener(
    eventName: 'quickAdd',
    listener: (data: { amountCents: number }) => void,
  ): Promise<PluginListenerHandle>;
}

const OutingNotifier = registerPlugin<OutingNotifierPlugin>('OutingNotifier');

/** Posts or updates the rich active-outing notification (native, SDK < 36). */
export async function showOutingNotifier(state: OutingNotifierState): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await OutingNotifier.show(state);
  } catch {
    // A notification must never break the app flow.
  }
}

/** Cancels the notification and clears its native state (outing ended). */
export async function cancelOutingNotifier(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await OutingNotifier.cancel();
  } catch {
    // nothing to cancel — ignore.
  }
}

/**
 * Returns and clears the queue of quick-add taps logged by the notification while
 * the app was backgrounded. Empty on the web or when nothing was tapped.
 */
export async function drainOutingQuickAdds(): Promise<OutingQuickAddItem[]> {
  if (!isNativeApp()) return [];
  try {
    const { items } = await OutingNotifier.drainQueue();
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

/**
 * FIELD item 10: subscribe to live quick-add taps (button pressed while the app
 * is open). The native side queues the tap regardless; this event just lets the
 * foreground app drain + refresh immediately instead of waiting for a resume.
 * No-op on the web.
 */
export async function addOutingQuickAddListener(
  onTap: () => void,
): Promise<PluginListenerHandle | null> {
  if (!isNativeApp()) return null;
  try {
    return await OutingNotifier.addListener('quickAdd', onTap);
  } catch {
    return null;
  }
}
