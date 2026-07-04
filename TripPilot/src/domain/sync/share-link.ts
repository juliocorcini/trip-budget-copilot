/**
 * DEC-207 (Shared Participant Link): pure helpers for the link URL.
 *
 * Original model: `${origin}/s/${shareId}#k=${aesKey}` — the AES key lives in
 * the URL fragment (never sent to the server), so the worker stores opaque
 * ciphertext. Anyone with the full link can read the statement; the link IS
 * the secret, exactly like a one-tap "anyone with the link" share.
 *
 * DEC-455 (Julio's verdict, 2026-07-03): outgoing links must be SHORT and
 * genuinely shareable — the `#k=` tail made them ugly and long. New shares
 * escrow the AES key on the worker (stored next to the preview), so the
 * outgoing URL is just `${origin}/s/${slug}`; the guest app resolves the key
 * from the server when the fragment is absent. Passing `key: null` to a
 * builder omits the fragment. Old fragment links keep working forever
 * (Â-OLD-LINKS-LIVE) — the fragment, when present, always wins.
 */

export const SHARE_PATH_PREFIX = '/s/';
/**
 * Bill-split live table (G2). A SEPARATE prefix from `/s/` so the guest lands on
 * the live claim board (`SplitTablePage`) — a different surface from the
 * persistent statement mirror (`SharedLinkPage`).
 */
export const SPLIT_TABLE_PATH_PREFIX = '/t/';
/**
 * C23 (Tricount group split, DEC-297). A SEPARATE prefix from `/t/` so a guest
 * lands on the group claim board (`GroupClaimPage`) — many expenses/payers, pick
 * your name, see your balance, mark paid.
 */
export const GROUP_SPLIT_PATH_PREFIX = '/g/';
/**
 * DEC-457 — a single shared EXPENSE (photo + details), read-only. The guest
 * lands on `ExpenseSharePage`; same channel/capability model as the others.
 */
export const EXPENSE_SHARE_PATH_PREFIX = '/x/';
const KEY_PARAM = 'k';

/**
 * DEC-454 (field fix 2026-07-03): WhatsApp/Facebook cache the link card PER
 * URL STRING — a share pasted before its photo existed keeps showing the old
 * card forever, even though the worker preview was republished with the imgId.
 * Appending `?v=<revision>` (only from revision 2 on, keeping first links
 * lean) makes an updated share a NEW url to crawlers → fresh scrape, photo
 * shows. The SPA router, the Pages Function and the worker all address shares
 * by PATH, so the param is inert everywhere else; old unversioned links keep
 * working forever (Â-OLD-LINKS-LIVE). The key stays in the fragment.
 */
function versionQuery(version?: number): string {
  return version !== undefined && version >= 2 ? `?v=${Math.floor(version)}` : '';
}

/** DEC-455 — `key: null` (server-held) omits the fragment entirely. */
function keyFragment(key: string | null): string {
  return key ? `#${KEY_PARAM}=${key}` : '';
}

function buildLink(
  origin: string,
  prefix: string,
  shareId: string,
  key: string | null,
  version?: number,
): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}${prefix}${encodeURIComponent(shareId)}${versionQuery(version)}${keyFragment(key)}`;
}

export function buildShareUrl(origin: string, shareId: string, key: string | null, version?: number): string {
  return buildLink(origin, SHARE_PATH_PREFIX, shareId, key, version);
}

export function buildSplitTableUrl(origin: string, shareId: string, key: string | null, version?: number): string {
  return buildLink(origin, SPLIT_TABLE_PATH_PREFIX, shareId, key, version);
}

export function buildGroupSplitUrl(origin: string, shareId: string, key: string | null, version?: number): string {
  return buildLink(origin, GROUP_SPLIT_PATH_PREFIX, shareId, key, version);
}

/** DEC-457 — link to one shared expense (`/x/:id`). */
export function buildExpenseShareUrl(origin: string, shareId: string, key: string | null, version?: number): string {
  return buildLink(origin, EXPENSE_SHARE_PATH_PREFIX, shareId, key, version);
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
