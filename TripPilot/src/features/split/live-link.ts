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
  type ShareResponseItem,
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
 * Decrypt + validate a raw response list with the table key. Malformed or
 * undecryptable items are dropped (never throw) so one bad response cannot
 * poison anyone's live view. Shared by the owner pull and the guest pull — both
 * fold the result through the same deterministic reducer (`reduceGuestClaims`),
 * which is what lets every device converge on the identical live table.
 */
async function decodeResponses(key: string, items: ShareResponseItem[]): Promise<SplitClaimResponse[]> {
  if (items.length === 0) return [];
  const cryptoKey = await importSessionKey(key);
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

/** Owner pull (passes the write token; the worker ignores it for reads). */
export async function pullSplitClaims(creds: SplitLiveCreds): Promise<SplitClaimResponse[]> {
  const items = await getShareResponses(creds.shareId, creds.writeToken);
  return decodeResponses(creds.key, items);
}

/**
 * Guest pull — read EVERY participant's claim snapshot with just the link
 * (id + key), no write token. This is the half that makes the table survive the
 * owner going offline: each device reduces (statement + all responses) locally
 * and therefore sees what everyone is choosing in real time, with or without the
 * organizer present.
 */
export async function fetchSplitResponses(shareId: string, key: string): Promise<SplitClaimResponse[]> {
  const items = await getShareResponses(shareId);
  return decodeResponses(key, items);
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

/* ── owner live-table persistence (survive an accidental close) ──────────── */

const OWNER_LIVE_KEY = 'split.owner.live';

/**
 * L2.M5 — persist the owner's live credentials so closing the app (by accident
 * or on purpose) does NOT kill the table. On reopen we re-fetch the statement
 * from the server (the source of truth) and resume the SAME link, instead of
 * minting a new one and stranding the guests on a dead URL. Only the latest
 * active table is kept (the owner edits one bill at a time). Cleared on
 * stop/revoke/commit so a finished bill never resurrects.
 */
export function saveOwnerLive(creds: SplitLiveCreds): void {
  try {
    localStorage.setItem(OWNER_LIVE_KEY, JSON.stringify(creds));
  } catch {
    // Private mode / no storage: live link still works for this session.
  }
}

export function loadOwnerLive(): SplitLiveCreds | null {
  try {
    const raw = localStorage.getItem(OWNER_LIVE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<SplitLiveCreds>;
    if (
      typeof c.shareId === 'string' &&
      typeof c.key === 'string' &&
      typeof c.writeToken === 'string' &&
      typeof c.revision === 'number'
    ) {
      return { shareId: c.shareId, key: c.key, writeToken: c.writeToken, revision: c.revision };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearOwnerLive(): void {
  try {
    localStorage.removeItem(OWNER_LIVE_KEY);
  } catch {
    // ignore
  }
  // The render-ready snapshot dies with the credentials, so the home card, the
  // floating chip and the FAB stop offering a table that no longer exists.
  clearActiveSplitMeta();
}

/* ── active-split snapshot (the "saída de bar" that is still happening) ───── */

/** Fired whenever the active live split is saved, updated, or cleared. */
export const SPLIT_LIVE_CHANGED_EVENT = 'trippilot:split-live-changed';

const ACTIVE_SPLIT_META_KEY = 'split.owner.meta';

/**
 * A lightweight, render-ready snapshot of the owner's active live split, kept in
 * step with the live credentials. The home card, the floating chip and the FAB
 * read THIS (never the network) so an active division is visible on every screen
 * with zero round-trips. Cleared together with the credentials on stop/commit.
 */
export interface ActiveSplitMeta {
  shareId: string;
  name: string;
  currency: string;
  totalCents: number;
  participantCount: number;
  /** Distinct non-owner devices that have posted a claim (the people "at the table"). */
  guestCount: number;
  updatedAt: number;
}

function dispatchSplitLiveChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent(SPLIT_LIVE_CHANGED_EVENT));
  } catch {
    // No window (SSR / tests without DOM) — nothing is listening anyway.
  }
}

export function saveActiveSplitMeta(meta: ActiveSplitMeta): void {
  try {
    localStorage.setItem(ACTIVE_SPLIT_META_KEY, JSON.stringify(meta));
  } catch {
    // Private mode / no storage: the live session still works for this run.
  }
  dispatchSplitLiveChanged();
}

export function loadActiveSplitMeta(): ActiveSplitMeta | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SPLIT_META_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as Partial<ActiveSplitMeta>;
    if (
      typeof m.shareId === 'string' &&
      typeof m.name === 'string' &&
      typeof m.currency === 'string' &&
      typeof m.totalCents === 'number' &&
      typeof m.participantCount === 'number' &&
      typeof m.guestCount === 'number' &&
      typeof m.updatedAt === 'number'
    ) {
      return {
        shareId: m.shareId,
        name: m.name,
        currency: m.currency,
        totalCents: m.totalCents,
        participantCount: m.participantCount,
        guestCount: m.guestCount,
        updatedAt: m.updatedAt,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearActiveSplitMeta(): void {
  try {
    localStorage.removeItem(ACTIVE_SPLIT_META_KEY);
  } catch {
    // ignore
  }
  dispatchSplitLiveChanged();
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
