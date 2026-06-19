import {
  generateSessionKey,
  importSessionKey,
  encryptText,
  decryptText,
} from '@/data/sync/crypto';
import {
  createShare,
  getShareStatement,
  putShareStatement,
  revokeShare,
  postShareResponse,
  getShareResponses,
} from '@/data/sync/share-client';
import { buildSplitTableUrl } from '@/domain/sync';
import { getShareOrigin } from '@/utils/native/public-origin';
import {
  buildSplitSharePayload,
  parseSplitSharePayload,
  parseSplitClaimResponse,
  type SplitSharePayload,
  type SplitClaimResponse,
} from '@/domain/split';
import type { SplitSession } from '@/domain/split';

/**
 * G2 (live table link) — the client orchestration that wires the pure split
 * domain (share payload + owner-reducer) to the existing encrypted share
 * channel (crypto + share-client + signal). It is the ONLY place that mixes the
 * boundary (network, WebCrypto, localStorage) with the split feature, so the
 * domain and the React layer both stay free of transport concerns.
 *
 * Capability model (inherited from DEC-207): the AES key never leaves the
 * device except inside the link fragment, so the worker stores opaque
 * ciphertext it can never read. The owner holds a write token that gates
 * re-publish / revoke / pulling guest claims.
 */

export interface SplitLiveCreds {
  shareId: string;
  /** AES key (base64url). Client-only; travels solely in the link fragment. */
  key: string;
  writeToken: string;
  /** Last published revision; bumped on every owner re-publish. */
  revision: number;
}

async function encodeSession(key: string, session: SplitSession, revision: number): Promise<string> {
  const cryptoKey = await importSessionKey(key);
  const payload = buildSplitSharePayload(session, revision);
  return encryptText(cryptoKey, JSON.stringify(payload));
}

/* ── owner side ──────────────────────────────────────────────────────────── */

/** Publish the live table for the first time → returns the credentials. */
export async function publishSplitTable(session: SplitSession, revision: number): Promise<SplitLiveCreds> {
  const safeRevision = revision >= 1 ? Math.floor(revision) : 1;
  const key = await generateSessionKey();
  const blob = await encodeSession(key, session, safeRevision);
  const created = await createShare(blob, safeRevision);
  return { shareId: created.id, key, writeToken: created.writeToken, revision: safeRevision };
}

/** Re-publish the merged/edited session under the same link (owner-authoritative). */
export async function republishSplitTable(
  creds: SplitLiveCreds,
  session: SplitSession,
  revision: number,
): Promise<void> {
  const blob = await encodeSession(creds.key, session, revision);
  await putShareStatement(creds.shareId, creds.writeToken, blob, revision);
}

export async function revokeSplitTable(creds: SplitLiveCreds): Promise<void> {
  await revokeShare(creds.shareId, creds.writeToken);
}

/**
 * Pull every guest claim snapshot, decrypt, and validate. Malformed or
 * undecryptable items are dropped (never throw) so one bad response cannot
 * poison the owner's live view. The owner-reducer (`reduceGuestClaims`) folds
 * the result into the live session.
 */
export async function pullSplitClaims(creds: SplitLiveCreds): Promise<SplitClaimResponse[]> {
  const items = await getShareResponses(creds.shareId, creds.writeToken);
  if (items.length === 0) return [];
  const cryptoKey = await importSessionKey(creds.key);
  const out: SplitClaimResponse[] = [];
  for (const item of items) {
    const text = await decryptText(cryptoKey, item.blob);
    if (text === null) continue;
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      continue;
    }
    const parsed = parseSplitClaimResponse(json);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function buildSplitTableLink(creds: SplitLiveCreds): string {
  // D-BUG-01: inside the Capacitor WebView `window.location.origin` is
  // `https://localhost`, which would produce a dead link. `getShareOrigin()`
  // returns the canonical public origin on native (and the real origin on web),
  // exactly like the `/s/:id` + `/pair` links.
  return buildSplitTableUrl(getShareOrigin(), creds.shareId, creds.key);
}

/* ── guest side ──────────────────────────────────────────────────────────── */

export type FetchTableStatus = 'revoked' | 'not_found' | 'bad_key' | 'error';

export type FetchTableResult =
  | { status: 'ok'; payload: SplitSharePayload }
  | { status: FetchTableStatus };

/** Fetch + decrypt + validate the live table for a guest. */
export async function fetchSplitTable(shareId: string, key: string): Promise<FetchTableResult> {
  const res = await getShareStatement(shareId);
  if (res.status === 'revoked') return { status: 'revoked' };
  if (res.status === 'not_found') return { status: 'not_found' };
  if (res.status === 'error') return { status: 'error' };

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await importSessionKey(key);
  } catch {
    return { status: 'bad_key' };
  }
  const text = await decryptText(cryptoKey, res.blob);
  if (text === null) return { status: 'bad_key' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { status: 'error' };
  }
  const payload = parseSplitSharePayload(json);
  if (!payload) return { status: 'error' };
  return { status: 'ok', payload };
}

/**
 * Post the guest's claim snapshot. The response id is the guest's actorId, so a
 * re-post overwrites in place (the worker is idempotent by id) — the snapshot
 * model means the latest post fully describes that guest's claims.
 */
export async function postSplitClaim(shareId: string, key: string, response: SplitClaimResponse): Promise<void> {
  const cryptoKey = await importSessionKey(key);
  const blob = await encryptText(cryptoKey, JSON.stringify(response));
  await postShareResponse(shareId, response.fromActorId, blob);
}

/* ── guest identity (stable across reloads, per device) ──────────────────── */

const GUEST_ACTOR_KEY = 'split.guest.actorId';
const GUEST_NAME_KEY = 'split.guest.name';

/** A stable per-device actor id for the guest (so re-posts overwrite + survive reloads). */
export function getGuestActorId(): string {
  try {
    const existing = localStorage.getItem(GUEST_ACTOR_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(GUEST_ACTOR_KEY, fresh);
    return fresh;
  } catch {
    // Private mode / no storage: a volatile id still works for the live session.
    return crypto.randomUUID();
  }
}

export function getGuestName(): string | null {
  try {
    const name = localStorage.getItem(GUEST_NAME_KEY);
    return name && name.trim() ? name : null;
  } catch {
    return null;
  }
}

export function setGuestName(name: string): void {
  try {
    localStorage.setItem(GUEST_NAME_KEY, name.trim().slice(0, 60));
  } catch {
    // ignore — name kept in component state regardless
  }
}
