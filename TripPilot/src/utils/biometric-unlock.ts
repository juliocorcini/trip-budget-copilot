// B6 (DEC-213): biometric unlock as a CONVENIENCE layer over the app-lock PIN.
// On web/PWA this is a WebAuthn platform authenticator (Touch ID / Windows Hello
// / Android fingerprint) used purely as a local user-verification gate — there is
// no server, so we never verify the assertion signature. The PIN remains the real
// secret and the ALWAYS-available fallback (ÂNCORA 12: biometrics can never trap
// the user — a missing/failed credential simply falls back to the PIN). This is a
// boundary over `navigator.credentials`; the lock UI calls these functions only.

const CHALLENGE_BYTES = 32;
const USER_ID_BYTES = 16;
const CEREMONY_TIMEOUT_MS = 60_000;

/** URL-safe base64 of raw bytes (no padding) — how we persist a credential id. */
export function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Inverse of {@link base64UrlFromBytes}. Tolerates missing padding. */
export function bytesFromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Pure gate predicate: biometric unlock is "ready" only when the PIN lock is on,
 * the user opted into biometrics, AND a credential was registered. Anything else
 * means the lock screen falls back to the PIN (never trapped). Kept pure so the
 * UI and tests share one rule, mirroring `isValidPin`.
 */
export function isBiometricUnlockReady(input: {
  appLockEnabled: boolean;
  biometricEnabled: boolean;
  credentialId: string | null;
}): boolean {
  return input.appLockEnabled && input.biometricEnabled && input.credentialId !== null;
}

/**
 * True only when this device exposes a user-verifying PLATFORM authenticator
 * (built-in biometrics). Never throws — an unsupported browser resolves false so
 * the UI simply keeps the PIN.
 */
export async function isBiometricSupported(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    const PK = window.PublicKeyCredential;
    if (!PK || typeof PK.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
      return false;
    }
    return await PK.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Registers a platform credential bound to this device, returning its id
 * (base64url) to persist. Returns null when the user cancels or the ceremony
 * fails — the caller then keeps biometrics off and the PIN unchanged.
 */
export async function registerBiometricCredential(): Promise<string | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.credentials?.create) return null;
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(CHALLENGE_BYTES)),
        // rp.id is intentionally omitted so the browser uses the current
        // effective domain — correct for both the deployed PWA and localhost.
        rp: { name: 'TripPilot' },
        user: {
          id: crypto.getRandomValues(new Uint8Array(USER_ID_BYTES)),
          name: 'tripilot-local',
          displayName: 'TripPilot',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: CEREMONY_TIMEOUT_MS,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;
    if (!credential) return null;
    return base64UrlFromBytes(new Uint8Array(credential.rawId));
  } catch {
    return null;
  }
}

/**
 * Runs the platform user-verification ceremony for a stored credential id. True
 * means the OS verified the user (biometric/device PIN) for THIS device's
 * credential. Never throws — cancel/failure resolves false and the UI keeps the
 * PIN available.
 */
export async function verifyBiometricCredential(credentialId: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.credentials?.get) return false;
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(CHALLENGE_BYTES)),
        allowCredentials: [
          // Same BufferSource cast used across the crypto boundary (app-lock.ts):
          // a Uint8Array<ArrayBufferLike> is not structurally a BufferSource<ArrayBuffer>.
          {
            type: 'public-key',
            id: bytesFromBase64Url(credentialId) as BufferSource,
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: CEREMONY_TIMEOUT_MS,
      },
    });
    return assertion !== null;
  } catch {
    return false;
  }
}
