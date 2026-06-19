import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSplitTableLink,
  saveOwnerLive,
  loadOwnerLive,
  clearOwnerLive,
  type SplitLiveCreds,
} from '@/features/split/live-link';
import { PUBLIC_APP_ORIGIN } from '@/utils/native/public-origin';
import { isNativeApp } from '@/utils/native/platform';

// D-BUG-01 regression: the live-table link must NOT embed `https://localhost`
// (the Capacitor WebView origin). It has to use the canonical public origin on
// native, exactly like the `/s/:id` + `/pair` links.
vi.mock('@/utils/native/platform', () => ({
  isNativeApp: vi.fn(() => false),
}));

const mockedIsNative = vi.mocked(isNativeApp);

const creds: SplitLiveCreds = {
  shareId: 'abc-123',
  key: 'k3y',
  writeToken: 'tok',
  revision: 1,
};

afterEach(() => {
  mockedIsNative.mockReset();
  mockedIsNative.mockReturnValue(false);
});

describe('buildSplitTableLink (D-BUG-01)', () => {
  it('uses the canonical public origin inside the native shell (never localhost)', () => {
    mockedIsNative.mockReturnValue(true);
    const link = buildSplitTableLink(creds);
    expect(link).not.toContain('localhost');
    expect(link.startsWith(`${PUBLIC_APP_ORIGIN}/t/`)).toBe(true);
    expect(link).toContain('abc-123');
    expect(link).toContain('#k=k3y');
  });

  it('uses the real origin on the web/PWA', () => {
    mockedIsNative.mockReturnValue(false);
    const link = buildSplitTableLink(creds);
    expect(link.startsWith(`${window.location.origin}/t/`)).toBe(true);
  });
});

// L2.M5 — the owner's live creds must survive an app reopen so we resume the
// SAME link instead of stranding guests on a dead URL.
describe('owner live-table persistence (L2.M5)', () => {
  beforeEach(() => clearOwnerLive());
  afterEach(() => clearOwnerLive());

  it('round-trips the credentials through storage', () => {
    expect(loadOwnerLive()).toBeNull();
    saveOwnerLive(creds);
    expect(loadOwnerLive()).toEqual(creds);
  });

  it('keeps only the latest table (a new save overwrites the old one)', () => {
    saveOwnerLive(creds);
    const next: SplitLiveCreds = { ...creds, shareId: 'def-456', revision: 7 };
    saveOwnerLive(next);
    expect(loadOwnerLive()).toEqual(next);
  });

  it('clears on stop/commit so a finished bill never resurrects', () => {
    saveOwnerLive(creds);
    clearOwnerLive();
    expect(loadOwnerLive()).toBeNull();
  });

  it('returns null for a malformed / partial record', () => {
    localStorage.setItem('split.owner.live', JSON.stringify({ shareId: 'x' }));
    expect(loadOwnerLive()).toBeNull();
    localStorage.setItem('split.owner.live', 'not json');
    expect(loadOwnerLive()).toBeNull();
  });
});
