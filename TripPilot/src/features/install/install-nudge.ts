/**
 * Item A (DEC-362) — the dismissible install nudge gate. Pure + fully
 * injectable so the "not annoying" cap is unit-tested without a browser.
 *
 * Rule (Julio): show a gentle banner to web users who are NOT installed; when
 * they dismiss it, stay quiet for 7 days; "don't show again" silences it for
 * good. Never shown inside the native app or an already-installed PWA.
 */
import { isStandaloneDisplayMode } from '@/utils/platform';
import { isNativeApp } from '@/utils/native/platform';
import { installAudience } from '@/features/install/install-content';

const STORAGE_KEY = 'tp.install.nudge';
export const NUDGE_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

interface NudgeState {
  /** Epoch ms of the last "agora não" dismissal. */
  dismissedAt?: number;
  /** True once the user picked "não mostrar de novo". */
  never?: boolean;
}

function readState(storage: Storage): NudgeState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return {};
    const candidate = parsed as Record<string, unknown>;
    const state: NudgeState = {};
    if (typeof candidate.dismissedAt === 'number') state.dismissedAt = candidate.dismissedAt;
    if (candidate.never === true) state.never = true;
    return state;
  } catch {
    return {};
  }
}

export interface NudgeContext {
  now?: number;
  storage?: Storage;
  standalone?: boolean;
  native?: boolean;
  /** Override for testing — when 'android', the nudge defers to ApkBanner. */
  audience?: ReturnType<typeof installAudience>;
}

/** Whether the install nudge banner should be shown right now. */
export function shouldShowInstallNudge(ctx: NudgeContext = {}): boolean {
  const standalone = ctx.standalone ?? isStandaloneDisplayMode();
  const native = ctx.native ?? isNativeApp();
  if (standalone || native) return false;
  const aud = ctx.audience ?? installAudience();
  if (aud === 'android') return false;
  const storage = ctx.storage ?? localStorage;
  const state = readState(storage);
  if (state.never) return false;
  if (state.dismissedAt !== undefined) {
    const now = ctx.now ?? Date.now();
    if (now - state.dismissedAt < NUDGE_SNOOZE_MS) return false;
  }
  return true;
}

/** Snooze the nudge for 7 days, or silence it forever when `forever` is true. */
export function dismissInstallNudge(
  forever = false,
  ctx: Pick<NudgeContext, 'now' | 'storage'> = {},
): void {
  const storage = ctx.storage ?? localStorage;
  const state: NudgeState = forever ? { never: true } : { dismissedAt: ctx.now ?? Date.now() };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private mode / quota) — the banner simply reappears.
  }
}
