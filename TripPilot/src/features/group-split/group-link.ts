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
  type SharePublishExtras,
} from '@/data/sync/share-client';
import {
  buildGroupSplitUrl,
  buildSharePreview,
  slugifyShareName,
  type SharePreview,
} from '@/domain/sync';
import { formatMoney } from '@/domain/money';
import { appSettingsRepository } from '@/data/repositories';
import i18n from '@/i18n';
import { getShareOrigin } from '@/utils/native/public-origin';
import { brandRemotePhotoForOg, ogFooterTagline } from '@/features/shared/og-branded-image';
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
  /** DEC-446 — readable path slug (absent on legacy/preview-off links). */
  slug?: string;
  /** AES key (base64url). */
  key: string;
  /** DEC-455 — worker holds the key too, so the built link drops `#k=`. */
  keyOnServer?: boolean;
  writeToken: string;
  /** Last published revision; bumped on every owner re-publish. */
  revision: number;
}

async function encodeEvent(key: string, event: GroupSplitEvent, revision: number): Promise<string> {
  const cryptoKey = await importSessionKey(key);
  const payload = buildGroupSharePayload(event, revision);
  return encryptText(cryptoKey, JSON.stringify(payload));
}

/* ── preview (DEC-445, Â-PREVIEW-SUMMARY-ONLY) ───────────────────────────── */

/** DEC-445 kill-switch — default ON; a read failure never blocks publishing. */
export async function isSharePreviewEnabled(): Promise<boolean> {
  try {
    const settings = await appSettingsRepository.get();
    return settings?.sharePreviewEnabled !== false;
  } catch {
    return true;
  }
}

/** First plaintext (DEC-348) image on any expense — crawlers cannot decrypt E2E refs. */
function groupPreviewImgId(event: GroupSplitEvent): string | null {
  for (const expense of event.expenses) {
    const ref = (expense.imageRefs ?? []).find((r) => !r.key);
    if (ref) return ref.r2Id;
  }
  return null;
}

/**
 * DEC-458 — the card photo is a BRANDED variant (photo + TripPilot footer with
 * the group tagline), composed client-side and uploaded next to the original.
 * Falls back to the raw photo id on any failure; null when there is no photo.
 */
async function groupOgImgId(event: GroupSplitEvent): Promise<string | null> {
  const rawId = groupPreviewImgId(event);
  if (!rawId) return null;
  const branded = await brandRemotePhotoForOg(rawId, ogFooterTagline('group'));
  return branded ?? rawId;
}

/** Summary-only preview, composed in the OWNER's language (server never translates). */
function composeGroupPreview(event: GroupSplitEvent, imgId: string | null): SharePreview {
  const totalCents = event.expenses.reduce((sum, e) => sum + e.amountCents, 0);
  return buildSharePreview({
    kind: 'group',
    title: event.name,
    description: i18n.t('shareLink.preview_group_desc', {
      total: formatMoney(totalCents, event.currency),
      count: event.participants.length,
    }),
    totalCents,
    currency: event.currency,
    peopleCount: event.participants.length,
    imgId,
  });
}

/** DEC-455 — `linkKey` rides ALWAYS (short links); preview/slug obey the toggle. */
async function groupPublishExtras(event: GroupSplitEvent, key: string): Promise<SharePublishExtras> {
  const previewOn = await isSharePreviewEnabled();
  return {
    ...(previewOn
      ? {
          preview: composeGroupPreview(event, await groupOgImgId(event)),
          slugBase: slugifyShareName(event.name) || 'group',
        }
      : {}),
    linkKey: key,
  };
}

/* ── owner side ──────────────────────────────────────────────────────────── */

/** Publish the group event for the first time → returns the credentials. */
export async function publishGroupSplit(event: GroupSplitEvent, revision: number): Promise<GroupLiveCreds> {
  const safeRevision = revision >= 1 ? Math.floor(revision) : 1;
  const key = await generateSessionKey();
  const blob = await encodeEvent(key, event, safeRevision);
  const created = await createShare(blob, safeRevision, await groupPublishExtras(event, key));
  return {
    shareId: created.id,
    ...(created.slug ? { slug: created.slug } : {}),
    key,
    // Only trust the worker's explicit ack — an older worker ignores linkKey.
    ...(created.keyHeld ? { keyOnServer: true } : {}),
    writeToken: created.writeToken,
    revision: safeRevision,
  };
}

/**
 * Re-publish the edited event under the same link (owner-authoritative).
 * Returns whether the worker now holds the key (DEC-455 upgrade path for
 * events shared before escrow) — the caller persists `keyOnServer`.
 */
export async function republishGroupSplit(
  creds: GroupLiveCreds,
  event: GroupSplitEvent,
  revision: number,
): Promise<{ keyHeld: boolean }> {
  const blob = await encodeEvent(creds.key, event, revision);
  // Preview refreshed (or erased, when the kill-switch is off) on every republish.
  const extras = await groupPublishExtras(event, creds.key);
  const result = await putShareStatement(creds.shareId, creds.writeToken, blob, revision, extras);
  return { keyHeld: result.keyHeld };
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
  // DEC-446 — the slug shortens the PATH. Old credentials without a slug keep
  // producing the raw-id link forever.
  // DEC-454 — the revision rides as ?v= so WhatsApp re-scrapes an edited share
  // (e.g. a photo attached after the first paste) instead of serving its cache.
  // DEC-455 — when the worker holds the key, the `#k=` fragment is dropped.
  const fragmentKey = creds.keyOnServer ? null : creds.key;
  return buildGroupSplitUrl(getShareOrigin(), creds.slug ?? creds.shareId, fragmentKey, creds.revision);
}

/* ── guest side ──────────────────────────────────────────────────────────── */

export type FetchGroupStatus = 'revoked' | 'not_found' | 'bad_key' | 'error';

export type FetchGroupResult =
  | { status: 'ok'; payload: GroupSharePayload; key: string }
  | { status: FetchGroupStatus };

/**
 * Fetch + decrypt + validate the live group event for a guest. DEC-455: `key`
 * may be null (fragment-less short link) — the escrowed key from the statement
 * GET is used instead, and the RESOLVED key rides back in the ok result so the
 * page can post claims / pull responses with it. A fragment key always wins.
 */
export async function fetchGroupSplit(shareId: string, key: string | null): Promise<FetchGroupResult> {
  const res = await getShareStatement(shareId);
  if (res.status === 'revoked') return { status: 'revoked' };
  if (res.status === 'not_found') return { status: 'not_found' };
  if (res.status === 'error') return { status: 'error' };

  const effectiveKey = key ?? res.key ?? null;
  if (!effectiveKey) return { status: 'bad_key' };
  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await importSessionKey(effectiveKey);
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
  return { status: 'ok', payload, key: effectiveKey };
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

/* ── joined groups (DEC-355, G8 — invitee side) ────────────────────────────── */

const JOINED_GROUPS_KEY = 'group.joined';

/**
 * DEC-355 (G8) — a group I was INVITED to (I'm a guest, not the owner). Stores the
 * `/g/` read credentials a `group_invite` carried, so the group shows in my list
 * and opens the live board. The owner stays the money authority — I never get the
 * write token, only the read capability a `/g/` link grants.
 */
export interface JoinedGroup {
  shareId: string;
  /** The AES read key (base64url). */
  key: string;
  name: string;
  /** Who invited me (display only). */
  invitedByName: string;
  joinedAt: string;
}

type JoinedGroupsMap = Record<string, JoinedGroup>;

function isJoinedGroup(g: Partial<JoinedGroup> | undefined): g is JoinedGroup {
  return (
    !!g &&
    typeof g.shareId === 'string' &&
    typeof g.key === 'string' &&
    typeof g.name === 'string'
  );
}

function readJoinedGroupsMap(): JoinedGroupsMap {
  try {
    const raw = localStorage.getItem(JOINED_GROUPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as JoinedGroupsMap;
    return {};
  } catch {
    return {};
  }
}

/** Persist (or refresh) a group I accepted an invite to, keyed by its share id. */
export function saveJoinedGroup(group: JoinedGroup): void {
  try {
    const map = readJoinedGroupsMap();
    map[group.shareId] = group;
    localStorage.setItem(JOINED_GROUPS_KEY, JSON.stringify(map));
  } catch {
    // Private mode / no storage: the live link still works for this session.
  }
}

/** Every group I was invited to and accepted, newest first. */
export function listJoinedGroups(): JoinedGroup[] {
  return Object.values(readJoinedGroupsMap())
    .filter(isJoinedGroup)
    .sort((a, b) => (b.joinedAt ?? '').localeCompare(a.joinedAt ?? ''));
}

export function removeJoinedGroup(shareId: string): void {
  try {
    const map = readJoinedGroupsMap();
    if (shareId in map) {
      delete map[shareId];
      localStorage.setItem(JOINED_GROUPS_KEY, JSON.stringify(map));
    }
  } catch {
    // ignore
  }
}

/* ── auto-accept allowlist (G_last, DEC-355 — trusted inviters) ─────────────── */

const AUTO_ACCEPT_KEY = 'group.invite.autoaccept';

/**
 * G_last (DEC-355) — a per-inviter allowlist: actorIds whose group invites I chose
 * to accept silently (skipping the accept-first prompt). Mirrors the `JoinedGroup`
 * localStorage map; the silent auto-accept pass (UI, on inbox refresh) consults it.
 * This only changes WHO still prompts — never the capability: the owner still
 * grants me READ creds only. Per-inviter, revocable; keyed by the sender actorId.
 */
export interface AutoAcceptInviter {
  actorId: string;
  /** Display name at the moment I trusted them (UI only). */
  name: string;
  since: string;
}

type AutoAcceptMap = Record<string, AutoAcceptInviter>;

function isAutoAcceptInviterEntry(e: Partial<AutoAcceptInviter> | undefined): e is AutoAcceptInviter {
  return !!e && typeof e.actorId === 'string' && typeof e.name === 'string';
}

function readAutoAcceptMap(): AutoAcceptMap {
  try {
    const raw = localStorage.getItem(AUTO_ACCEPT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as AutoAcceptMap;
    return {};
  } catch {
    return {};
  }
}

/** True when I have opted to silently accept group invites from this actor. */
export function isAutoAcceptInviter(actorId: string): boolean {
  if (!actorId) return false;
  return actorId in readAutoAcceptMap();
}

/** Opt in to silently accepting FUTURE group invites from this actor. */
export function addAutoAcceptInviter(actorId: string, name: string): void {
  if (!actorId) return;
  try {
    const map = readAutoAcceptMap();
    map[actorId] = { actorId, name, since: new Date().toISOString() };
    localStorage.setItem(AUTO_ACCEPT_KEY, JSON.stringify(map));
  } catch {
    // Private mode / no storage: the preference simply won't persist.
  }
}

/** Stop auto-accepting invites from this actor (future invites prompt again). */
export function removeAutoAcceptInviter(actorId: string): void {
  try {
    const map = readAutoAcceptMap();
    if (actorId in map) {
      delete map[actorId];
      localStorage.setItem(AUTO_ACCEPT_KEY, JSON.stringify(map));
    }
  } catch {
    // ignore
  }
}

/** Every inviter I currently auto-accept, newest trust first (UI seeding). */
export function listAutoAcceptInviters(): AutoAcceptInviter[] {
  return Object.values(readAutoAcceptMap())
    .filter(isAutoAcceptInviterEntry)
    .sort((a, b) => (b.since ?? '').localeCompare(a.since ?? ''));
}
