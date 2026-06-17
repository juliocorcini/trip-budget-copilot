import { describe, it, expect } from 'vitest';
import {
  base64UrlFromBytes,
  bytesFromBase64Url,
  isBiometricUnlockReady,
} from '@/utils/biometric-unlock';

describe('biometric-unlock base64url codec', () => {
  it('round-trips arbitrary bytes (including padding edge lengths)', () => {
    const cases = [
      new Uint8Array([]),
      new Uint8Array([0]),
      new Uint8Array([255]),
      new Uint8Array([1, 2]),
      new Uint8Array([1, 2, 3]),
      new Uint8Array([0, 127, 128, 255, 16, 32, 64]),
      crypto.getRandomValues(new Uint8Array(32)),
    ];
    for (const bytes of cases) {
      const encoded = base64UrlFromBytes(bytes);
      expect(bytesFromBase64Url(encoded)).toEqual(bytes);
    }
  });

  it('emits URL-safe alphabet without padding', () => {
    // 0xFB 0xFF -> standard base64 "+/8=" which must become "-_8" (url-safe, no =).
    const encoded = base64UrlFromBytes(new Uint8Array([0xfb, 0xff]));
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
    expect(encoded).toBe('-_8');
  });

  it('decodes tolerantly when padding is missing', () => {
    // "TWE" decodes "Ma" (2 bytes) even though canonical base64 would be "TWE=".
    expect(bytesFromBase64Url('TWE')).toEqual(new Uint8Array([0x4d, 0x61]));
  });
});

describe('isBiometricUnlockReady (ÂNCORA 12 gate)', () => {
  it('is ready only with lock on, opt-in on, and a stored credential', () => {
    expect(
      isBiometricUnlockReady({ appLockEnabled: true, biometricEnabled: true, credentialId: 'abc' }),
    ).toBe(true);
  });

  it('is never ready without the PIN lock, even if a credential lingers', () => {
    expect(
      isBiometricUnlockReady({ appLockEnabled: false, biometricEnabled: true, credentialId: 'abc' }),
    ).toBe(false);
  });

  it('is not ready when the user has not opted in', () => {
    expect(
      isBiometricUnlockReady({ appLockEnabled: true, biometricEnabled: false, credentialId: 'abc' }),
    ).toBe(false);
  });

  it('is not ready when no credential was registered (post-restore device)', () => {
    expect(
      isBiometricUnlockReady({ appLockEnabled: true, biometricEnabled: true, credentialId: null }),
    ).toBe(false);
  });
});
