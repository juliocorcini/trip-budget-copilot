import { afterEach, describe, expect, it, vi } from 'vitest';
import { getShareOrigin, PUBLIC_APP_ORIGIN } from '@/utils/native/public-origin';
import { isNativeApp } from '@/utils/native/platform';

// D-BUG-01: in the Capacitor WebView `window.location.origin` is
// `https://localhost`, so share/pair links must use the canonical public origin
// instead. Mock the platform flag to exercise both branches.
vi.mock('@/utils/native/platform', () => ({
  isNativeApp: vi.fn(() => false),
}));

const mockedIsNative = vi.mocked(isNativeApp);

afterEach(() => {
  mockedIsNative.mockReset();
  mockedIsNative.mockReturnValue(false);
});

describe('getShareOrigin (D-BUG-01)', () => {
  it('uses the canonical public origin inside the native shell', () => {
    mockedIsNative.mockReturnValue(true);
    expect(getShareOrigin()).toBe(PUBLIC_APP_ORIGIN);
    expect(getShareOrigin()).not.toContain('localhost');
  });

  it('uses window.location.origin on the web/PWA', () => {
    mockedIsNative.mockReturnValue(false);
    expect(getShareOrigin()).toBe(window.location.origin);
  });

  it('the public origin is https, slash-free, and matches the App Links host', () => {
    expect(PUBLIC_APP_ORIGIN).toBe('https://trippilot.pages.dev');
    expect(PUBLIC_APP_ORIGIN.startsWith('https://')).toBe(true);
    expect(PUBLIC_APP_ORIGIN.endsWith('/')).toBe(false);
    // Must equal the host Android verifies for App Links (deep-link.ts).
    expect(new URL(PUBLIC_APP_ORIGIN).hostname).toBe('trippilot.pages.dev');
  });
});
