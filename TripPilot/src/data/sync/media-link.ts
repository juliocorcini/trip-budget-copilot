import { getSyncWorkerUrl } from './config';
import { importSessionKey, decryptBytes } from './crypto';
import { checkFileBytes, checkImageBytes, type FileRef, type ImageRef } from '@/domain/media';
import { logger } from '@/utils/logger';

/**
 * DEC-348 (G2, this wave — REVERSES the DEC-342/343 image E2E) — the ONLY place
 * that wires the pure {@link ImageRef} model to the network for shared images.
 * Images are now **access-controlled plaintext** on R2: compress (by the caller) →
 * PUT the real `image/jpeg` bytes → the Worker serves them with the real
 * content-type, so any member or a no-app `/g/` web guest can `<img src>` /
 * download them directly. Secrecy is bounded by an **unguessable `r2Id`** (handed
 * out only inside the still-E2E share payload), a **TTL**, and **delete-on-revoke**.
 *
 * DEC-207 is unchanged: the Worker stays ciphertext-only for messages/debts/names/
 * statements — images are the single carve-out. {@link fetchDecryptedImageUrl} is
 * a back-compat shim that still decrypts LEGACY refs (those minted by 1.2.4-rc
 * that carry a per-image `key`).
 */

/** Sliding object TTL (matches the share statement's 90-day window). */
const IMG_TTL_SECONDS = 90 * 24 * 60 * 60;

function imgUrl(r2Id: string): string {
  return `${getSyncWorkerUrl()}/img/${r2Id}`;
}

/** The public, direct URL of a plaintext image (used as an `<img src>`). */
export function imageUrl(ref: ImageRef): string {
  return imgUrl(ref.r2Id);
}

export type UploadImageResult =
  | { ok: true; ref: ImageRef }
  | { ok: false; reason: 'empty' | 'too_large' | 'network' };

/**
 * DEC-348 — upload an already-compressed image as PLAINTEXT and return its
 * {@link ImageRef} (no `key`). The blob is PUT under an unguessable random id with
 * its real content-type, so the Worker serves it back directly. The plaintext cap
 * is checked first (honest early refusal). Called **on attach** (not on share) so
 * the ref persists on the expense and survives a reload (F07).
 */
export async function uploadImage(
  blob: Blob,
  dims: { width: number; height: number; mimeType: string },
): Promise<UploadImageResult> {
  const bytes = await blob.arrayBuffer();
  const cap = checkImageBytes(bytes.byteLength);
  if (!cap.ok) return { ok: false, reason: cap.reason };

  const mime = dims.mimeType || 'image/jpeg';
  const r2Id = crypto.randomUUID();
  try {
    const res = await fetch(imgUrl(r2Id), {
      method: 'PUT',
      headers: { 'Content-Type': mime, 'X-Img-TTL': String(IMG_TTL_SECONDS) },
      body: new Blob([bytes], { type: mime }),
    });
    if (!res.ok) {
      logger.warn('image_upload_rejected', { module: 'media-link', status: res.status });
      return { ok: false, reason: 'network' };
    }
  } catch (err) {
    logger.warn('image_upload_failed', { module: 'media-link' }, err);
    return { ok: false, reason: 'network' };
  }
  return { ok: true, ref: { r2Id, mime, w: dims.width, h: dims.height } };
}

/**
 * LEGACY back-compat — fetch + decrypt one E2E image (a ref that still carries a
 * per-image `key`, minted by 1.2.4-rc) to an object URL (the caller revokes it on
 * unmount). Returns null on any failure (gone/expired/bad-key/no-key) so a broken
 * image never throws into render — the gallery just skips it. New (plaintext) refs
 * never reach here: they render straight from {@link imageUrl}.
 */
export async function fetchDecryptedImageUrl(ref: ImageRef): Promise<string | null> {
  if (!ref.key) return null;
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

/* ── File attachments (PDF, docs — same R2 endpoint) ─────────────────────── */

export type UploadFileResult =
  | { ok: true; ref: FileRef }
  | { ok: false; reason: 'empty' | 'too_large' | 'network' };

/** The public, direct URL of a plaintext file (used for download links). */
export function fileUrl(ref: FileRef): string {
  return imgUrl(ref.r2Id);
}

/**
 * Upload an arbitrary file to R2 and return its {@link FileRef}. Uses the same
 * `/img/:id` endpoint as images (the Worker doesn't discriminate content-type).
 * Cap: 10 MB. Called on attach so the ref persists on the expense immediately.
 */
export async function uploadFile(
  file: File,
  description?: string,
): Promise<UploadFileResult> {
  const cap = checkFileBytes(file.size);
  if (!cap.ok) return { ok: false, reason: cap.reason };

  const mime = file.type || 'application/octet-stream';
  const r2Id = crypto.randomUUID();
  try {
    const res = await fetch(imgUrl(r2Id), {
      method: 'PUT',
      headers: { 'Content-Type': mime, 'X-Img-TTL': String(IMG_TTL_SECONDS) },
      body: file,
    });
    if (!res.ok) {
      logger.warn('file_upload_rejected', { module: 'media-link', status: res.status });
      return { ok: false, reason: 'network' };
    }
  } catch (err) {
    logger.warn('file_upload_failed', { module: 'media-link' }, err);
    return { ok: false, reason: 'network' };
  }
  return {
    ok: true,
    ref: {
      r2Id,
      mime,
      name: file.name,
      description: description || undefined,
      byteSize: file.size,
    },
  };
}

/** Best-effort delete of a shared file. */
export async function deleteSharedFile(ref: FileRef): Promise<void> {
  try {
    await fetch(imgUrl(ref.r2Id), { method: 'DELETE' });
  } catch {
    // TTL reaps orphans.
  }
}
