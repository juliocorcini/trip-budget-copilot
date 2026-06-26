import { v4 as uuidv4 } from 'uuid';
import { splitEqually, sumCents } from '@/domain/money';
import type { ImageRef } from '@/domain/media';
import { isGroupObligationClosed } from './group-payment-status';
import type {
  GroupBalance,
  GroupExpense,
  GroupExpenseLineItem,
  GroupExpenseSource,
  GroupParticipant,
  GroupParticipantKind,
  GroupPaymentStatus,
  GroupSplitEvent,
  GroupSplitMode,
  GroupTransfer,
} from './types';

/* ── factories ───────────────────────────────────────────────────────────── */

export interface CreateGroupParticipantInput {
  name: string;
  kind?: GroupParticipantKind;
  linkedParticipantId?: string | null;
}

export function createGroupParticipant(input: CreateGroupParticipantInput): GroupParticipant {
  return {
    id: uuidv4(),
    name: input.name.trim(),
    kind: input.kind ?? 'manual',
    linkedParticipantId: input.linkedParticipantId ?? null,
    claimedByActorId: null,
    paymentStatus: 'unpaid',
  };
}

export interface CreateGroupSplitEventInput {
  name: string;
  currency: string;
  ownerName: string;
  tripId?: string | null;
  /** Owner's trip Participant id (for settle-up sync), when known. */
  ownerLinkedParticipantId?: string | null;
}

/** A fresh event seeded with the creator as the owner participant. */
export function createGroupSplitEvent(input: CreateGroupSplitEventInput): GroupSplitEvent {
  const owner: GroupParticipant = {
    ...createGroupParticipant({
      name: input.ownerName,
      kind: 'owner',
      linkedParticipantId: input.ownerLinkedParticipantId ?? null,
    }),
  };
  return {
    id: uuidv4(),
    name: input.name.trim(),
    currency: input.currency,
    tripId: input.tripId ?? null,
    ownerParticipantId: owner.id,
    participants: [owner],
    expenses: [],
    status: 'open',
    createdAt: new Date().toISOString(),
  };
}

export interface AddGroupExpenseInput {
  description: string;
  amountCents: number;
  paidByParticipantId: string;
  splitMode: GroupSplitMode;
  participantIds: string[];
  customAmountsCents?: Record<string, number>;
  category?: string;
  source?: GroupExpenseSource;
  /** DEC-336 — when the expense happened (YYYY-MM-DD). */
  occurredAt?: string;
  /** DEC-336 — who registered it (a participant id). */
  createdByParticipantId?: string;
  /** DEC-337 — receipt lines this expense was built from. */
  items?: GroupExpenseLineItem[];
}

/** Builds a new expense (pure; id + timestamp generated). Optional date/registrant/items are additive. */
export function buildGroupExpense(input: AddGroupExpenseInput): GroupExpense {
  const expense: GroupExpense = {
    id: uuidv4(),
    description: input.description.trim(),
    amountCents: input.amountCents,
    paidByParticipantId: input.paidByParticipantId,
    splitMode: input.splitMode,
    participantIds: [...input.participantIds],
    customAmountsCents: input.customAmountsCents ? { ...input.customAmountsCents } : {},
    category: input.category ?? 'other',
    source: input.source ?? 'manual',
    createdAt: new Date().toISOString(),
  };
  if (input.occurredAt) expense.occurredAt = input.occurredAt;
  if (input.createdByParticipantId) expense.createdByParticipantId = input.createdByParticipantId;
  if (input.items && input.items.length > 0) expense.items = input.items.map((it) => ({ ...it }));
  return expense;
}

/**
 * DEC-348 (G2) — the canonical read of an expense's images, unifying the new
 * multi-photo {@link GroupExpense.imageRefs} (F08) with the LEGACY single
 * {@link GroupExpense.imageRef} (E2E, 1.2.4-rc). Always prefer `imageRefs` when
 * present; otherwise wrap the legacy single ref; otherwise none. Pure — every
 * surface (owner detail, `/g/` board, bill-split) renders from this.
 */
export function groupExpenseImages(expense: GroupExpense): ImageRef[] {
  if (expense.imageRefs && expense.imageRefs.length > 0) return expense.imageRefs;
  if (expense.imageRef) return [expense.imageRef];
  return [];
}

/* ── immutable mutations ─────────────────────────────────────────────────── */

export function addParticipant(event: GroupSplitEvent, participant: GroupParticipant): GroupSplitEvent {
  return { ...event, participants: [...event.participants, participant] };
}

/**
 * Removes a participant only when it is safe: never the owner, and never someone
 * who still appears in an expense (as payer or sharer). Returns the event
 * unchanged when the removal is unsafe (the caller surfaces the reason).
 */
export function removeParticipant(event: GroupSplitEvent, participantId: string): GroupSplitEvent {
  if (participantId === event.ownerParticipantId) return event;
  if (!canRemoveParticipant(event, participantId)) return event;
  return { ...event, participants: event.participants.filter((p) => p.id !== participantId) };
}

export function canRemoveParticipant(event: GroupSplitEvent, participantId: string): boolean {
  if (participantId === event.ownerParticipantId) return false;
  return !event.expenses.some(
    (e) => e.paidByParticipantId === participantId || e.participantIds.includes(participantId),
  );
}

export function addExpense(event: GroupSplitEvent, expense: GroupExpense): GroupSplitEvent {
  return { ...event, expenses: [...event.expenses, expense] };
}

export function updateExpense(event: GroupSplitEvent, expense: GroupExpense): GroupSplitEvent {
  return {
    ...event,
    expenses: event.expenses.map((e) => (e.id === expense.id ? expense : e)),
  };
}

/**
 * Remove an expense. A guest-AUTHORED expense (DEC-340) is also **tombstoned**
 * (`hiddenExpenseIds`) so a guest's stale snapshot can't re-fold it — the owner is
 * the authority and removal sticks (hide-never-delete). Owner-authored expenses
 * just drop (nothing re-posts them).
 */
export function removeExpense(event: GroupSplitEvent, expenseId: string): GroupSplitEvent {
  const target = event.expenses.find((e) => e.id === expenseId);
  const expenses = event.expenses.filter((e) => e.id !== expenseId);
  if (target?.authoredByActorId) {
    const hiddenExpenseIds = [...new Set([...(event.hiddenExpenseIds ?? []), expenseId])];
    return { ...event, expenses, hiddenExpenseIds };
  }
  return { ...event, expenses };
}

export function setParticipantPayment(
  event: GroupSplitEvent,
  participantId: string,
  paymentStatus: GroupParticipant['paymentStatus'],
): GroupSplitEvent {
  return {
    ...event,
    participants: event.participants.map((p) =>
      p.id === participantId ? { ...p, paymentStatus } : p,
    ),
  };
}

/** Binds a guest device (actorId) + chosen name to a participant slot (claim). */
export function claimParticipant(
  event: GroupSplitEvent,
  participantId: string,
  actorId: string,
): GroupSplitEvent {
  return {
    ...event,
    participants: event.participants.map((p) =>
      p.id === participantId ? { ...p, claimedByActorId: actorId } : p,
    ),
  };
}

/* ── pure math (Â11) ─────────────────────────────────────────────────────── */

/**
 * One expense's per-participant shares in cents. Equal = `splitEqually` (remainder
 * spread deterministically); custom = the given amounts with any rounding/short
 * remainder absorbed by the payer (or the first sharer) so Σ shares == amount.
 */
export function expenseShares(expense: GroupExpense): Record<string, number> {
  const ids = expense.participantIds;
  const out: Record<string, number> = {};
  if (ids.length === 0) return out;

  if (expense.splitMode === 'equal') {
    const amounts = splitEqually(expense.amountCents, ids.length);
    ids.forEach((id, i) => {
      out[id] = amounts[i]!;
    });
    return out;
  }

  let allocated = 0;
  for (const id of ids) {
    const cents = Math.max(0, Math.round(expense.customAmountsCents[id] ?? 0));
    out[id] = cents;
    allocated += cents;
  }
  const remainder = expense.amountCents - allocated;
  if (remainder !== 0) {
    const absorber = ids.includes(expense.paidByParticipantId) ? expense.paidByParticipantId : ids[0]!;
    out[absorber] = (out[absorber] ?? 0) + remainder;
  }
  return out;
}

export function groupTotalCents(event: GroupSplitEvent): number {
  return sumCents(event.expenses.map((e) => e.amountCents));
}

/* ── day grouping (DEC-336 / A12) ────────────────────────────────────────── */

/**
 * The calendar day (`YYYY-MM-DD`) a group expense is filed under: the chosen
 * `occurredAt`, else the day it was logged (`createdAt`). Pure + deterministic
 * (slices the stored ISO/date string — no timezone math).
 */
export function groupExpenseDayKey(expense: GroupExpense): string {
  return (expense.occurredAt ?? expense.createdAt).slice(0, 10);
}

export interface GroupExpenseDay {
  /** `YYYY-MM-DD`. */
  day: string;
  expenses: GroupExpense[];
}

/**
 * Buckets expenses by their effective calendar day (`groupExpenseDayKey`), oldest
 * day first, preserving each expense's relative order within a day. The UI renders
 * day headers only when there is more than one bucket (a single-day event stays a
 * flat list). Exposure only — never touches amounts or balances (data-invariance).
 */
export function groupExpensesByDay(expenses: GroupExpense[]): GroupExpenseDay[] {
  const byDay = new Map<string, GroupExpense[]>();
  for (const expense of expenses) {
    const day = groupExpenseDayKey(expense);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(expense);
    else byDay.set(day, [expense]);
  }
  return [...byDay.keys()].sort().map((day) => ({ day, expenses: byDay.get(day)! }));
}

/**
 * Per-person paid / share / net across the whole event. `net = paid − share`:
 * positive means the group owes this person, negative means they owe the group.
 * Σ net over everyone is always 0 (cents are conserved).
 */
export function computeGroupBalances(event: GroupSplitEvent): GroupBalance[] {
  const paid = new Map<string, number>();
  const share = new Map<string, number>();
  for (const p of event.participants) {
    paid.set(p.id, 0);
    share.set(p.id, 0);
  }

  for (const expense of event.expenses) {
    paid.set(expense.paidByParticipantId, (paid.get(expense.paidByParticipantId) ?? 0) + expense.amountCents);
    const shares = expenseShares(expense);
    for (const [pid, cents] of Object.entries(shares)) {
      share.set(pid, (share.get(pid) ?? 0) + cents);
    }
  }

  return event.participants.map((p) => {
    const paidCents = paid.get(p.id) ?? 0;
    const shareCents = share.get(p.id) ?? 0;
    return {
      participantId: p.id,
      name: p.name,
      paidCents,
      shareCents,
      netCents: paidCents - shareCents,
      paymentStatus: p.paymentStatus,
    };
  });
}

/**
 * Minimum-transfer settlement over the net balances: greedily match the biggest
 * debtor with the biggest creditor until everyone is square. Mirrors the trip
 * settle-up's `suggestSimplifiedSettlements` but over the group's own nets.
 */
export function computeGroupTransfers(event: GroupSplitEvent): GroupTransfer[] {
  const balances = computeGroupBalances(event);
  const nameById = new Map(balances.map((b) => [b.participantId, b.name]));

  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ id: b.participantId, cents: -b.netCents }))
    .sort((a, b) => b.cents - a.cents);
  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ id: b.participantId, cents: b.netCents }))
    .sort((a, b) => b.cents - a.cents);

  const transfers: GroupTransfer[] = [];
  let di = 0;
  let ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di]!;
    const creditor = creditors[ci]!;
    const amount = Math.min(debtor.cents, creditor.cents);
    if (amount > 0) {
      transfers.push({
        fromParticipantId: debtor.id,
        fromName: nameById.get(debtor.id) ?? debtor.id,
        toParticipantId: creditor.id,
        toName: nameById.get(creditor.id) ?? creditor.id,
        amountCents: amount,
      });
    }
    debtor.cents -= amount;
    creditor.cents -= amount;
    if (debtor.cents === 0) di++;
    if (creditor.cents === 0) ci++;
  }
  return transfers;
}

/* ── who-paid / who-owes status (F22 / DEC-353) ──────────────────────────── */

/** One suggested transfer plus the debtor's current payment lifecycle state. */
export interface GroupSettlementLine extends GroupTransfer {
  /** The payer's (debtor's) lifecycle state for this obligation. */
  status: GroupPaymentStatus;
}

/** "Quem pagou / quem falta": the transfers, each tagged with its closure state. */
export interface GroupSettlementStatus {
  lines: GroupSettlementLine[];
  /** Obligations the receiver has confirmed (closed). */
  settledCount: number;
  /** Obligations still open (pending / marked-awaiting / contested). */
  pendingCount: number;
}

/**
 * The settle-up status view (F22): each minimum-transfer obligation tagged with
 * the debtor's payment lifecycle state, plus settled/pending counts. Pure — reads
 * the same transfers the settle panel shows and the per-person `paymentStatus`;
 * only a `confirmed` debtor counts as settled (DEC-353 — a `marked` payment is
 * still awaiting the receiver and never counts the payer as done).
 */
export function buildGroupSettlementStatus(event: GroupSplitEvent): GroupSettlementStatus {
  const transfers = computeGroupTransfers(event);
  const statusById = new Map(event.participants.map((p) => [p.id, p.paymentStatus]));
  const lines: GroupSettlementLine[] = transfers.map((tr) => ({
    ...tr,
    status: statusById.get(tr.fromParticipantId) ?? 'unpaid',
  }));
  const settledCount = lines.filter((l) => isGroupObligationClosed(l.status)).length;
  return { lines, settledCount, pendingCount: lines.length - settledCount };
}

/** True when there is at least one expense and every net balance is zero. */
export function isGroupSettled(event: GroupSplitEvent): boolean {
  if (event.expenses.length === 0) return false;
  return computeGroupBalances(event).every((b) => b.netCents === 0);
}

export function setGroupStatus(event: GroupSplitEvent, status: GroupSplitEvent['status']): GroupSplitEvent {
  return { ...event, status };
}

/**
 * True when every debtor (negative net) has confirmed their payment — the signal
 * the owner uses to close the event (DEC-297). Creditors and zero-net people are
 * ignored; an event with no debtors (nothing owed) is considered fully paid.
 */
export function everyDebtorConfirmed(event: GroupSplitEvent): boolean {
  const balances = computeGroupBalances(event);
  const debtors = balances.filter((b) => b.netCents < 0);
  if (debtors.length === 0) return event.expenses.length > 0;
  const statusById = new Map(event.participants.map((p) => [p.id, p.paymentStatus]));
  return debtors.every((b) => statusById.get(b.participantId) === 'confirmed');
}

/* ── validation ──────────────────────────────────────────────────────────── */

export type GroupExpenseError =
  | 'empty_description'
  | 'non_positive_amount'
  | 'no_payer'
  | 'no_participants'
  | 'custom_mismatch';

/**
 * Validates an expense input against the event. Custom splits must add up to the
 * amount (within a 1-cent-per-sharer rounding budget the payer can absorb).
 */
export function validateGroupExpense(
  event: GroupSplitEvent,
  input: AddGroupExpenseInput,
): GroupExpenseError | null {
  if (input.description.trim().length === 0) return 'empty_description';
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) return 'non_positive_amount';
  const ids = new Set(event.participants.map((p) => p.id));
  if (!ids.has(input.paidByParticipantId)) return 'no_payer';
  const sharers = input.participantIds.filter((id) => ids.has(id));
  if (sharers.length === 0) return 'no_participants';
  if (input.splitMode === 'custom') {
    const sum = sumCents(sharers.map((id) => Math.max(0, Math.round(input.customAmountsCents?.[id] ?? 0))));
    if (sum > input.amountCents) return 'custom_mismatch';
  }
  return null;
}
