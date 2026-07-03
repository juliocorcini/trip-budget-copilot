import { describe, it, expect } from 'vitest';
import {
  slugifyShareName,
  buildSharePreview,
  SHARE_PREVIEW_MAX_BYTES,
  type BuildSharePreviewInput,
} from '@/domain/sync/share-preview';

/**
 * DEC-445/446 — pure preview + slug domain. The negative test (no key /
 * writeToken can ride in a preview) is the client half of
 * Â-PREVIEW-SUMMARY-ONLY; the worker enforces the same allowlist server-side.
 */

describe('slugifyShareName', () => {
  it('lowercases, strips accents and swaps separators for hyphens', () => {
    expect(slugifyShareName('Churras do Bruno')).toBe('churras-do-bruno');
    expect(slugifyShareName('Férias — São Paulo & Cia.')).toBe('ferias-sao-paulo-cia');
    expect(slugifyShareName('  Trip   2026!!  ')).toBe('trip-2026');
  });

  it('caps at 40 chars without a trailing hyphen', () => {
    const slug = slugifyShareName('a'.repeat(39) + ' brasil');
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('returns empty when nothing survives (caller falls back to a kind word)', () => {
    expect(slugifyShareName('日本語だけ')).toBe('');
    expect(slugifyShareName('!!!')).toBe('');
    expect(slugifyShareName('')).toBe('');
  });
});

describe('buildSharePreview', () => {
  const base: BuildSharePreviewInput = {
    kind: 'group',
    title: 'Churras do Bruno',
    description: 'Total € 302,00 · 5 pessoas',
    totalCents: 30200,
    currency: 'EUR',
    peopleCount: 5,
    now: 1_700_000_000_000,
  };

  it('carries exactly the allowlisted summary fields', () => {
    const preview = buildSharePreview(base);
    expect(preview).toEqual({
      v: 1,
      kind: 'group',
      title: 'Churras do Bruno',
      description: 'Total € 302,00 · 5 pessoas',
      totalCents: 30200,
      currency: 'EUR',
      peopleCount: 5,
      updatedAt: 1_700_000_000_000,
    });
  });

  it('NEVER lets a key/writeToken/items field survive into the preview (Â-PREVIEW-SUMMARY-ONLY)', () => {
    const malicious = {
      ...base,
      key: 'aes-key-base64url',
      writeToken: 'secret-token',
      items: [{ name: 'Bruno', amountCents: 999 }],
    } as unknown as BuildSharePreviewInput;
    const preview = buildSharePreview(malicious);
    expect(Object.keys(preview).sort()).toEqual([
      'currency',
      'description',
      'kind',
      'peopleCount',
      'title',
      'totalCents',
      'updatedAt',
      'v',
    ]);
    expect(JSON.stringify(preview)).not.toContain('aes-key');
    expect(JSON.stringify(preview)).not.toContain('secret-token');
  });

  it('clamps title/description and drops an invalid image id', () => {
    const preview = buildSharePreview({
      ...base,
      title: 'x'.repeat(200),
      description: 'y'.repeat(500),
      imgId: 'not a valid id!!',
    });
    expect(preview.title.length).toBe(80);
    expect(preview.description.length).toBe(200);
    expect(preview.imgId).toBeUndefined();
  });

  it('keeps a valid R2 image id', () => {
    const preview = buildSharePreview({ ...base, imgId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(preview.imgId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('stays under the 1 KB byte cap even with emoji-heavy text', () => {
    const preview = buildSharePreview({
      ...base,
      title: '🍖'.repeat(80),
      description: '🎉'.repeat(200),
    });
    const bytes = new TextEncoder().encode(JSON.stringify(preview)).length;
    expect(bytes).toBeLessThanOrEqual(SHARE_PREVIEW_MAX_BYTES);
  });

  it('normalizes non-finite numbers instead of propagating them', () => {
    const preview = buildSharePreview({
      ...base,
      totalCents: Number.NaN,
      peopleCount: -3,
    });
    expect(preview.totalCents).toBe(0);
    expect(preview.peopleCount).toBe(0);
  });
});
