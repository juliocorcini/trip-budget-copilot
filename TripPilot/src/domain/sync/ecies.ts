import { bytesToBase64Url, base64UrlToBytes } from './encoding';

/**
 * FIELD item 8: ECIES sealing for the async mailbox. Each device owns a static
 * ECDH P-256 keypair. To send, we generate an EPHEMERAL keypair, ECDH it against
 * the recipient's static public key, run HKDF-SHA256 to derive an AES-256-GCM
 * key, and emit `ephemeralPublicKey || iv || ciphertext`. Only the holder of the
 * recipient's private key can re-derive the AES key and open it — the worker
 * only ever stores the opaque blob.
 *
 * Pure module: it touches WebCrypto only, never the database, so the seal/open
 * round-trip is unit-testable in isolation.
 */

const EC_PARAMS: EcKeyImportParams & EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' };
const HKDF_INFO = new TextEncoder().encode('trippilot-mailbox-v1');
/** Uncompressed P-256 point: 0x04 || X(32) || Y(32). */
const RAW_PUBLIC_KEY_LEN = 65;
const IV_LEN = 12;

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('webcrypto_unavailable');
  return subtle;
}

export interface IdentityKeyPairJwk {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

/** Generates a fresh, EXTRACTABLE device keypair (extractable so the private key
 * can be serialized into the encrypted backup — restoring keeps the pairing). */
export async function generateIdentityKeyPair(): Promise<IdentityKeyPairJwk> {
  const subtle = getSubtle();
  const pair = await subtle.generateKey(EC_PARAMS, true, ['deriveBits']);
  const [publicKeyJwk, privateKeyJwk] = await Promise.all([
    subtle.exportKey('jwk', pair.publicKey),
    subtle.exportKey('jwk', pair.privateKey),
  ]);
  return { publicKeyJwk, privateKeyJwk };
}

/** The public key as base64url raw bytes — the compact form shared in the QR. */
export async function publicKeyJwkToRawB64(publicKeyJwk: JsonWebKey): Promise<string> {
  const subtle = getSubtle();
  const key = await subtle.importKey('jwk', publicKeyJwk, EC_PARAMS, true, []);
  const raw = await subtle.exportKey('raw', key);
  return bytesToBase64Url(new Uint8Array(raw));
}

async function deriveAesKey(
  privateKey: CryptoKey,
  peerPublicRaw: Uint8Array,
  usage: KeyUsage,
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const peerPublic = await subtle.importKey('raw', toArrayBuffer(peerPublicRaw), EC_PARAMS, false, []);
  const sharedBits = await subtle.deriveBits({ name: 'ECDH', public: peerPublic }, privateKey, 256);
  const hkdfKey = await subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: HKDF_INFO },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  );
}

/** Seals `plaintext` for the recipient's public key. Output is base64url. */
export async function seal(recipientPublicKeyB64: string, plaintext: string): Promise<string> {
  const subtle = getSubtle();
  const recipientRaw = base64UrlToBytes(recipientPublicKeyB64);
  const ephemeral = await subtle.generateKey(EC_PARAMS, true, ['deriveBits']);
  const ephemeralPublicRaw = new Uint8Array(await subtle.exportKey('raw', ephemeral.publicKey));
  const aesKey = await deriveAesKey(ephemeral.privateKey, recipientRaw, 'encrypt');
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LEN));
  const ciphertext = new Uint8Array(
    await subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(plaintext)),
  );
  const out = new Uint8Array(ephemeralPublicRaw.length + IV_LEN + ciphertext.length);
  out.set(ephemeralPublicRaw, 0);
  out.set(iv, ephemeralPublicRaw.length);
  out.set(ciphertext, ephemeralPublicRaw.length + IV_LEN);
  return bytesToBase64Url(out);
}

/**
 * Opens a sealed blob with this device's private key. Returns null when the blob
 * is malformed, tampered, or addressed to a different device (wrong key) — the
 * caller treats every failure the same way: silently skip it.
 */
export async function open(privateKeyJwk: JsonWebKey, sealedB64: string): Promise<string | null> {
  try {
    const subtle = getSubtle();
    const privateKey = await subtle.importKey('jwk', privateKeyJwk, EC_PARAMS, true, ['deriveBits']);
    const bytes = base64UrlToBytes(sealedB64);
    if (bytes.length <= RAW_PUBLIC_KEY_LEN + IV_LEN) return null;
    const ephemeralPublicRaw = bytes.subarray(0, RAW_PUBLIC_KEY_LEN);
    const iv = bytes.subarray(RAW_PUBLIC_KEY_LEN, RAW_PUBLIC_KEY_LEN + IV_LEN);
    const ciphertext = bytes.subarray(RAW_PUBLIC_KEY_LEN + IV_LEN);
    const aesKey = await deriveAesKey(privateKey, ephemeralPublicRaw, 'decrypt');
    const plaintext = await subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      aesKey,
      toArrayBuffer(ciphertext),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}

/** Copies a (possibly subarray) view into a standalone ArrayBuffer — WebCrypto
 * rejects views whose byteOffset is non-zero on some engines. */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.slice().buffer;
}
