import { describe, it, expect } from 'vitest';
import {
  shouldShowInstallNudge,
  dismissInstallNudge,
  NUDGE_SNOOZE_MS,
} from '@/features/install/install-nudge';

function memStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => {
      map.delete(k);
    },
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
  } as Storage;
}

const WEB = { native: false, standalone: false } as const;

describe('shouldShowInstallNudge (Item A, DEC-362)', () => {
  it('never shows inside the native app or an installed PWA', () => {
    expect(shouldShowInstallNudge({ native: true, standalone: false, storage: memStorage() })).toBe(false);
    expect(shouldShowInstallNudge({ native: false, standalone: true, storage: memStorage() })).toBe(false);
  });

  it('shows for a fresh, non-installed web user', () => {
    expect(shouldShowInstallNudge({ ...WEB, storage: memStorage() })).toBe(true);
  });

  it('stays hidden through the 7-day snooze, then returns', () => {
    const storage = memStorage();
    const base = 1_700_000_000_000;
    dismissInstallNudge(false, { now: base, storage });
    expect(shouldShowInstallNudge({ ...WEB, now: base + 1000, storage })).toBe(false);
    expect(shouldShowInstallNudge({ ...WEB, now: base + NUDGE_SNOOZE_MS - 1, storage })).toBe(false);
    expect(shouldShowInstallNudge({ ...WEB, now: base + NUDGE_SNOOZE_MS + 1, storage })).toBe(true);
  });

  it('"don\'t show again" silences it permanently', () => {
    const storage = memStorage();
    dismissInstallNudge(true, { storage });
    expect(
      shouldShowInstallNudge({ ...WEB, now: Date.now() + 10 * NUDGE_SNOOZE_MS, storage }),
    ).toBe(false);
  });

  it('fails open (shows) when the stored payload is corrupt', () => {
    const storage = memStorage({ 'tp.install.nudge': '{not valid json' });
    expect(shouldShowInstallNudge({ ...WEB, storage })).toBe(true);
  });

  it('never shows on Android — ApkBanner takes priority (DEC-499)', () => {
    expect(
      shouldShowInstallNudge({ ...WEB, storage: memStorage(), audience: 'android' }),
    ).toBe(false);
  });

  it('shows on iOS when not installed (DEC-499)', () => {
    expect(
      shouldShowInstallNudge({ ...WEB, storage: memStorage(), audience: 'ios' }),
    ).toBe(true);
  });

  it('shows on desktop when not installed (DEC-499)', () => {
    expect(
      shouldShowInstallNudge({ ...WEB, storage: memStorage(), audience: 'desktop' }),
    ).toBe(true);
  });
});
