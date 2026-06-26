import { getSyncWorkerUrl } from './config';
import { generateSessionKey, importSessionKey, encryptBytes, decryptBytes } from './crypto';
import {
  checkImageBytes,
  IMAGE_MAX_CIPHERTEXT_BYTES,
  type ImageRef,
} from '@/domain/media';

/**
 * DEC-342/343 (G5) — the ONLY place that wires the pure {@link ImageRef} model to
 * the network + WebCrypto for shared images. It mirrors the share-channel
 * boundary (`group-link.ts`): the domain and React layers never touch transport.
 *
 * Each image gets a FRESH AES-GCM key (compromising one image ≠ the others); the
 * key is returned inside the `ImageRef` so it rides the already-E2E payload and
 * never reaches the Worker. The Worker stores only `application/octet-stream`
 * ciphertext under an opaque `r2Id`, with a TTL — so a leaked blob URL is useless
 * without the payload that carries its key.
 */

/** Sliding object TTL (matches the share statement's 90-day window). */
const IMG_TTL_SECONDS = 90 * 24 * 60 * 60;

function imgUrl(r2Id: string): string {
  return `${getSyncWorkerUrl()}/img/${r2Id}`;
}

export type UploadImageResult =
  | { ok: true; ref: ImageRef }
  | { ok: false; reason: 'empty' | 'too_large' | 'network' };

/**
 * Compress-agnostic upload: encrypt an already-compressed image blob with a fresh
 * per-image key and PUT the ciphertext to R2. Returns the `ImageRef` to store in
 * the (encrypted) payload. The plaintext cap is checked first (honest early
 * refusal), then the ciphertext against the Worker's hard ceiling.
 */
export async function uploadEncryptedImage(
  blob: Blob,
  dims: { width: number; height: number; mimeType: string },
): Promise<UploadImageResult> {
  const plain = await blob.arrayBuffer();
  const capPlain = checkImageBytes(plain.byteLength);
  if (!capPlain.ok) return { ok: false, reason: capPlain.reason };

  const key = await generateSessionKey();
  const cryptoKey = await importSessionKey(key);
  const cipher = await encryptBytes(cryptoKey, plain);
  if (cipher.byteLength > IMAGE_MAX_CIPHERTEXT_BYTES) return { ok: false, reason: 'too_large' };

  const r2Id = crypto.randomUUID();
  try {
    const res = await fetch(imgUrl(r2Id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Img-TTL': String(IMG_TTL_SECONDS) },
      // Wrap in a Blob so the body is a stable BodyInit (a typed-array view isn't).
      body: new Blob([cipher], { type: 'application/octet-stream' }),
    });
    if (!res.ok) return { ok: false, reason: 'network' };
  } catch {
    return { ok: false, reason: 'network' };
  }
  return { ok: true, ref: { r2Id, key, mime: dims.mimeType, w: dims.width, h: dims.height } };
}

/**
 * Lazy fetch + decrypt one image to an object URL (the caller revokes it when the
 * element unmounts). Returns null on any failure (gone/expired/bad-key) so a
 * broken image never throws into the render path — the gallery just skips it.
 */
export async function fetchDecryptedImageUrl(ref: ImageRef): Promise<string | null> {
  try {
    const res = await fetch(imgUrl(ref.r2Id));
    if (!res.ok) return null;
    const cipher = new Uint8Array(await res.arrayBuffer());
    const cryptoKey = await importSessionKey(ref.key);
    const plain = await decryptBytes(cryptoKey, cipher);
    if (!plain) return null;
    return URL.createObjectURL(new Blob([plain], { type: ref.mime || 'image/jpeg' }));
  } catch {
    return null;
  }
}

/** Best-effort delete of a shared image (on share-revoke or photo removal). */
export async function deleteSharedImage(ref: ImageRef): Promise<void> {
  try {
    await fetch(imgUrl(ref.r2Id), { method: 'DELETE' });
  } catch {
    // Best-effort: a transient failure leaves an orphan the TTL eventually reaps.
  }
}
