import { describe, it, expect } from 'vitest';
import {
  sanitizeSharePreview,
  randomSlugSuffix,
  composeSlug,
  SLUG_BASE_RE,
  SLUG_RE,
  CANONICAL_SHARE_ID_RE,
  SHARE_PREVIEW_MAX_BYTES,
  LINK_KEY_RE,
} from '../../../../worker/src/share-preview';
import { routeTemplate } from '../../../../worker/src/logger';

/**
 * DEC-445/446 — the worker half of Â-PREVIEW-SUMMARY-ONLY: the preview is
 * REBUILT from an allowlist (so keys/tokens/items physically cannot reach
 * storage) and slugs can never collide with the raw-id address space
 * (Â-OLD-LINKS-LIVE keeps every old link resolving as before).
 */

const validPreview = {
  v: 1,
  kind: 'group',
  title: 'Churras do Bruno',
  description: 'Total € 302,00 · 5 pessoas',
  totalCents: 30200,
  currency: 'EUR',
  peopleCount: 5,
  updatedAt: 1_700_000_000_000,
};

describe('sanitizeSharePreview', () => {
  it('accepts a valid summary blob', () => {
    expect(sanitizeSharePreview(validPreview)).toEqual(validPreview);
  });

  it('REBUILDS from the allowlist — key/writeToken/items never survive', () => {
    const out = sanitizeSharePreview({
      ...validPreview,
      key: 'aes-key',
      writeToken: 'secret',
      items: [{ name: 'Bruno', amountCents: 1 }],
      participants: ['Bruno', 'Débora'],
    });
    expect(out).not.toBeNull();
    expect(Object.keys(out!).sort()).toEqual([
      'currency',
      'description',
      'kind',
      'peopleCount',
      'title',
      'totalCents',
      'updatedAt',
      'v',
    ]);
    expect(JSON.stringify(out)).not.toContain('secret');
  });

  it('rejects wrong version, kind, shapes and oversized blobs', () => {
    expect(sanitizeSharePreview(null)).toBeNull();
    expect(sanitizeSharePreview('x')).toBeNull();
    expect(sanitizeSharePreview({ ...validPreview, v: 2 })).toBeNull();
    expect(sanitizeSharePreview({ ...validPreview, kind: 'everything' })).toBeNull();
    expect(sanitizeSharePreview({ ...validPreview, totalCents: 1.5 })).toBeNull();
    expect(sanitizeSharePreview({ ...validPreview, peopleCount: -1 })).toBeNull();
    expect(sanitizeSharePreview({ ...validPreview, title: '' })).toBeNull();
    // 3-bytes-per-char text at every clamp + max-width numbers + an image id
    // fits the CHAR clamps but busts the 1 KB BYTE cap → rejected whole.
    expect(
      sanitizeSharePreview({
        ...validPreview,
        title: '€'.repeat(80),
        description: '€'.repeat(200),
        currency: '€€€€€€€€',
        totalCents: -9007199254740991,
        peopleCount: 2147483647,
        updatedAt: 1_700_000_000_000,
        imgId: 'f'.repeat(64),
      }),
    ).toBeNull();
  });

  it('DEC-457 — accepts the expense kind (a shared single expense)', () => {
    const out = sanitizeSharePreview({ ...validPreview, kind: 'expense', peopleCount: 0 });
    expect(out).not.toBeNull();
    expect(out!.kind).toBe('expense');
  });

  it('clamps title/description length and validates the image id', () => {
    const out = sanitizeSharePreview({
      ...validPreview,
      title: 'x'.repeat(300),
      description: 'y'.repeat(500),
      imgId: 'zzz not an id',
    });
    expect(out!.title.length).toBe(80);
    expect(out!.description.length).toBe(200);
    expect(out!.imgId).toBeUndefined();
    const withImg = sanitizeSharePreview({
      ...validPreview,
      imgId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(withImg!.imgId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('keeps every accepted blob under the 1 KB cap', () => {
    const out = sanitizeSharePreview(validPreview);
    expect(new TextEncoder().encode(JSON.stringify(out)).length).toBeLessThanOrEqual(
      SHARE_PREVIEW_MAX_BYTES,
    );
  });
});

describe('slug address space (Â-OLD-LINKS-LIVE)', () => {
  it('DEC-455 — suffix is 6 chars (slug = full capability now) and never all-hex', () => {
    for (let i = 0; i < 50; i++) {
      const suffix = randomSlugSuffix();
      expect(suffix).toMatch(/^[23456789abcdefghjkmnpqrstvwxyz]{6}$/);
    }
  });

  it('composed slugs pass SLUG_RE and raw UUIDs pass CANONICAL_SHARE_ID_RE', () => {
    const slug = composeSlug('churras-do-bruno', 'x7f2mp');
    expect(slug).toBe('churras-do-bruno-x7f2mp');
    expect(SLUG_RE.test(slug)).toBe(true);
    expect(CANONICAL_SHARE_ID_RE.test(slug)).toBe(false);
    const uuid = '9f2c1c4e-77aa-4bfb-8a3e-52a1c1a2b3c4';
    expect(CANONICAL_SHARE_ID_RE.test(uuid)).toBe(true);
    expect(SLUG_BASE_RE.test('churras-do-bruno')).toBe(true);
    expect(SLUG_BASE_RE.test('Not A Slug!')).toBe(false);
  });
});

describe('LINK_KEY_RE (DEC-455 escrowed key shape)', () => {
  it('accepts base64url session keys and rejects junk', () => {
    // generateSessionKey → base64url of 32 bytes → 43 chars.
    expect(LINK_KEY_RE.test('T1pPjy8CGr5u13zEjRpFYBr2gb1sA1ndKcW3vNq8Mf0')).toBe(true);
    expect(LINK_KEY_RE.test('short')).toBe(false);
    expect(LINK_KEY_RE.test('has spaces in it definitely not a key')).toBe(false);
    expect(LINK_KEY_RE.test('a'.repeat(200))).toBe(false);
  });
});

describe('routeTemplate (Â-WORKER-GUARDS-KEPT)', () => {
  it('collapses the new /preview route so slugs never reach a log', () => {
    expect(routeTemplate('/preview/churras-do-bruno-x7f2')).toBe('/preview/:id');
    expect(routeTemplate('/preview/9f2c1c4e-77aa-4bfb-8a3e-52a1c1a2b3c4')).toBe('/preview/:id');
  });
});
