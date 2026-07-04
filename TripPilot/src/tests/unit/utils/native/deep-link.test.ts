import { describe, expect, it } from 'vitest';
import { parseDeepLink } from '@/utils/native/deep-link';

// B2 (Onda 4 / DEC-215): the App Link parser is pure. The native listener and
// router wiring are exercised on device (the gate AC). These tests lock the
// behaviour that matters most: which URLs are owned, and that the #fragment
// (where the /s/:id key and the /pair identity live) survives.
describe('parseDeepLink (B2 App Links)', () => {
  it('routes /pair preserving the identity fragment', () => {
    expect(parseDeepLink('https://trippilot.pages.dev/pair#id=abc123')).toBe('/pair#id=abc123');
  });

  it('routes /s/:id preserving the end-to-end key in the fragment', () => {
    expect(parseDeepLink('https://trippilot.pages.dev/s/trip_42#k=secretKey')).toBe(
      '/s/trip_42#k=secretKey',
    );
  });

  it('preserves both query string and fragment', () => {
    expect(parseDeepLink('https://trippilot.pages.dev/s/x?foo=1#k=y')).toBe('/s/x?foo=1#k=y');
  });

  it('matches the bare /pair path with no fragment', () => {
    expect(parseDeepLink('https://trippilot.pages.dev/pair')).toBe('/pair');
  });

  it('routes /quick-add (DEC-459 widget "+" and QS tile)', () => {
    expect(parseDeepLink('https://trippilot.pages.dev/quick-add')).toBe('/quick-add');
  });

  it('ignores unrelated paths on the app host', () => {
    expect(parseDeepLink('https://trippilot.pages.dev/dashboard')).toBeNull();
    expect(parseDeepLink('https://trippilot.pages.dev/')).toBeNull();
  });

  it('ignores other hosts even on a known path', () => {
    expect(parseDeepLink('https://evil.example.com/pair#id=abc')).toBeNull();
  });

  it('ignores non-https schemes (http, custom, content)', () => {
    expect(parseDeepLink('http://trippilot.pages.dev/pair')).toBeNull();
    expect(parseDeepLink('content://trippilot.pages.dev/s/x')).toBeNull();
  });

  it('returns null for empty or malformed input', () => {
    expect(parseDeepLink('')).toBeNull();
    expect(parseDeepLink(null)).toBeNull();
    expect(parseDeepLink(undefined)).toBeNull();
    expect(parseDeepLink('not a url')).toBeNull();
  });

  it('does not let a lookalike prefix host through (/pairing is owned by /pair prefix, but only on our host)', () => {
    // `/pair` is a prefix match, so `/pairing` is intentionally owned too — it
    // still resolves inside the SPA. What must NOT pass is a foreign host.
    expect(parseDeepLink('https://trippilot.pages.dev/pairing')).toBe('/pairing');
    expect(parseDeepLink('https://attacker.test/pairing')).toBeNull();
  });
});
