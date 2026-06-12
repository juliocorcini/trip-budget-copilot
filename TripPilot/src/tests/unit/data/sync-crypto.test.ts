// @vitest-environment node
// SubtleCrypto is unavailable in jsdom; Node's WebCrypto (same realm) is the
// faithful stand-in for the browser implementation this module targets.
import { describe, it, expect } from 'vitest';
import {
  generateSessionKey,
  importSessionKey,
  encryptText,
  decryptText,
} from '@/data/sync/crypto';

describe('sync session crypto (DEC-103 E2E)', () => {
  it('round-trips text through AES-GCM with a QR-portable key', async () => {
    const encodedKey = await generateSessionKey();
    expect(encodedKey).toMatch(/^[A-Za-z0-9_-]+$/);

    const key = await importSessionKey(encodedKey);
    const cipher = await encryptText(key, 'hello debora — €12,34');
    expect(await decryptText(key, cipher)).toBe('hello debora — €12,34');
  });

  it('produces a unique IV per message (same plaintext, different ciphertext)', async () => {
    const key = await importSessionKey(await generateSessionKey());
    const a = await encryptText(key, 'same message');
    const b = await encryptText(key, 'same message');
    expect(a).not.toBe(b);
  });

  it('fails closed with the wrong key or corrupted ciphertext', async () => {
    const keyA = await importSessionKey(await generateSessionKey());
    const keyB = await importSessionKey(await generateSessionKey());
    const cipher = await encryptText(keyA, 'secret');
    expect(await decryptText(keyB, cipher)).toBeNull();
    expect(await decryptText(keyA, cipher.slice(0, -4) + 'AAAA')).toBeNull();
    expect(await decryptText(keyA, '!!!')).toBeNull();
  });
});
