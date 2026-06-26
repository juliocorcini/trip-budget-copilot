import { describe, it, expect } from 'vitest';
import {
  checkImageBytes,
  imageRefSchema,
  IMAGE_MAX_PLAINTEXT_BYTES,
  IMAGE_MAX_CIPHERTEXT_BYTES,
  type ImageRef,
} from '@/domain/media';

describe('checkImageBytes (DEC-342/343 L5 cap)', () => {
  it('accepts a normal compressed photo under the plaintext cap', () => {
    expect(checkImageBytes(450_000)).toEqual({ ok: true });
    expect(checkImageBytes(IMAGE_MAX_PLAINTEXT_BYTES)).toEqual({ ok: true });
  });

  it('rejects an empty/zero/invalid byte length as "empty"', () => {
    expect(checkImageBytes(0)).toEqual({ ok: false, reason: 'empty' });
    expect(checkImageBytes(-10)).toEqual({ ok: false, reason: 'empty' });
    expect(checkImageBytes(Number.NaN)).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects anything over the cap as "too_large" (honest early refusal)', () => {
    expect(checkImageBytes(IMAGE_MAX_PLAINTEXT_BYTES + 1)).toEqual({ ok: false, reason: 'too_large' });
  });

  it('re-checks the ciphertext against the worker ceiling when asked', () => {
    // The boundary passes the ciphertext cap explicitly after encryption.
    expect(checkImageBytes(IMAGE_MAX_CIPHERTEXT_BYTES, IMAGE_MAX_CIPHERTEXT_BYTES)).toEqual({ ok: true });
    expect(checkImageBytes(IMAGE_MAX_CIPHERTEXT_BYTES + 1, IMAGE_MAX_CIPHERTEXT_BYTES)).toEqual({
      ok: false,
      reason: 'too_large',
    });
  });

  it('keeps the ciphertext ceiling above the plaintext cap (AES-GCM headroom)', () => {
    expect(IMAGE_MAX_CIPHERTEXT_BYTES).toBeGreaterThan(IMAGE_MAX_PLAINTEXT_BYTES);
  });
});

describe('imageRefSchema (E2E payload carry)', () => {
  const validRef: ImageRef = {
    r2Id: '2b9d2f10-0d8e-4f7a-9c3a-7c1d2e3f4a5b',
    key: 'a'.repeat(43),
    mime: 'image/jpeg',
    w: 1600,
    h: 1200,
  };

  it('parses a well-formed ImageRef', () => {
    expect(imageRefSchema.parse(validRef)).toEqual(validRef);
  });

  it('rejects a ref missing the per-image key', () => {
    const { key: _omit, ...noKey } = validRef;
    expect(imageRefSchema.safeParse(noKey).success).toBe(false);
  });

  it('rejects non-numeric dimensions', () => {
    expect(imageRefSchema.safeParse({ ...validRef, w: '1600' }).success).toBe(false);
  });
});
