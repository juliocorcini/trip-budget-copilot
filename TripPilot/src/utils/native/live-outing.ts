import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './platform';

/**
 * B1/B2 (Gate 4): adapter for the custom `LiveOuting` Capacitor plugin (Android
 * 16 Live Update / Samsung Now Bar). The active-outing notification bridge calls
 * this; on the Web — and on Android < 16 (`isSupported()` returns false) — it is
 * a no-op and the existing LocalNotifications path owns the notification.
 *
 * The domain stays pure: it never imports this. Only the notification bridge
 * (an infra boundary) translates the active-outing state into these calls.
 */
interface LiveOutingPlugin {
  isSupported(): Promise<{ supported: boolean }>;
  update(options: {
    title: string;
    body: string;
    statusText: string;
    progress: number;
    max: number;
    accentColor: string;
  }): Promise<void>;
  end(): Promise<void>;
}

const LiveOuting = registerPlugin<LiveOutingPlugin>('LiveOuting');

const DEFAULT_ACCENT = '#C75B39';
let supportedCache: boolean | null = null;

export async function isLiveOutingSupported(): Promise<boolean> {
  if (!isNativeApp()) return false;
  if (supportedCache !== null) return supportedCache;
  try {
    const { supported } = await LiveOuting.isSupported();
    supportedCache = supported;
  } catch {
    supportedCache = false;
  }
  return supportedCache;
}

function readAccentColor(): string {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    return value || DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export interface LiveOutingState {
  /** Outing name — the notification's contentTitle. */
  title: string;
  /** Rich line ("Total: €42 · €8 to target"). */
  body: string;
  /** Short status-bar chip text ("€42"). */
  statusText: string;
  /** Spend so far (cents) → the progress value. */
  totalCents: number;
  /** Outing target (cents) → the progress max; null → standard (no bar). */
  targetCents: number | null;
}

/** Posts or updates the Live Update for the active outing (Android 16+ only). */
export async function syncLiveOuting(state: LiveOutingState): Promise<void> {
  if (!(await isLiveOutingSupported())) return;
  try {
    await LiveOuting.update({
      title: state.title,
      body: state.body,
      statusText: state.statusText,
      progress: state.totalCents,
      max: state.targetCents && state.targetCents > 0 ? state.targetCents : 0,
      accentColor: readAccentColor(),
    });
  } catch {
    // A Live Update must never break the app flow.
  }
}

/** Cancels the Live Update when the outing ends. */
export async function endLiveOuting(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await LiveOuting.end();
  } catch {
    // nothing to cancel — ignore.
  }
}
