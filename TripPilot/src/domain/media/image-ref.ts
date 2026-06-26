import { z } from 'zod';

/**
 * DEC-342/343 (G5) — a reference to ONE E2E-encrypted image stored on R2. It is
 * the only thing that travels (inside an already-E2E payload: a group share, a
 * `/g/` board, a bill-split table, or a sealed mailbox envelope). The Worker
 * holds opaque ciphertext keyed by `r2Id`; the per-image AES `key` lives here, in
 * the encrypted payload, and never reaches the Worker — so the blob URL alone is
 * useless without the payload (the privacy win, mirrors the share `#fragment`).
 *
 * Pure + transport-agnostic: the boundary (`data/sync/media-link.ts`) does the
 * compress→encrypt→PUT and the GET→decrypt; this module only describes + bounds.
 */
export interface ImageRef {
  /** Opaque R2 object id (UUID) — the only address the Worker ever sees. */
  r2Id: string;
  /** Per-image AES-GCM key (base64url), carried INSIDE the E2E payload. */
  key: string;
  /** Real mime of the decrypted image (R2 only ever stores octet-stream). */
  mime: string;
  /** Pixel width of the stored image (stable layout before the blob loads). */
  w: number;
  /** Pixel height of the stored image. */
  h: number;
}

/**
 * L5 lock — the client compresses to ≤2 MB BEFORE encryption. AES-GCM adds only a
 * 12-byte IV + 16-byte tag, so the ciphertext stays under the Worker's ~2.1 MB
 * ceiling. The cap is enforced on the plaintext so the user gets an honest,
 * immediate "imagem muito grande" instead of a server round-trip.
 */
export const IMAGE_MAX_PLAINTEXT_BYTES = 2_000_000;
/** The Worker's hard per-object ceiling (plaintext cap + AES-GCM overhead). */
export const IMAGE_MAX_CIPHERTEXT_BYTES = 2_100_000;

export type ImageCapVerdict = { ok: true } | { ok: false; reason: 'empty' | 'too_large' };

/**
 * Pure cap decision the client runs before encrypt+upload — mirrors the Worker
 * guard (empty → 400, oversize → 413) so the UI can refuse early with a clear
 * reason. Defaults to the plaintext cap; the boundary re-checks the ciphertext
 * against {@link IMAGE_MAX_CIPHERTEXT_BYTES}.
 */
export function checkImageBytes(
  byteLength: number,
  maxBytes: number = IMAGE_MAX_PLAINTEXT_BYTES,
): ImageCapVerdict {
  if (!Number.isFinite(byteLength) || byteLength <= 0) return { ok: false, reason: 'empty' };
  if (byteLength > maxBytes) return { ok: false, reason: 'too_large' };
  return { ok: true };
}

/** Zod schema mirroring {@link ImageRef}, for the share-payload / claim schemas. */
export const imageRefSchema = z.object({
  r2Id: z.string(),
  key: z.string(),
  mime: z.string(),
  w: z.number(),
  h: z.number(),
});
