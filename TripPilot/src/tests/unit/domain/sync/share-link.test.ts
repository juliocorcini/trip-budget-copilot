import { describe, it, expect } from 'vitest';
import { buildShareUrl, buildSplitTableUrl, parseShareKeyFromHash } from '@/domain/sync';

const SHARE_ID = 'a3d8b216-0aeb-4a7f-84ce-44f5906fbb0f';
const KEY = 'T1pPjy8CGr5u13zEjRpFYBr2gb1sA1nd';

describe('buildShareUrl', () => {
  it('puts the id in the path and the key in the fragment', () => {
    const url = buildShareUrl('https://trippilot.pages.dev', SHARE_ID, KEY);
    expect(url).toBe(`https://trippilot.pages.dev/s/${SHARE_ID}#k=${KEY}`);
  });

  it('strips a trailing slash from the origin so there is no double slash', () => {
    const url = buildShareUrl('https://trippilot.pages.dev/', SHARE_ID, KEY);
    expect(url).toBe(`https://trippilot.pages.dev/s/${SHARE_ID}#k=${KEY}`);
  });

  it('round-trips: the key parsed from a built URL hash equals the input key', () => {
    const url = buildShareUrl('https://x.dev', SHARE_ID, KEY);
    const hash = new URL(url).hash;
    expect(parseShareKeyFromHash(hash)).toBe(KEY);
  });
});

describe('buildSplitTableUrl (G2 live table)', () => {
  it('uses the /t/ prefix (distinct from /s/) so guests land on the live board', () => {
    const url = buildSplitTableUrl('https://trippilot.pages.dev', SHARE_ID, KEY);
    expect(url).toBe(`https://trippilot.pages.dev/t/${SHARE_ID}#k=${KEY}`);
  });

  it('strips a trailing slash from the origin', () => {
    const url = buildSplitTableUrl('https://trippilot.pages.dev/', SHARE_ID, KEY);
    expect(url).toBe(`https://trippilot.pages.dev/t/${SHARE_ID}#k=${KEY}`);
  });

  it('round-trips: the key parsed from a built table URL hash equals the input key', () => {
    const url = buildSplitTableUrl('https://x.dev', SHARE_ID, KEY);
    const hash = new URL(url).hash;
    expect(parseShareKeyFromHash(hash)).toBe(KEY);
  });
});

describe('parseShareKeyFromHash', () => {
  it('reads the k= param', () => {
    expect(parseShareKeyFromHash('#k=ABC123')).toBe('ABC123');
  });

  it('tolerates a missing leading #', () => {
    expect(parseShareKeyFromHash('k=ABC123')).toBe('ABC123');
  });

  it('accepts a bare #<key> with no = (legacy form)', () => {
    expect(parseShareKeyFromHash('#ABC123')).toBe('ABC123');
  });

  it('returns null for an empty hash', () => {
    expect(parseShareKeyFromHash('')).toBeNull();
    expect(parseShareKeyFromHash('#')).toBeNull();
  });

  it('returns null when other params exist but k is absent', () => {
    expect(parseShareKeyFromHash('#foo=bar')).toBeNull();
  });
});
