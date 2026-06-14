// E6 (M20): app-lock PIN hashing. The PIN is NEVER stored in clear — we keep a
// PBKDF2-SHA256 hash plus a random per-PIN salt (both hex). This is a boundary
// over Web Crypto (crypto.subtle); the lock UI calls hashPin/verifyPin only.

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const DERIVED_BITS = 256;

export interface PinHash {
  saltHex: string;
  hashHex: string;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  const length = Math.floor(hex.length / 2);
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Constant-time-ish hex comparison (avoids early-exit on the first mismatch). */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function derive(pin: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    // The TS DOM lib types `salt` as BufferSource over a plain ArrayBuffer; a
    // Uint8Array<ArrayBufferLike> needs the same cast used in sync/crypto.ts.
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    DERIVED_BITS,
  );
  return bytesToHex(new Uint8Array(bits));
}

/** Hashes a PIN with a fresh random salt (or a provided one, for verification). */
export async function hashPin(pin: string, saltHex?: string): Promise<PinHash> {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hashHex = await derive(pin, salt);
  return { saltHex: saltHex ?? bytesToHex(salt), hashHex };
}

/** True when `pin` matches the stored salt+hash. Never throws. */
export async function verifyPin(pin: string, saltHex: string, hashHex: string): Promise<boolean> {
  try {
    const candidate = await derive(pin, hexToBytes(saltHex));
    return timingSafeEqualHex(candidate, hashHex);
  } catch {
    return false;
  }
}

/** PIN policy: 4–8 digits. Pure so the UI and tests share one rule. */
export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}
