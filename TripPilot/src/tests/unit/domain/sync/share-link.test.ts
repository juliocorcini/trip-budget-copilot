import { describe, it, expect } from 'vitest';
import {
  buildShareUrl,
  buildSplitTableUrl,
  buildGroupSplitUrl,
  buildExpenseShareUrl,
  parseShareKeyFromHash,
} from '@/domain/sync';

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

describe('?v= crawler cache-bust (DEC-454)', () => {
  it('revision 1 (or absent) keeps the first link lean — no query at all', () => {
    expect(buildGroupSplitUrl('https://x.dev', 'jantar-abc12', KEY)).toBe(
      `https://x.dev/g/jantar-abc12#k=${KEY}`,
    );
    expect(buildGroupSplitUrl('https://x.dev', 'jantar-abc12', KEY, 1)).toBe(
      `https://x.dev/g/jantar-abc12#k=${KEY}`,
    );
  });

  it('revision ≥ 2 rides as ?v= BEFORE the fragment (query never carries the key)', () => {
    const url = buildGroupSplitUrl('https://x.dev', 'jantar-abc12', KEY, 3);
    expect(url).toBe(`https://x.dev/g/jantar-abc12?v=3#k=${KEY}`);
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/g/jantar-abc12');
    expect(parsed.searchParams.get('v')).toBe('3');
    expect(parsed.search.includes(KEY)).toBe(false);
    expect(parseShareKeyFromHash(parsed.hash)).toBe(KEY);
  });

  it('applies to /s/ and /t/ links the same way', () => {
    expect(buildShareUrl('https://x.dev', SHARE_ID, KEY, 5)).toBe(
      `https://x.dev/s/${SHARE_ID}?v=5#k=${KEY}`,
    );
    expect(buildSplitTableUrl('https://x.dev', SHARE_ID, KEY, 2)).toBe(
      `https://x.dev/t/${SHARE_ID}?v=2#k=${KEY}`,
    );
  });
});

describe('DEC-455 — fragment-less short links (key: null)', () => {
  it('a null key omits the #k= fragment entirely, on every prefix', () => {
    expect(buildShareUrl('https://x.dev', 'ana-x7k2mp', null)).toBe('https://x.dev/s/ana-x7k2mp');
    expect(buildSplitTableUrl('https://x.dev', 'jantar-x7k2mp', null)).toBe(
      'https://x.dev/t/jantar-x7k2mp',
    );
    expect(buildGroupSplitUrl('https://x.dev', 'praia-x7k2mp', null)).toBe(
      'https://x.dev/g/praia-x7k2mp',
    );
  });

  it('keyless link + revision ≥ 2 still busts the crawler cache with ?v=', () => {
    const url = buildGroupSplitUrl('https://x.dev', 'praia-x7k2mp', null, 3);
    expect(url).toBe('https://x.dev/g/praia-x7k2mp?v=3');
    expect(new URL(url).hash).toBe('');
  });

  it('a present key keeps the legacy fragment (old links unchanged)', () => {
    expect(buildShareUrl('https://x.dev', SHARE_ID, KEY)).toContain(`#k=${KEY}`);
  });
});

describe('DEC-457 — /x/ shared expense link', () => {
  it('uses the /x/ prefix and supports both keyed and keyless forms', () => {
    expect(buildExpenseShareUrl('https://x.dev', 'jantar-x7k2mp', null)).toBe(
      'https://x.dev/x/jantar-x7k2mp',
    );
    expect(buildExpenseShareUrl('https://x.dev', SHARE_ID, KEY, 2)).toBe(
      `https://x.dev/x/${SHARE_ID}?v=2#k=${KEY}`,
    );
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
