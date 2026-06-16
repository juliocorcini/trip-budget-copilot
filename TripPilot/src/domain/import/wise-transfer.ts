import type { Participant } from '@/domain/types/participant';

/**
 * FIELD-14 (DEC-200): intelligence for Wise TRANSFER lines — a transfer to (or
 * from) a PERSON is rarely a plain card purchase. It can settle a debt, pay back
 * an expense the person covered for me, move money between my own wallets, or be
 * a normal expense — and a single transfer often mixes several of these. These
 * pure helpers power the review UI: they match the statement name to a trip
 * participant and validate how the amount is split across "buckets".
 *
 * Everything here is read-only/pure; the actual writes happen in the import
 * orchestrator after the user confirms (the decision is always the user's).
 */

export type WiseTransferDirection = 'out' | 'in';

/**
 * What one slice of a transfer becomes. Outgoing transfers (I sent money) can be
 * any of the first four; incoming transfers (I received money) support settling
 * a debt the person owes me. `ignore` drops the slice.
 */
export type WiseAllocationKind =
  | 'pay_debt'
  | 'person_paid_expense'
  | 'wallet_transfer'
  | 'my_expense'
  | 'settle_incoming'
  | 'ignore';

/** Allocation kinds valid for each direction (data-driven, Core Rule 8). */
export const OUTGOING_ALLOCATION_KINDS: readonly WiseAllocationKind[] = [
  'pay_debt',
  'person_paid_expense',
  'wallet_transfer',
  'my_expense',
  'ignore',
];
export const INCOMING_ALLOCATION_KINDS: readonly WiseAllocationKind[] = [
  'settle_incoming',
  'ignore',
];

/** Kinds that require a matched participant to be meaningful. */
export const PARTICIPANT_ALLOCATION_KINDS: ReadonlySet<WiseAllocationKind> = new Set([
  'pay_debt',
  'person_paid_expense',
  'settle_incoming',
]);

/** Kinds that move money into another of MY wallets (need a target wallet). */
export const WALLET_ALLOCATION_KINDS: ReadonlySet<WiseAllocationKind> = new Set([
  'wallet_transfer',
]);

/** Kinds that record a budget expense (need a category). */
export const EXPENSE_ALLOCATION_KINDS: ReadonlySet<WiseAllocationKind> = new Set([
  'person_paid_expense',
  'my_expense',
]);

export interface WiseAllocation {
  /** Local UI id (list key) — not persisted. */
  id: string;
  kind: WiseAllocationKind;
  amountCents: number;
  /** Required for {@link EXPENSE_ALLOCATION_KINDS}. */
  category?: string;
  /** Required for {@link WALLET_ALLOCATION_KINDS}: the OTHER wallet. */
  targetWalletId?: string | null;
}

export interface ParticipantMatch {
  participantId: string;
  /** 0–100; higher is a stronger name match. */
  score: number;
}

/** Accent/case-insensitive, whitespace-collapsed tokens of a name. */
function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  const norm = normalizeName(value);
  return norm.length === 0 ? [] : norm.split(' ');
}

/**
 * Scores how well a statement counterparty name matches a participant. The Wise
 * name is usually the FULL legal name ("Bruno Pessoa de Oliveira") while the
 * participant is a short name/nickname ("Bruno"), so a participant whose tokens
 * are all contained in the counterparty (especially the first name) scores high.
 */
function scoreNameMatch(counterparty: string, participant: Participant): number {
  const cp = normalizeName(counterparty);
  if (cp.length === 0) return 0;
  const candidates = [participant.name, participant.nickname ?? ''].filter((s) => s.length > 0);

  let best = 0;
  for (const candidate of candidates) {
    const cand = normalizeName(candidate);
    if (cand.length === 0) continue;
    if (cand === cp) {
      best = Math.max(best, 100);
      continue;
    }
    const cpTokens = tokenize(counterparty);
    const candTokens = tokenize(candidate);
    if (cpTokens.length === 0 || candTokens.length === 0) continue;

    const cpSet = new Set(cpTokens);
    const contained = candTokens.filter((tok) => cpSet.has(tok)).length;
    const containmentRatio = contained / candTokens.length;
    const firstTokenEqual = cpTokens[0] === candTokens[0];

    let score = 0;
    if (containmentRatio === 1) {
      // Every participant token appears in the counterparty (e.g. "bruno" ⊂
      // "bruno pessoa de oliveira"). Strong, boosted when the first name aligns.
      score = firstTokenEqual ? 88 : 78;
    } else if (containmentRatio > 0) {
      score = Math.round(40 + containmentRatio * 30);
      if (firstTokenEqual) score += 10;
    } else if (cp.startsWith(cand) || cand.startsWith(cp)) {
      score = 60;
    }
    best = Math.max(best, score);
  }
  return best;
}

/**
 * Best participant match for a statement name, or null below the confidence
 * floor. Owner is never matched (a transfer is to someone else). Suggest-only:
 * the UI pre-selects this but the user confirms (q14 decision).
 */
export function matchParticipantByName(
  counterpartyName: string | null,
  participants: Participant[],
  minScore = 60,
): ParticipantMatch | null {
  if (counterpartyName === null || counterpartyName.trim().length === 0) return null;
  let best: ParticipantMatch | null = null;
  for (const participant of participants) {
    if (participant.isOwner) continue;
    const score = scoreNameMatch(counterpartyName, participant);
    if (score >= minScore && (best === null || score > best.score)) {
      best = { participantId: participant.id, score };
    }
  }
  return best;
}

export function allocationsTotalCents(allocations: WiseAllocation[]): number {
  return allocations.reduce((sum, a) => sum + (a.kind === 'ignore' ? 0 : a.amountCents), 0);
}

export interface TransferAllocationStatus {
  /** transfer amount − allocated (excluding `ignore`). 0 = fully assigned. */
  remainingCents: number;
  /** True when allocations cover exactly the transfer (the commit gate). */
  balanced: boolean;
  /** True when every non-ignore slice has a positive amount. */
  amountsValid: boolean;
}

/**
 * Validates a split against the transfer total. The commit is only allowed when
 * the slices sum EXACTLY to the transfer (AC: "split sums exactly to the value")
 * and every slice is positive. `ignore` slices do not count toward the total —
 * they explicitly drop part of the transfer from tracking.
 */
export function transferAllocationStatus(
  transferAmountCents: number,
  allocations: WiseAllocation[],
): TransferAllocationStatus {
  const assigned = allocationsTotalCents(allocations);
  const remainingCents = transferAmountCents - assigned;
  const amountsValid = allocations.every((a) => a.kind === 'ignore' || a.amountCents > 0);
  return {
    remainingCents,
    balanced: remainingCents === 0,
    amountsValid,
  };
}

let allocSeq = 0;
/** Unique-enough local id for an allocation row (UI list key only). */
export function newAllocationId(): string {
  allocSeq += 1;
  return `alloc_${Date.now().toString(36)}_${allocSeq}`;
}

export interface DefaultAllocationContext {
  direction: WiseTransferDirection;
  transferAmountCents: number;
  /** What I currently owe the matched person (cents, ≥ 0). */
  debtToPersonCents: number;
  /** What the matched person currently owes me (cents, ≥ 0). */
  debtFromPersonCents: number;
  /** A matched participant exists (debt/expense kinds are usable). */
  hasParticipant: boolean;
  /** Default category for an expense slice. */
  defaultCategory: string;
}

/**
 * Proposes a sensible initial split the user can tweak. Outgoing: settle an
 * existing debt first (capped), then treat any remainder as a reimbursed
 * expense; with no debt/participant it is a plain expense. Incoming: settle what
 * the person owes me (capped); the rest is left to the user (ignore) since there
 * is no income primitive for an arbitrary wallet top-up.
 */
export function buildDefaultAllocations(ctx: DefaultAllocationContext): WiseAllocation[] {
  const total = Math.max(0, Math.round(ctx.transferAmountCents));
  if (total === 0) return [];

  if (ctx.direction === 'in') {
    const settleable = ctx.hasParticipant ? Math.min(total, Math.max(0, ctx.debtFromPersonCents)) : 0;
    const allocations: WiseAllocation[] = [];
    if (settleable > 0) {
      allocations.push({ id: newAllocationId(), kind: 'settle_incoming', amountCents: settleable });
    }
    const rest = total - settleable;
    if (rest > 0) {
      allocations.push({ id: newAllocationId(), kind: 'ignore', amountCents: rest });
    }
    return allocations.length > 0
      ? allocations
      : [{ id: newAllocationId(), kind: 'ignore', amountCents: total }];
  }

  // Outgoing.
  if (!ctx.hasParticipant) {
    return [
      { id: newAllocationId(), kind: 'my_expense', amountCents: total, category: ctx.defaultCategory },
    ];
  }
  const payable = Math.min(total, Math.max(0, ctx.debtToPersonCents));
  const allocations: WiseAllocation[] = [];
  if (payable > 0) {
    allocations.push({ id: newAllocationId(), kind: 'pay_debt', amountCents: payable });
  }
  const rest = total - payable;
  if (rest > 0) {
    allocations.push({
      id: newAllocationId(),
      kind: 'person_paid_expense',
      amountCents: rest,
      category: ctx.defaultCategory,
    });
  }
  return allocations;
}
