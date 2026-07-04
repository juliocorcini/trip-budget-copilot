/**
 * DEC-445/446 — worker-side share preview + slug helpers.
 *
 * The preview is a plaintext SUMMARY blob the client publishes NEXT TO the E2E
 * ciphertext so crawlers can render a link card. This module is the physical
 * enforcement of Â-PREVIEW-SUMMARY-ONLY: `sanitizeSharePreview` re-builds the
 * object from an ALLOWLIST (anything else — items, names per item, write
 * tokens — cannot survive into storage even if a client sends it) and
 * rejects anything over 1 KB.
 *
 * DEC-455: the AES key may now be ESCROWED here (stored in the extras record,
 * returned only by `GET /share/:id`) so outgoing links can drop the `#k=`
 * fragment. It still never enters the preview blob (`sanitizeSharePreview`
 * has no key field), so `/preview/:idOrSlug` and OG cards can never leak it.
 */

export const SHARE_PREVIEW_MAX_BYTES = 1024;
const TITLE_MAX = 80;
const DESCRIPTION_MAX = 200;

/** Client-proposed slug base: `a-z0-9-`, sane bounds (≤40 like the client cap). */
export const SLUG_BASE_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** A full slug (base + `-` + suffix). Bounded so KV keys stay tiny.
 * Upper bound fits a max base (40) + `-` + the DEC-455 6-char suffix. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,46}$/;
/** Canonical share ids are UUIDs (minted by `crypto.randomUUID()`). */
export const CANONICAL_SHARE_ID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Unambiguous, includes non-hex letters (a slug can never look like a raw id). */
const SLUG_SUFFIX_ALPHABET = '23456789abcdefghjkmnpqrstvwxyz';
/**
 * DEC-455: with the key escrowed server-side, the slug is the FULL read
 * capability — 6 chars over a 30-symbol alphabet (~7×10⁸ combos per base)
 * instead of the previous 4, so slugs stay short but non-enumerable.
 */
const SLUG_SUFFIX_LENGTH = 6;

/**
 * DEC-455: escrowed AES key shape — base64url session keys (32 bytes → 43
 * chars). Bounds are generous so future key sizes fit; never logged.
 */
export const LINK_KEY_RE = /^[A-Za-z0-9_-]{16,128}$/;

const IMG_ID_RE = /^[0-9a-fA-F-]{8,64}$/;
const PREVIEW_KINDS = new Set(['group', 'split', 'statement', 'expense']);

export interface WorkerSharePreview {
  v: 1;
  kind: 'group' | 'split' | 'statement' | 'expense';
  title: string;
  description: string;
  totalCents: number;
  currency: string;
  peopleCount: number;
  updatedAt: number;
  imgId?: string;
}

/**
 * Validate + re-build a client-supplied preview from the allowlist. Returns
 * null when the shape is wrong or the canonical serialization exceeds 1 KB —
 * callers then simply skip storing a preview (never fail the share write).
 */
export function sanitizeSharePreview(raw: unknown): WorkerSharePreview | null {
  if (raw === null || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (p.v !== 1) return null;
  if (typeof p.kind !== 'string' || !PREVIEW_KINDS.has(p.kind)) return null;
  if (typeof p.title !== 'string' || p.title.length === 0) return null;
  if (typeof p.description !== 'string') return null;
  if (typeof p.totalCents !== 'number' || !Number.isInteger(p.totalCents)) return null;
  if (typeof p.currency !== 'string' || p.currency.length === 0 || p.currency.length > 8) return null;
  if (typeof p.peopleCount !== 'number' || !Number.isInteger(p.peopleCount) || p.peopleCount < 0) {
    return null;
  }
  if (typeof p.updatedAt !== 'number' || !Number.isFinite(p.updatedAt)) return null;
  const imgId = typeof p.imgId === 'string' && IMG_ID_RE.test(p.imgId) ? p.imgId : undefined;

  const preview: WorkerSharePreview = {
    v: 1,
    kind: p.kind as WorkerSharePreview['kind'],
    title: p.title.slice(0, TITLE_MAX),
    description: p.description.slice(0, DESCRIPTION_MAX),
    totalCents: p.totalCents,
    currency: p.currency,
    peopleCount: p.peopleCount,
    updatedAt: p.updatedAt,
    ...(imgId ? { imgId } : {}),
  };
  if (new TextEncoder().encode(JSON.stringify(preview)).length > SHARE_PREVIEW_MAX_BYTES) {
    return null;
  }
  return preview;
}

/** Random human-safe slug suffix (never all-hex → never id-shaped). */
export function randomSlugSuffix(): string {
  const bytes = new Uint8Array(SLUG_SUFFIX_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += SLUG_SUFFIX_ALPHABET[b % SLUG_SUFFIX_ALPHABET.length];
  return out;
}

export function composeSlug(base: string, suffix: string): string {
  return `${base}-${suffix}`;
}
