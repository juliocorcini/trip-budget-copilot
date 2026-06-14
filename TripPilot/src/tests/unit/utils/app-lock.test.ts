import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin, isValidPin } from '@/utils/app-lock';

// E6 (M20): the PIN must NEVER be stored in clear — only a PBKDF2 hash + salt.
describe('app lock PIN hashing (E6 M20)', () => {
  it('accepts 4–8 digit PINs only', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('12345678')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('123456789')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin('')).toBe(false);
  });

  it('returns hex salt+hash and never embeds the PIN in clear', async () => {
    const { saltHex, hashHex } = await hashPin('4827');
    expect(saltHex).toMatch(/^[0-9a-f]+$/);
    expect(hashHex).toMatch(/^[0-9a-f]+$/);
    expect(hashHex).not.toContain('4827');
    expect(hashHex.length).toBe(64); // 256 derived bits → 32 bytes
    expect(saltHex.length).toBe(32); // 16-byte salt
  });

  it('verifies the correct PIN and rejects a wrong one', async () => {
    const { saltHex, hashHex } = await hashPin('4827');
    expect(await verifyPin('4827', saltHex, hashHex)).toBe(true);
    expect(await verifyPin('0000', saltHex, hashHex)).toBe(false);
  });

  it('salts each PIN so identical PINs hash differently, yet reproduce on re-derive', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234');
    expect(b.saltHex).not.toBe(a.saltHex);
    expect(b.hashHex).not.toBe(a.hashHex);
    // Re-deriving with the same salt reproduces the hash (the verify path).
    const reproduced = await hashPin('1234', a.saltHex);
    expect(reproduced.saltHex).toBe(a.saltHex);
    expect(reproduced.hashHex).toBe(a.hashHex);
  });

  it('returns false (never throws) on malformed stored values', async () => {
    expect(await verifyPin('1234', 'zz', 'not-hex')).toBe(false);
  });
});
