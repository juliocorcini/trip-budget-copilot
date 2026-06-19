import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSplitTableLink, type SplitLiveCreds } from '@/features/split/live-link';
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
