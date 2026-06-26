// @vitest-environment node
// SubtleCrypto is unavailable in jsdom; Node's WebCrypto (same realm) is the
// faithful stand-in for the browser implementation this module targets.
import { describe, it, expect } from 'vitest';
import {
  generateSessionKey,
  importSessionKey,
  encryptText,
  decryptText,
  encryptBytes,
  decryptBytes,
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

describe('image bytes crypto (DEC-342/343 E2E images)', () => {
  // A small, deterministic "image" — every byte value so a flipped/dropped byte
  // would surface. The boundary uploads exactly these bytes as ciphertext to R2.
  const sample = () => {
    const bytes = new Uint8Array(512);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
    return bytes;
  };

  it('round-trips raw bytes byte-for-byte through AES-GCM', async () => {
    const key = await importSessionKey(await generateSessionKey());
    const plain = sample();
    const cipher = await encryptBytes(key, plain.buffer);
    // IV (12) + tag (16) overhead, never base64 — the wire stays compact.
    expect(cipher.byteLength).toBe(plain.byteLength + 12 + 16);

    const decrypted = await decryptBytes(key, cipher);
    expect(decrypted).not.toBeNull();
    expect(new Uint8Array(decrypted!)).toEqual(plain);
  });

  it('produces a unique IV per image (same bytes, different ciphertext)', async () => {
    const key = await importSessionKey(await generateSessionKey());
    const plain = sample();
    const a = await encryptBytes(key, plain.buffer);
    const b = await encryptBytes(key, plain.buffer);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('fails closed (null) with the wrong key or corrupted ciphertext', async () => {
    const keyA = await importSessionKey(await generateSessionKey());
    const keyB = await importSessionKey(await generateSessionKey());
    const cipher = await encryptBytes(keyA, sample().buffer);
    expect(await decryptBytes(keyB, cipher)).toBeNull();
    const tampered = cipher.slice();
    const last = tampered.length - 1;
    tampered[last] = (tampered[last] ?? 0) ^ 0xff;
    expect(await decryptBytes(keyA, tampered)).toBeNull();
  });
});
