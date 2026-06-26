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
import { buildGroupSplitUrl } from '@/domain/sync';
import { getShareOrigin } from '@/utils/native/public-origin';
import {
  buildGroupSharePayload,
  parseGroupSharePayload,
  parseGroupClaimResponse,
  parseGroupClaimExpense,
  type GroupSharePayload,
  type GroupClaimResponse,
  type GroupClaimExpense,
} from '@/domain/group-split';
import type { GroupSplitEvent } from '@/domain/group-split';

/**
 * C23 / DEC-297 (Tricount public link) — the client orchestration that wires the
 * pure group-split domain (share payload + owner-reducer) to the SAME encrypted
 * share channel the bill-split live table uses (crypto + share-client). It is the
 * only place that mixes the boundary (network, WebCrypto, localStorage) with the
 * group-split feature, so the domain and the React layer stay free of transport.
 *
 * Capability model (inherited from DEC-207): the AES key never leaves the device
 * except inside the link fragment, so the worker stores opaque ciphertext it can
 * never read. The owner holds a write token that gates re-publish / revoke /
 * pulling guest claims. The guest identity (actorId/name) is shared with the
 * bill-split live table — same device, same person.
 */

export interface GroupLiveCreds {
  shareId: string;
  /** AES key (base64url). Client-only; travels solely in the link fragment. */
  key: string;
  writeToken: string;
  /** Last published revision; bumped on every owner re-publish. */
  revision: number;
}

async function encodeEvent(key: string, event: GroupSplitEvent, revision: number): Promise<string> {
  const cryptoKey = await importSessionKey(key);
  const payload = buildGroupSharePayload(event, revision);
  return encryptText(cryptoKey, JSON.stringify(payload));
}

/* ── owner side ──────────────────────────────────────────────────────────── */

/** Publish the group event for the first time → returns the credentials. */
export async function publishGroupSplit(event: GroupSplitEvent, revision: number): Promise<GroupLiveCreds> {
  const safeRevision = revision >= 1 ? Math.floor(revision) : 1;
  const key = await generateSessionKey();
  const blob = await encodeEvent(key, event, safeRevision);
  const created = await createShare(blob, safeRevision);
  return { shareId: created.id, key, writeToken: created.writeToken, revision: safeRevision };
}

/** Re-publish the edited event under the same link (owner-authoritative). */
export async function republishGroupSplit(
  creds: GroupLiveCreds,
  event: GroupSplitEvent,
  revision: number,
): Promise<void> {
  const blob = await encodeEvent(creds.key, event, revision);
  await putShareStatement(creds.shareId, creds.writeToken, blob, revision);
}

export async function revokeGroupSplit(creds: GroupLiveCreds): Promise<void> {
  await revokeShare(creds.shareId, creds.writeToken);
}

/**
 * Decrypt + validate a raw response list with the event key. Malformed or
 * undecryptable items are dropped (never throw) so one bad response cannot
 * poison the owner's view. Folded through `reduceGroupClaims` by the caller.
 */
async function decodeResponses(key: string, items: ShareResponseItem[]): Promise<GroupClaimResponse[]> {
  if (items.length === 0) return [];
  const cryptoKey = await importSessionKey(key);
  const out: GroupClaimResponse[] = [];
  for (const item of items) {
    const text = await decryptText(cryptoKey, item.blob);
    if (text === null) continue;
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      continue;
    }
    const parsed = parseGroupClaimResponse(json);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Owner pull (passes the write token; the worker ignores it for reads). */
export async function pullGroupClaims(creds: GroupLiveCreds): Promise<GroupClaimResponse[]> {
  const items = await getShareResponses(creds.shareId, creds.writeToken);
  return decodeResponses(creds.key, items);
}

/** Guest pull — read every device's claim snapshot with just the link (id+key). */
export async function fetchGroupResponses(shareId: string, key: string): Promise<GroupClaimResponse[]> {
  const items = await getShareResponses(shareId);
  return decodeResponses(key, items);
}

export function buildGroupSplitLink(creds: GroupLiveCreds): string {
  return buildGroupSplitUrl(getShareOrigin(), creds.shareId, creds.key);
}

/* ── guest side ──────────────────────────────────────────────────────────── */

export type FetchGroupStatus = 'revoked' | 'not_found' | 'bad_key' | 'error';

export type FetchGroupResult =
  | { status: 'ok'; payload: GroupSharePayload }
  | { status: FetchGroupStatus };

/** Fetch + decrypt + validate the live group event for a guest. */
export async function fetchGroupSplit(shareId: string, key: string): Promise<FetchGroupResult> {
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
  const payload = parseGroupSharePayload(json);
  if (!payload) return { status: 'error' };
  return { status: 'ok', payload };
}

/**
 * Post the guest's claim snapshot. The response id is the guest's actorId, so a
 * re-post overwrites in place (the worker is idempotent by id) — the snapshot
 * model means the latest post fully describes that device's claim + paid state.
 */
export async function postGroupClaim(shareId: string, key: string, response: GroupClaimResponse): Promise<void> {
  const cryptoKey = await importSessionKey(key);
  const blob = await encryptText(cryptoKey, JSON.stringify(response));
  await postShareResponse(shareId, response.fromActorId, blob);
}

/* ── owner live-link persistence (per event, survive an accidental close) ──── */

const OWNER_LIVE_KEY = 'group.owner.live';

type CredsMap = Record<string, GroupLiveCreds>;

function isCreds(c: Partial<GroupLiveCreds> | undefined): c is GroupLiveCreds {
  return (
    !!c &&
    typeof c.shareId === 'string' &&
    typeof c.key === 'string' &&
    typeof c.writeToken === 'string' &&
    typeof c.revision === 'number'
  );
}

function readCredsMap(): CredsMap {
  try {
    const raw = localStorage.getItem(OWNER_LIVE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as CredsMap;
    return {};
  } catch {
    return {};
  }
}

/**
 * Persist the owner's live credentials keyed by event id, so closing the app does
 * NOT kill the link and the owner can re-share the SAME URL instead of stranding
 * guests on a dead one. The owner runs many group events, hence a map (the
 * single-bill split keeps only one active table). Cleared on revoke.
 */
export function saveGroupLive(eventId: string, creds: GroupLiveCreds): void {
  try {
    const map = readCredsMap();
    map[eventId] = creds;
    localStorage.setItem(OWNER_LIVE_KEY, JSON.stringify(map));
  } catch {
    // Private mode / no storage: the live link still works for this session.
  }
}

export function loadGroupLive(eventId: string): GroupLiveCreds | null {
  const map = readCredsMap();
  const creds = map[eventId];
  return isCreds(creds) ? creds : null;
}

export function clearGroupLive(eventId: string): void {
  try {
    const map = readCredsMap();
    if (eventId in map) {
      delete map[eventId];
      localStorage.setItem(OWNER_LIVE_KEY, JSON.stringify(map));
    }
  } catch {
    // ignore
  }
}

/* ── guest authored-expenses draft (DEC-340, per share id) ─────────────────── */

const GUEST_EXPENSES_KEY = 'group.guest.expenses';

type GuestExpensesMap = Record<string, GroupClaimExpense[]>;

function readGuestExpensesMap(): GuestExpensesMap {
  try {
    const raw = localStorage.getItem(GUEST_EXPENSES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as GuestExpensesMap;
    return {};
  } catch {
    return {};
  }
}

/**
 * DEC-340 — the guest's locally-kept authored-expense draft for a share, used as
 * the snapshot they re-post on every change (the owner folds it add-or-retract).
 * Each entry is re-validated through the domain schema so a corrupt/old draft can
 * never post a malformed expense. A no-app web guest survives reloads with this.
 */
export function loadGuestExpenses(shareId: string): GroupClaimExpense[] {
  const list = readGuestExpensesMap()[shareId];
  if (!Array.isArray(list)) return [];
  return list.map((e) => parseGroupClaimExpense(e)).filter((e): e is GroupClaimExpense => e !== null);
}

export function saveGuestExpenses(shareId: string, expenses: GroupClaimExpense[]): void {
  try {
    const map = readGuestExpensesMap();
    if (expenses.length === 0) delete map[shareId];
    else map[shareId] = expenses;
    localStorage.setItem(GUEST_EXPENSES_KEY, JSON.stringify(map));
  } catch {
    // Private mode / no storage: the draft still lives in component state.
  }
}

/** A client-stable id for a guest-authored expense (`g:<actorId>:<rand>`), so a
 *  re-posted snapshot never double-books it (the reducer keys on this id). */
export function newGuestExpenseId(actorId: string): string {
  const rand = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/-/g, '').slice(0, 10);
  return `g:${actorId}:${rand}`;
}
