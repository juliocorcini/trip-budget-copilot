import { v4 as uuidv4 } from 'uuid';
import { percentOf, sumCents } from '@/domain/money';
import type {
  Adjustment,
  PerPersonLine,
  PerPersonTotal,
  ServiceCharge,
  ServiceChargeDetection,
  ServiceChargeMode,
  SplitClaim,
  SplitConflict,
  SplitItem,
  SplitMode,
  SplitParticipant,
  SplitParticipantKind,
  SplitSession,
  SplitTotals,
} from './types';

/** Float tolerance for "claimed up to 100%" checks (fractions are user input). */
const WEIGHT_EPSILON = 1e-6;
/** Service charge is "probably already included" when the gap is 8–15% of items. */
const INCLUDED_MIN_RATIO = 0.08;
const INCLUDED_MAX_RATIO = 0.15;

/* ── distribution helpers (exact to the cent) ──────────────────────────── */

/**
 * Split `totalCents` across `weights` proportionally. The LAST positive-weight
 * entry absorbs the rounding remainder so the result always sums to exactly
 * `totalCents` (handles negative totals — discounts). Zero-weight entries get 0.
 */
export function distributeProportionally(totalCents: number, weights: number[]): number[] {
  const result = weights.map(() => 0);
  const weightSum = weights.reduce((sum, w) => sum + (w > 0 ? w : 0), 0);
  if (weightSum <= 0) return result;

  let lastPositive = -1;
  for (let i = 0; i < weights.length; i++) if (weights[i]! > 0) lastPositive = i;

  let allocated = 0;
  weights.forEach((weight, i) => {
    if (weight <= 0 || i === lastPositive) return;
    const amount = Math.round((weight / weightSum) * totalCents);
    result[i] = amount;
    allocated += amount;
  });
  if (lastPositive >= 0) result[lastPositive] = totalCents - allocated;
  return result;
}

/**
 * Split `totalCents` equally across `n` parts (per-head). The first `|remainder|`
 * parts take the extra cent, signed so negatives split cleanly too.
 */
export function distributeEqually(totalCents: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.trunc(totalCents / n);
  let remainder = totalCents - base * n;
  const step = remainder >= 0 ? 1 : -1;
  remainder = Math.abs(remainder);
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? step : 0));
}

/* ── claim weights ─────────────────────────────────────────────────────── */

/** A claim's weight as a fraction of the whole line (units win when present). */
export function claimWeight(item: SplitItem, claim: SplitClaim): number {
  if (claim.units !== null && item.qty > 0) return claim.units / item.qty;
  return claim.fraction;
}

/** Total fraction of a line that has been claimed (0 = orphan, >1 = conflict). */
export function itemClaimedWeight(item: SplitItem): number {
  return item.claims.reduce((sum, claim) => sum + claimWeight(item, claim), 0);
}

/* ── service charge ────────────────────────────────────────────────────── */

/** The absolute service amount in cents (resolves percent against a subtotal). */
export function serviceChargeAmountCents(charge: ServiceCharge, subtotalCents: number): number {
  if (charge.mode === 'none') return 0;
  if (charge.amountCents > 0) return charge.amountCents;
  if (charge.percent !== null && charge.percent > 0) return percentOf(subtotalCents, charge.percent);
  return 0;
}

/**
 * §9.2 — decide the service charge from what the OCR read plus the printed total:
 *  1. an explicit amount/percent was read → `detected`, proportional;
 *  2. nothing read but `total − items` is 8–15% of items → `inferred_included`;
 *  3. otherwise → `asked` (mode none, amount 0) and `needsPrompt`.
 * Pure — the UI decides whether to surface the confirm/ask sheet from the flags.
 */
export function detectServiceCharge(input: {
  detectedAmountCents: number | null;
  detectedPercent: number | null;
  included: boolean | null;
  subtotalCents: number;
  readTotalCents: number | null;
}): ServiceChargeDetection {
  const { detectedAmountCents, detectedPercent, subtotalCents, readTotalCents } = input;

  if ((detectedAmountCents !== null && detectedAmountCents > 0) || (detectedPercent !== null && detectedPercent > 0)) {
    const amountCents =
      detectedAmountCents !== null && detectedAmountCents > 0
        ? detectedAmountCents
        : percentOf(subtotalCents, detectedPercent ?? 0);
    return {
      serviceCharge: { mode: 'proportional', source: 'detected', amountCents, percent: detectedPercent },
      needsPrompt: false,
    };
  }

  if (readTotalCents !== null && subtotalCents > 0) {
    const gap = readTotalCents - subtotalCents;
    const ratio = gap / subtotalCents;
    if (ratio >= INCLUDED_MIN_RATIO && ratio <= INCLUDED_MAX_RATIO) {
      return {
        serviceCharge: { mode: 'proportional', source: 'inferred_included', amountCents: gap, percent: null },
        needsPrompt: false,
      };
    }
  }

  return {
    serviceCharge: { mode: 'none', source: 'asked', amountCents: 0, percent: null },
    needsPrompt: true,
  };
}

/* ── per-person totals (the heart) ─────────────────────────────────────── */

const emptyTotal = (): {
  itemsCents: number;
  serviceCents: number;
  adjustmentsCents: number;
  lines: PerPersonLine[];
} => ({ itemsCents: 0, serviceCents: 0, adjustmentsCents: 0, lines: [] });

/** Sum of every item's line total (the full bill subtotal, ignoring claims). */
export function itemsSubtotalCents(session: SplitSession): number {
  return sumCents(session.items.map((item) => item.amountCents));
}

function distributeByMode(
  totalCents: number,
  mode: ServiceChargeMode,
  itemWeights: number[],
  headCount: number,
): number[] {
  if (mode === 'per_head') {
    const perHead = distributeEqually(totalCents, headCount);
    return itemWeights.map((_, i) => perHead[i] ?? 0);
  }
  return distributeProportionally(totalCents, itemWeights);
}

/**
 * Itemized division ("cada um pega o seu"): each claimed line is billed to its
 * claimers in proportion to their weights (last absorbs rounding); the service
 * charge and each adjustment are rated by `mode` (proportional → by claimed
 * items; per_head → evenly across all participants). Orphan lines (no claims)
 * are excluded from the totals and surfaced separately.
 */
function computeItemizedTotals(session: SplitSession): SplitTotals {
  const participants = session.participants;
  const acc = new Map(participants.map((p) => [p.id, emptyTotal()]));
  const indexById = new Map(participants.map((p, i) => [p.id, i]));

  const unclaimed: SplitItem[] = [];
  for (const item of session.items) {
    const claimedWeight = itemClaimedWeight(item);
    if (claimedWeight <= 0) {
      unclaimed.push(item);
      continue;
    }
    const billed = Math.round(Math.min(claimedWeight, 1) * item.amountCents);
    const weights = item.claims.map((claim) => claimWeight(item, claim));
    const amounts = distributeProportionally(billed, weights);
    item.claims.forEach((claim, i) => {
      const entry = acc.get(claim.participantId);
      if (!entry) return;
      const amount = amounts[i] ?? 0;
      entry.itemsCents += amount;
      entry.lines.push({ description: item.description, amountCents: amount });
    });
  }

  const itemWeights = participants.map((p) => acc.get(p.id)!.itemsCents);
  const subtotal = itemsSubtotalCents(session);

  const serviceTotal = serviceChargeAmountCents(session.serviceCharge, subtotal);
  if (serviceTotal !== 0) {
    const shares = distributeByMode(serviceTotal, session.serviceCharge.mode, itemWeights, participants.length);
    participants.forEach((p, i) => {
      const entry = acc.get(p.id)!;
      entry.serviceCents += shares[i] ?? 0;
    });
  }

  for (const adjustment of session.adjustments) {
    if (adjustment.amountCents === 0) continue;
    const shares = distributeByMode(adjustment.amountCents, adjustment.mode, itemWeights, participants.length);
    participants.forEach((p, i) => {
      const entry = acc.get(p.id)!;
      entry.adjustmentsCents += shares[i] ?? 0;
    });
  }

  return finalizeTotals(session, acc, indexById, unclaimed);
}

/** Equal division ("por igual"): the whole bill split evenly across everyone. */
function computeEqualTotals(session: SplitSession): SplitTotals {
  const participants = session.participants;
  const n = participants.length;
  const acc = new Map(participants.map((p) => [p.id, emptyTotal()]));
  const indexById = new Map(participants.map((p, i) => [p.id, i]));
  if (n === 0) return finalizeTotals(session, acc, indexById, []);

  const subtotal = itemsSubtotalCents(session);
  const serviceTotal = serviceChargeAmountCents(session.serviceCharge, subtotal);
  const adjTotal = sumCents(session.adjustments.map((a) => a.amountCents));

  const itemShares = distributeEqually(subtotal, n);
  const serviceShares = distributeEqually(serviceTotal, n);
  const adjShares = distributeEqually(adjTotal, n);

  participants.forEach((p, i) => {
    const entry = acc.get(p.id)!;
    entry.itemsCents = itemShares[i] ?? 0;
    entry.serviceCents = serviceShares[i] ?? 0;
    entry.adjustmentsCents = adjShares[i] ?? 0;
  });

  return finalizeTotals(session, acc, indexById, []);
}

/** "Só meu": everything is the owner's — one expense, no division. */
function computeMineTotals(session: SplitSession): SplitTotals {
  const owner = session.participants.find((p) => p.kind === 'owner') ?? session.participants[0];
  const acc = new Map(session.participants.map((p) => [p.id, emptyTotal()]));
  const indexById = new Map(session.participants.map((p, i) => [p.id, i]));
  if (!owner) return finalizeTotals(session, acc, indexById, []);

  const subtotal = itemsSubtotalCents(session);
  const entry = acc.get(owner.id)!;
  entry.itemsCents = subtotal;
  entry.serviceCents = serviceChargeAmountCents(session.serviceCharge, subtotal);
  entry.adjustmentsCents = sumCents(session.adjustments.map((a) => a.amountCents));

  return finalizeTotals(session, acc, indexById, []);
}

function finalizeTotals(
  session: SplitSession,
  acc: Map<string, { itemsCents: number; serviceCents: number; adjustmentsCents: number; lines: PerPersonLine[] }>,
  indexById: Map<string, number>,
  unclaimed: SplitItem[],
): SplitTotals {
  const totals: PerPersonTotal[] = session.participants.map((p) => {
    const entry = acc.get(p.id)!;
    const totalCents = entry.itemsCents + entry.serviceCents + entry.adjustmentsCents;
    return {
      participantId: p.id,
      itemsCents: entry.itemsCents,
      serviceCents: entry.serviceCents,
      adjustmentsCents: entry.adjustmentsCents,
      totalCents,
      lines: entry.lines,
    };
  });

  const ownerParticipant = session.participants.find((p) => p.kind === 'owner');
  const ownerTotal = ownerParticipant
    ? totals[indexById.get(ownerParticipant.id) ?? -1] ?? null
    : null;

  return {
    totals,
    unclaimed,
    grandTotalCents: sumCents(totals.map((t) => t.totalCents)),
    ownerTotal,
  };
}

/** Compute every participant's share for the session's current mode. */
export function computeSplitTotals(session: SplitSession): SplitTotals {
  switch (session.mode) {
    case 'equal':
      return computeEqualTotals(session);
    case 'mine':
      return computeMineTotals(session);
    case 'itemized':
    default:
      return computeItemizedTotals(session);
  }
}

/* ── detection helpers ─────────────────────────────────────────────────── */

/** Items nobody has claimed yet (the orphans / "ninguém pegou"). */
export function detectUnclaimed(session: SplitSession): SplitItem[] {
  return session.items.filter((item) => itemClaimedWeight(item) <= 0);
}

/** Lines claimed beyond 100% — the owner must arbitrate (T7/§Conselho 6). */
export function detectClaimConflicts(session: SplitSession): SplitConflict[] {
  const conflicts: SplitConflict[] = [];
  for (const item of session.items) {
    if (itemClaimedWeight(item) > 1 + WEIGHT_EPSILON) {
      conflicts.push({ itemId: item.id, participantIds: item.claims.map((c) => c.participantId) });
    }
  }
  return conflicts;
}

/* ── immutable mutations ───────────────────────────────────────────────── */

function mapItem(session: SplitSession, itemId: string, fn: (item: SplitItem) => SplitItem): SplitSession {
  return { ...session, items: session.items.map((item) => (item.id === itemId ? fn(item) : item)) };
}

function isLocked(session: SplitSession, participantId: string): boolean {
  return session.participants.find((p) => p.id === participantId)?.markedPaid ?? false;
}

/**
 * Add/replace a participant's claim on a line. E10: a no-op when the participant
 * is `markedPaid` (their slice is locked). Returns a new session (immutable).
 */
export function claimItem(
  session: SplitSession,
  itemId: string,
  participantId: string,
  share: { fraction: number } | { units: number },
): SplitSession {
  if (isLocked(session, participantId)) return session;
  const claim: SplitClaim =
    'units' in share
      ? { participantId, fraction: 0, units: share.units }
      : { participantId, fraction: share.fraction, units: null };
  return mapItem(session, itemId, (item) => ({
    ...item,
    claims: [...item.claims.filter((c) => c.participantId !== participantId), claim],
  }));
}

/** Claim a whole line (the common "I had this" tap). */
export function claimItemWhole(session: SplitSession, itemId: string, participantId: string): SplitSession {
  return claimItem(session, itemId, participantId, { fraction: 1 });
}

/** Remove a participant's claim from a line. E10: a no-op when locked. */
export function releaseClaim(session: SplitSession, itemId: string, participantId: string): SplitSession {
  if (isLocked(session, participantId)) return session;
  return mapItem(session, itemId, (item) => ({
    ...item,
    claims: item.claims.filter((c) => c.participantId !== participantId),
  }));
}

/** Split a line equally across N people in one tap (½/½, N-avos). */
export function splitItemBetween(session: SplitSession, itemId: string, participantIds: string[]): SplitSession {
  if (participantIds.length === 0) return session;
  const fraction = 1 / participantIds.length;
  return mapItem(session, itemId, (item) => ({
    ...item,
    claims: participantIds.map((participantId) => ({ participantId, fraction, units: null })),
  }));
}

export interface AddParticipantIdentity {
  kind?: SplitParticipantKind;
  actorId?: string | null;
  linkedParticipantId?: string | null;
}

/**
 * Add a participant. E7: a returning device (same `actorId`) re-links to the
 * existing participant instead of creating a duplicate; otherwise a new ad-hoc
 * participant is appended. Returns `{ session, participant }` so callers know
 * which id to use for the immediate claim.
 */
export function addParticipant(
  session: SplitSession,
  name: string,
  identity?: AddParticipantIdentity,
): { session: SplitSession; participant: SplitParticipant } {
  const actorId = identity?.actorId ?? null;
  if (actorId !== null) {
    const existing = session.participants.find((p) => p.actorId === actorId);
    if (existing) return { session, participant: existing };
  }
  const participant: SplitParticipant = {
    id: uuidv4(),
    name: name.trim() || 'Convidado',
    kind: identity?.kind ?? (actorId !== null ? 'linked' : 'adhoc'),
    actorId,
    linkedParticipantId: identity?.linkedParticipantId ?? null,
    markedPaid: false,
  };
  return { session: { ...session, participants: [...session.participants, participant] }, participant };
}

/* ── factories ─────────────────────────────────────────────────────────── */

export function createSplitParticipant(
  name: string,
  kind: SplitParticipantKind = 'adhoc',
  identity?: AddParticipantIdentity,
): SplitParticipant {
  return {
    id: uuidv4(),
    name: name.trim(),
    kind,
    actorId: identity?.actorId ?? null,
    linkedParticipantId: identity?.linkedParticipantId ?? null,
    markedPaid: false,
  };
}

export function createSplitItem(input: {
  description: string;
  amountCents: number;
  qty?: number;
  category?: string;
}): SplitItem {
  const qty = input.qty && input.qty > 0 ? input.qty : 1;
  return {
    id: uuidv4(),
    description: input.description,
    qty,
    unitAmountCents: Math.round(input.amountCents / qty),
    amountCents: input.amountCents,
    category: input.category ?? 'other',
    claims: [],
  };
}

export const NO_SERVICE_CHARGE: ServiceCharge = {
  mode: 'none',
  source: 'manual',
  amountCents: 0,
  percent: null,
};

export function createSplitSession(input: {
  tripId: string | null;
  phaseId: string | null;
  name: string;
  currency: string;
  mode?: SplitMode;
  ownerName: string;
  ownerActorId?: string | null;
  items?: SplitItem[];
  readTotalCents?: number | null;
}): SplitSession {
  const owner: SplitParticipant = {
    id: uuidv4(),
    name: input.ownerName.trim() || 'Eu',
    kind: 'owner',
    actorId: input.ownerActorId ?? null,
    linkedParticipantId: null,
    markedPaid: false,
  };
  return {
    id: uuidv4(),
    tripId: input.tripId,
    phaseId: input.phaseId,
    name: input.name,
    currency: input.currency,
    status: 'draft',
    mode: input.mode ?? 'itemized',
    serviceCharge: { ...NO_SERVICE_CHARGE },
    adjustments: [],
    items: input.items ?? [],
    participants: [owner],
    readTotalCents: input.readTotalCents ?? null,
    createdAt: new Date().toISOString(),
  };
}

export function createAdjustment(input: {
  kind: Adjustment['kind'];
  label: string;
  amountCents: number;
  mode?: ServiceChargeMode;
  source?: Adjustment['source'];
}): Adjustment {
  return {
    id: uuidv4(),
    kind: input.kind,
    label: input.label,
    amountCents: input.amountCents,
    mode: input.mode ?? (input.kind === 'couvert' ? 'per_head' : 'proportional'),
    source: input.source ?? 'manual',
  };
}
