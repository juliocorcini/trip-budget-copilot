import { z } from 'zod';

/**
 * DEC-348 (G2, this wave — REVERSES DEC-342/343 for images): a reference to ONE
 * shared image stored on R2 as **access-controlled plaintext**. The `r2Id` is an
 * unguessable random id that doubles as the read capability; it travels inside the
 * already-E2E payload (a group share, a `/g/` board, a bill-split table, a sealed
 * mailbox envelope) so the URL is not guessable/indexed, and a TTL + delete-on-
 * revoke bound exposure. The Worker serves the **real content-type** so a member
 * or a no-app `/g/` web guest can `<img src>`/long-press-download it directly.
 *
 * `key` is **legacy-only**: refs minted by the old E2E path (1.2.4-rc) still carry
 * the per-image AES key, and the read boundary decrypts those for back-compat. New
 * refs omit it (plaintext). DEC-207 still holds — messages/debts/names/statements
 * stay ciphertext-only; images are the single carve-out.
 *
 * Pure + transport-agnostic: the boundary (`data/sync/media-link.ts`) does the
 * compress→PUT (plaintext) and builds the direct URL; this module only describes.
 */
export interface ImageRef {
  /** Opaque, unguessable R2 object id (UUID) — also the read capability. */
  r2Id: string;
  /**
   * LEGACY ONLY — the per-image AES-GCM key (base64url) of an E2E ref minted by
   * the old image path. Present ⇒ the read boundary fetches + decrypts; absent ⇒
   * the blob is plaintext and served directly (DEC-348). New refs never set it.
   */
  key?: string;
  /** Real mime of the image (R2 now stores + serves it verbatim). */
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

/** Zod schema mirroring {@link ImageRef}, for the share-payload / claim schemas.
 *  `key` is optional (DEC-348): new refs are plaintext; legacy refs still carry it. */
export const imageRefSchema = z.object({
  r2Id: z.string(),
  key: z.string().optional(),
  mime: z.string(),
  w: z.number(),
  h: z.number(),
});
