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

describe('imageRefSchema (payload carry)', () => {
  // DEC-348 — a PLAINTEXT ref (no key) is the new default; a legacy E2E ref still
  // carries `key` and must keep parsing for back-compat.
  const plaintextRef: ImageRef = {
    r2Id: '2b9d2f10-0d8e-4f7a-9c3a-7c1d2e3f4a5b',
    mime: 'image/jpeg',
    w: 1600,
    h: 1200,
  };
  const legacyRef: ImageRef = { ...plaintextRef, key: 'a'.repeat(43) };

  it('parses a plaintext ImageRef (no key — DEC-348)', () => {
    expect(imageRefSchema.parse(plaintextRef)).toEqual(plaintextRef);
  });

  it('still parses a legacy E2E ref that carries the per-image key', () => {
    expect(imageRefSchema.parse(legacyRef)).toEqual(legacyRef);
  });

  it('rejects non-numeric dimensions', () => {
    expect(imageRefSchema.safeParse({ ...plaintextRef, w: '1600' }).success).toBe(false);
  });
});
