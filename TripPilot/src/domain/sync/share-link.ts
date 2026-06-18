/**
 * DEC-207 (Shared Participant Link): pure helpers for the link URL.
 *
 * The link is `${origin}/s/${shareId}#k=${aesKey}`. The path holds the public
 * share id (the worker's address for the ciphertext); the AES key lives ONLY in
 * the URL fragment, which browsers never send to the server — so the worker
 * stores opaque ciphertext it can never read. Anyone with the full link can
 * read the statement; that is the intended capability model (the link IS the
 * secret), exactly like a one-tap "anyone with the link" share.
 */

export const SHARE_PATH_PREFIX = '/s/';
/**
 * Bill-split live table (G2). A SEPARATE prefix from `/s/` so the guest lands on
 * the live claim board (`SplitTablePage`) — a different surface from the
 * persistent statement mirror (`SharedLinkPage`). Same capability model: the
 * AES key lives only in the fragment, so the worker stores opaque ciphertext.
 */
export const SPLIT_TABLE_PATH_PREFIX = '/t/';
const KEY_PARAM = 'k';

export function buildShareUrl(origin: string, shareId: string, key: string): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}${SHARE_PATH_PREFIX}${encodeURIComponent(shareId)}#${KEY_PARAM}=${key}`;
}

export function buildSplitTableUrl(origin: string, shareId: string, key: string): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}${SPLIT_TABLE_PATH_PREFIX}${encodeURIComponent(shareId)}#${KEY_PARAM}=${key}`;
}

/**
 * Extracts the AES key from a location hash (`#k=...`). Tolerates a leading
 * `#`, an absent key, and a bare `#<key>` (legacy). Returns null when empty so
 * callers can show "broken link" instead of attempting to decrypt with junk.
 */
export function parseShareKeyFromHash(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw.length === 0) return null;
  const params = new URLSearchParams(raw);
  const fromParam = params.get(KEY_PARAM);
  if (fromParam && fromParam.length > 0) return fromParam;
  // Bare `#<key>` with no `=` is treated as the key itself.
  if (!raw.includes('=')) return raw;
  return null;
}
