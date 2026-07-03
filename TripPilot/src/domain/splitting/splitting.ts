import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare, ShareConfirmationStatus } from '@/domain/types/participant-share';
import type { Participant } from '@/domain/types/participant';
import type { Settlement } from '@/domain/types/settlement';
import type { DebtMovement } from '@/domain/types/debt-movement';
import type { SettlementMethod } from '@/domain/payment/payment-methods';
import { splitEqually, sumCents } from '@/domain/money';
import { createSyncMetadata } from '@/utils/entity-factory';

export interface DebtEntry {
  debtorId: string;
  debtorName: string;
  creditorId: string;
  creditorName: string;
  amountCents: number;
}

export interface DebtSummary {
  debts: DebtEntry[];
  totalDebtCents: number;
}

export function createEqualShares(
  transactionId: string,
  participantIds: string[],
  totalCents: number,
): ParticipantShare[] {
  const amounts = splitEqually(totalCents, participantIds.length);
  return participantIds.map((pid, i) => ({
    ...createSyncMetadata(),
    transactionId,
    participantId: pid,
    shareAmountCents: amounts[i]!,
    shareType: 'equal' as const,
    isPaid: false,
    confirmationStatus: 'pending' as const,
    notes: null,
  }));
}

export function createCustomShares(
  transactionId: string,
  shares: { participantId: string; amountCents: number }[],
): ParticipantShare[] {
  return shares.map((s) => ({
    ...createSyncMetadata(),
    transactionId,
    participantId: s.participantId,
    shareAmountCents: s.amountCents,
    shareType: 'custom' as const,
    isPaid: false,
    confirmationStatus: 'pending' as const,
    notes: null,
  }));
}

export interface BuildSharesInput {
  transactionId: string;
  amountCents: number;
  participantIds: string[];
  paidByParticipantId: string;
  shareType: 'equal' | 'custom';
  /** Required for custom splits: participantId → share in cents. */
  customAmountsCents: Record<string, number>;
}

/**
 * Builds the final share set for a shared expense: equal or custom split,
 * unallocated remainder absorbed by the payer, payer marked as paid.
 */
export function buildSharesWithPayer(input: BuildSharesInput): ParticipantShare[] {
  const shares =
    input.shareType === 'equal'
      ? createEqualShares(input.transactionId, input.participantIds, input.amountCents)
      : (() => {
          const custom = input.participantIds.map((pid) => ({
            participantId: pid,
            amountCents: input.customAmountsCents[pid] ?? 0,
          }));
          const sum = sumCents(custom.map((s) => s.amountCents));
          const diff = input.amountCents - sum;
          if (diff !== 0) {
            const payerShare =
              custom.find((s) => s.participantId === input.paidByParticipantId) ?? custom[0]!;
            payerShare.amountCents += diff;
          }
          return createCustomShares(input.transactionId, custom);
        })();

  // DEC-071: the creator/payer's share is born confirmed; third parties pending.
  return shares.map((s) =>
    s.participantId === input.paidByParticipantId
      ? { ...s, isPaid: true, confirmationStatus: 'confirmed' as const }
      : s,
  );
}

export function calculatePersonalCost(
  shares: ParticipantShare[],
  ownerId: string,
): number {
  const ownerShare = shares.find((s) => s.participantId === ownerId);
  return ownerShare?.shareAmountCents ?? 0;
}

/**
 * DEC-241 (DL-1): the birth confirmation status of a freshly OWNER-authored share.
 *
 * The debt is real from the OWNER's ledger the instant they register it
 * (DEC-106: the owner is the source of truth), so a person who is NOT connected
 * — no paired device, no live channel that could ever answer — owes immediately
 * and their share is born `confirmed`. A share stays `pending` ONLY for a
 * CONNECTED counterparty (paired device / active live link, DEC-071/106), whose
 * accept/reject genuinely flows back through the mirror. The payer/owner is
 * always `confirmed`.
 */
export function resolveShareBirthStatus(
  participantId: string,
  isPayerOrOwner: boolean,
  connectedParticipantIds: ReadonlySet<string>,
): ShareConfirmationStatus {
  if (isPayerOrOwner) return 'confirmed';
  return connectedParticipantIds.has(participantId) ? 'pending' : 'confirmed';
}

/**
 * C11 / DEC-304 — the per-share lifecycle in ONE honest stage, so the settle-up
 * screen shows where each person is in the whole cycle (accept → pay) instead of
 * a `confirmationStatus` pill that goes silent once a share is marked paid.
 * Derived purely from the two facts a share already carries: whether the
 * counterparty accepted (`confirmationStatus`) and whether it was paid (`isPaid`).
 *
 *  - rejected  — the counterparty declined the share.
 *  - pending   — waiting for a connected counterparty to accept.
 *  - confirmed — accepted (the debt stands) but not yet paid.
 *  - paid      — accepted AND marked paid — the only "done" stage.
 *
 * `isPaid` graduates only an otherwise-live share: a rejected share is never paid.
 */
export type ShareStage = 'rejected' | 'pending' | 'confirmed' | 'paid';

export function resolveShareStage(share: {
  confirmationStatus: ShareConfirmationStatus;
  isPaid: boolean;
}): ShareStage {
  if (share.confirmationStatus === 'rejected') return 'rejected';
  if (share.confirmationStatus === 'pending') return 'pending';
  return share.isPaid ? 'paid' : 'confirmed';
}

/* ── DEC-114 (R-04): universal payer semantics — the truth table ────────── */

export interface PayerExpenseInput {
  transactionId: string;
  amountCents: number;
  ownerId: string;
  /** Who actually handed over the money. */
  payerId: string;
  /** True when the cost is divided among participants. */
  didSplit: boolean;
  /** Everyone with a part when splitting (owner included when they have one). */
  participantIds: string[];
  shareType: 'equal' | 'custom';
  customAmountsCents: Record<string, number>;
  /**
   * DEC-241 (DL-1): ids whose share must stay `pending` because they are
   * CONNECTED (paired device / live link) and can answer through the mirror.
   * Everyone else's share is born `confirmed` (the debt is real immediately).
   * Defaults to none → every non-payer share is born confirmed.
   */
  connectedParticipantIds?: readonly string[];
}

export interface PayerExpenseResolution {
  shares: ParticipantShare[];
  /** What this expense costs ME (DEC-114 truth table). */
  personalCostCents: number;
  /** False = my wallet is NOT moved (someone else handed over the money). */
  movesOwnerWallet: boolean;
  isShared: boolean;
}

/**
 * DEC-114: registering an expense = registering MY COST. "Someone else paid"
 * NEVER means a gift — it creates a debt to the payer. Single source of truth
 * for every flow that marks a payer (QuickAdd, outing stepper, outing split).
 *
 * | payer | split | personal cost | debt                   | owner wallet |
 * |-------|-------|---------------|------------------------|--------------|
 * | me    | no    | total         | —                      | debited      |
 * | me    | yes   | my share      | others owe me theirs   | debited      |
 * | other | yes   | my share      | I owe MY SHARE         | not moved    |
 * | other | no    | TOTAL         | I owe the TOTAL        | not moved    |
 */
export function resolvePayerExpense(input: PayerExpenseInput): PayerExpenseResolution {
  const ownerPaid = input.payerId === input.ownerId;

  if (ownerPaid && !input.didSplit) {
    return {
      shares: [],
      personalCostCents: input.amountCents,
      movesOwnerWallet: true,
      isShared: false,
    };
  }

  // Truth-table row 4: someone else paid and nothing was split — the whole
  // thing is mine, so the single share is MY debt for the FULL amount.
  const participantIds = input.didSplit ? input.participantIds : [input.ownerId];

  const built = buildSharesWithPayer({
    transactionId: input.transactionId,
    amountCents: input.amountCents,
    participantIds,
    paidByParticipantId: input.payerId,
    shareType: input.didSplit ? input.shareType : 'equal',
    customAmountsCents: input.customAmountsCents,
  });

  // DEC-114 + DEC-071 + DEC-241 (DL-1): the OWNER registers the expense, so the
  // debt is real on THEIR ledger immediately. The owner's own share and every
  // NON-connected third party are born confirmed; only a connected counterparty
  // (paired device / live link) stays pending until they answer the mirror.
  const connected = new Set(input.connectedParticipantIds ?? []);
  const shares = built.map((s) => {
    const isPayerOrOwner = s.participantId === input.payerId || s.participantId === input.ownerId;
    return { ...s, confirmationStatus: resolveShareBirthStatus(s.participantId, isPayerOrOwner, connected) };
  });

  return {
    shares,
    personalCostCents: calculatePersonalCost(shares, input.ownerId),
    movesOwnerWallet: ownerPaid,
    isShared: true,
  };
}

/** DEC-114: true when the expense moved the owner's own money. */
export function isPaidByOwner(
  transaction: Pick<Transaction, 'paidByParticipantId'>,
  ownerId: string | null,
): boolean {
  return (
    transaction.paidByParticipantId === null || transaction.paidByParticipantId === ownerId
  );
}

export function calculateDebts(
  transactions: Transaction[],
  shares: ParticipantShare[],
  participants: Participant[],
  settlements: Settlement[],
  ownerId: string,
): DebtSummary {
  const balances = new Map<string, number>();
  participants.forEach((p) => balances.set(p.id, 0));

  const sharedTxs = transactions.filter(
    (t) => t.isShared && t.type === 'expense' && t.deletedAt === null,
  );

  for (const tx of sharedTxs) {
    const payerId = tx.paidByParticipantId ?? ownerId;
    // DEC-071: only confirmed shares consolidate into debts. Pending shares
    // wait for confirmation; rejected shares return to the payer's own cost.
    const txShares = shares.filter(
      (s) =>
        s.transactionId === tx.id &&
        s.deletedAt === null &&
        s.confirmationStatus === 'confirmed',
    );

    for (const share of txShares) {
      if (share.participantId !== payerId) {
        const current = balances.get(share.participantId) ?? 0;
        balances.set(share.participantId, current - share.shareAmountCents);

        const payerCurrent = balances.get(payerId) ?? 0;
        balances.set(payerId, payerCurrent + share.shareAmountCents);
      }
    }
  }

  for (const settlement of settlements.filter((s) => s.deletedAt === null)) {
    const debtorBal = balances.get(settlement.debtorParticipantId) ?? 0;
    balances.set(settlement.debtorParticipantId, debtorBal + settlement.amountCents);

    const creditorBal = balances.get(settlement.creditorParticipantId) ?? 0;
    balances.set(settlement.creditorParticipantId, creditorBal - settlement.amountCents);
  }

  const participantMap = new Map(participants.map((p) => [p.id, p]));
  const debts: DebtEntry[] = [];

  // BUG-003 (R6-03): allocate against MUTABLE remaining credits so no creditor
  // is ever assigned more than their net balance across multiple debtors.
  const creditors = [...balances.entries()]
    .filter(([, b]) => b > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, b]) => ({ id, remainingCents: b }));

  for (const [pid, balance] of balances) {
    if (balance >= 0) continue;

    let remaining = Math.abs(balance);
    for (const creditor of creditors) {
      if (remaining <= 0) break;
      const amount = Math.min(remaining, creditor.remainingCents);
      if (amount > 0) {
        debts.push({
          debtorId: pid,
          debtorName: participantMap.get(pid)?.name ?? pid,
          creditorId: creditor.id,
          creditorName: participantMap.get(creditor.id)?.name ?? creditor.id,
          amountCents: amount,
        });
        remaining -= amount;
        creditor.remainingCents -= amount;
      }
    }
  }

  return {
    debts,
    totalDebtCents: sumCents(debts.map((d) => d.amountCents)),
  };
}

/** G2 (DEC-241 · DL-3): one side of the owner's settle-up — a counterparty
 * and how much sits between them. */
export interface OwnerDebtCounterparty {
  participantId: string;
  name: string;
  amountCents: number;
}

/**
 * G2 (DEC-241 · DL-3/DL-4): the owner-centric reading of the simplified debt
 * graph from `calculateDebts` — how much is owed TO the owner (receivable),
 * how much the owner owes (payable), the net, and the per-person breakdown for
 * each side (sorted by amount desc). Pure derivation, no new state: it drives
 * the "Acerto de contas" summary hero and the home "te devem / você deve" card.
 */
export interface OwnerDebtSummary {
  receivableCents: number;
  payableCents: number;
  netCents: number;
  receivableFrom: OwnerDebtCounterparty[];
  payableTo: OwnerDebtCounterparty[];
}

export function summarizeOwnerDebts(
  debts: readonly DebtEntry[],
  ownerId: string,
): OwnerDebtSummary {
  const receivableFrom: OwnerDebtCounterparty[] = [];
  const payableTo: OwnerDebtCounterparty[] = [];
  let receivableCents = 0;
  let payableCents = 0;

  for (const debt of debts) {
    if (debt.amountCents <= 0) continue;
    if (debt.creditorId === ownerId) {
      receivableCents += debt.amountCents;
      receivableFrom.push({
        participantId: debt.debtorId,
        name: debt.debtorName,
        amountCents: debt.amountCents,
      });
    } else if (debt.debtorId === ownerId) {
      payableCents += debt.amountCents;
      payableTo.push({
        participantId: debt.creditorId,
        name: debt.creditorName,
        amountCents: debt.amountCents,
      });
    }
  }

  receivableFrom.sort((a, b) => b.amountCents - a.amountCents);
  payableTo.sort((a, b) => b.amountCents - a.amountCents);

  return {
    receivableCents,
    payableCents,
    netCents: receivableCents - payableCents,
    receivableFrom,
    payableTo,
  };
}

/**
 * DEC-388 (G6 · S-EGO) — debts between two people who are BOTH not the owner,
 * surfaced only because the owner RECORDED the expense. The ego-centric settle
 * screen keeps these OUT of the owner's main list (which answers "what is MINE?")
 * and lists them in a separate display-only "charges I recorded between others"
 * registry — so a third-party debt is never shown as the owner's debt, yet never
 * vanishes either (A4). Pure partition of the very same `calculateDebts` graph
 * the hero reads (`summarizeOwnerDebts`), so the settle math stays invariant:
 * `ownerInvolvedDebts ∪ thirdPartyDebts` = every positive debt, nothing lost or
 * double-counted.
 */
export function thirdPartyDebts(
  debts: readonly DebtEntry[],
  ownerId: string,
): DebtEntry[] {
  return debts.filter(
    (d) => d.amountCents > 0 && d.debtorId !== ownerId && d.creditorId !== ownerId,
  );
}

/**
 * DEC-388 (G6 · S-EGO) — the complement of `thirdPartyDebts`: every debt the
 * owner is a party to (owner is the debtor or the creditor). Drives the
 * ego-centric main settle list; its owner-net is identical to the baseline
 * (`summarizeOwnerDebts` reads owner-involved edges only), so the hero/home
 * arithmetic is untouched.
 */
export function ownerInvolvedDebts(
  debts: readonly DebtEntry[],
  ownerId: string,
): DebtEntry[] {
  return debts.filter(
    (d) => d.amountCents > 0 && (d.debtorId === ownerId || d.creditorId === ownerId),
  );
}

/**
 * M18 (DEC-294) — the group-wide settle-up standing that drives the "tudo
 * acertado ✓" seal. `allSettled` is true ONLY when real splitting happened (a
 * shared expense or a recorded settlement exists) AND no debt is left
 * outstanding — so a brand-new trip with nothing split never shows a misleading
 * "all settled" badge, and the seal appears exactly when the balance zeros.
 */
export interface SettlementStanding {
  hasActivity: boolean;
  outstandingCents: number;
  allSettled: boolean;
}

export function resolveSettlementStanding(
  debts: readonly DebtEntry[],
  sharedExpenseCount: number,
  settlementCount: number,
): SettlementStanding {
  const outstandingCents = debts.reduce(
    (sum, debt) => sum + (debt.amountCents > 0 ? debt.amountCents : 0),
    0,
  );
  const hasActivity = sharedExpenseCount > 0 || settlementCount > 0;
  return {
    hasActivity,
    outstandingCents,
    allSettled: hasActivity && outstandingCents === 0,
  };
}

export function createSettlement(
  tripId: string,
  debtorId: string,
  creditorId: string,
  amountCents: number,
  currency: string,
  // FB-27 (DEC-277): optional structured repayment method. Trailing + defaulted
  // so the existing call sites (and the Wise import) stay byte-identical.
  method: SettlementMethod | null = null,
): Settlement {
  return {
    ...createSyncMetadata(),
    tripId,
    debtorParticipantId: debtorId,
    creditorParticipantId: creditorId,
    amountCents,
    currency,
    settledAt: new Date().toISOString(),
    linkedTransactionId: null,
    notes: null,
    method,
  };
}

/**
 * Reduce a set of pairwise debts to the minimum number of transfers (GAP-032).
 * Computes the net balance per participant, then greedily matches the largest
 * debtor with the largest creditor until every balance is zero.
 */
export function suggestSimplifiedSettlements(debts: DebtEntry[]): DebtEntry[] {
  const balances = new Map<string, { name: string; cents: number }>();
  const ensure = (id: string, name: string) => {
    if (!balances.has(id)) balances.set(id, { name, cents: 0 });
    return balances.get(id)!;
  };

  for (const debt of debts) {
    if (debt.amountCents <= 0) continue;
    ensure(debt.debtorId, debt.debtorName).cents -= debt.amountCents;
    ensure(debt.creditorId, debt.creditorName).cents += debt.amountCents;
  }

  const debtors = [...balances.entries()]
    .filter(([, b]) => b.cents < 0)
    .map(([id, b]) => ({ id, name: b.name, cents: -b.cents }))
    .sort((a, b) => b.cents - a.cents);
  const creditors = [...balances.entries()]
    .filter(([, b]) => b.cents > 0)
    .map(([id, b]) => ({ id, name: b.name, cents: b.cents }))
    .sort((a, b) => b.cents - a.cents);

  const result: DebtEntry[] = [];
  let di = 0;
  let ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di]!;
    const creditor = creditors[ci]!;
    const amount = Math.min(debtor.cents, creditor.cents);
    result.push({
      debtorId: debtor.id,
      debtorName: debtor.name,
      creditorId: creditor.id,
      creditorName: creditor.name,
      amountCents: amount,
    });
    debtor.cents -= amount;
    creditor.cents -= amount;
    if (debtor.cents === 0) di++;
    if (creditor.cents === 0) ci++;
  }
  return result;
}

export function createParticipant(
  tripId: string,
  name: string,
  nickname: string | null,
): Participant {
  return {
    ...createSyncMetadata(),
    tripId,
    name,
    nickname,
    isOwner: false,
    email: null,
    linkedUserAccountId: null,
    linkedActorId: null,
  };
}

/**
 * Rescale shares proportionally to a new transaction total.
 * The last share absorbs rounding so the sum always matches the total.
 */
export function scaleSharesToTotal(
  shares: ParticipantShare[],
  newTotalCents: number,
): ParticipantShare[] {
  if (shares.length === 0) return shares;
  const oldTotal = sumCents(shares.map((s) => s.shareAmountCents));
  if (oldTotal === 0) return shares;

  let allocated = 0;
  return shares.map((share, i) => {
    const isLast = i === shares.length - 1;
    const amount = isLast
      ? newTotalCents - allocated
      : Math.round((share.shareAmountCents / oldTotal) * newTotalCents);
    allocated += amount;
    return { ...share, shareAmountCents: amount };
  });
}

export interface PendingShareEntry {
  share: ParticipantShare;
  transaction: Transaction;
}

/**
 * DEC-071 (supersedes DEC-063/GAP-016): the dashboard card counts third-party
 * shares awaiting confirmation. It disappears when every share is confirmed —
 * regardless of netting or settlements.
 */
export function findPendingConfirmationShares(
  transactions: Transaction[],
  shares: ParticipantShare[],
  ownerId: string,
): PendingShareEntry[] {
  const txById = new Map(
    transactions
      .filter((tx) => tx.isShared && tx.type === 'expense' && tx.deletedAt === null)
      .map((tx) => [tx.id, tx]),
  );

  return shares
    .filter((s) => s.deletedAt === null && s.confirmationStatus === 'pending')
    .flatMap((share) => {
      const transaction = txById.get(share.transactionId);
      if (!transaction) return [];
      const payerId = transaction.paidByParticipantId ?? ownerId;
      if (share.participantId === payerId) return [];
      return [{ share, transaction }];
    });
}

/**
 * DEC-071: the owner's effective personal cost on a shared expense.
 * - Owner paid: total minus third-party shares that were not rejected
 *   (a rejected share returns its value to the payer's personal cost).
 * - Someone else paid: the owner's own non-rejected share.
 */
export function calculateOwnerPersonalCost(
  transaction: Transaction,
  txShares: ParticipantShare[],
  ownerId: string,
): number {
  const payerId = transaction.paidByParticipantId ?? ownerId;
  const active = txShares.filter((s) => s.deletedAt === null);

  if (payerId === ownerId) {
    const thirdPartyKept = active.filter(
      (s) => s.participantId !== ownerId && s.confirmationStatus !== 'rejected',
    );
    return transaction.amountCents - sumCents(thirdPartyKept.map((s) => s.shareAmountCents));
  }

  const ownShare = active.find((s) => s.participantId === ownerId);
  if (!ownShare || ownShare.confirmationStatus === 'rejected') return 0;
  return ownShare.shareAmountCents;
}

/* ── DEC-102 (R-25): per-participant statement ───────────────────────── */

export type StatementLineKind = 'owes' | 'is_owed';

export interface StatementLine {
  kind: StatementLineKind;
  transactionId: string;
  /**
   * DEC-206: the outing/receipt session that owns this expense, or null for a
   * standalone one. Lets the settle-up statement collapse a 40-item receipt into
   * ONE expandable "event" row instead of 40 unreadable lines (device-test
   * 2026-06-20). Display-only — the math (amounts, net) is unchanged.
   */
  sessionId: string | null;
  description: string | null;
  category: string | null;
  subcategoryId: string | null;
  occurredAt: string;
  /** The participant's slice of this expense (always positive). */
  amountCents: number;
  /** The other side of the line: payer (owes) or debtor (is_owed). */
  counterpartyId: string;
  counterpartyName: string;
  confirmationStatus: ParticipantShare['confirmationStatus'];
  /** C11/DEC-304: whether this share was marked paid — feeds the lifecycle stage. */
  isPaid: boolean;
  /**
   * DEC-402 (G3): where the expense happened — copied off the transaction (like
   * description/category) so a shared statement can show each item's place/detail.
   * Display-only; the math (amounts, net) is unchanged.
   */
  placeLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  /**
   * DEC-414 (G6): when this line's share was MOVED here from another person, the
   * origin's id + name — so the recipient's statement shows "moved from {name}".
   * Null when the share was never reassigned. Display-only; the math is unchanged.
   */
  reassignedFromId: string | null;
  reassignedFromName: string | null;
}

export interface ParticipantStatement {
  participantId: string;
  lines: StatementLine[];
  /** Settlements involving the participant, applied to the net. */
  settlements: Settlement[];
  /** Net balance from CONFIRMED lines + settlements: negative = owes. */
  netCents: number;
}

/**
 * DEC-102 (R-25): traces a participant's balance item by item — every share
 * that moves their balance (what they owe payers, what others owe them) plus
 * the settlements already applied. The net from confirmed lines matches
 * `calculateDebts`' balance for the same inputs.
 */
export function buildParticipantStatement(
  participantId: string,
  transactions: Transaction[],
  shares: ParticipantShare[],
  participants: Participant[],
  settlements: Settlement[],
  ownerId: string,
): ParticipantStatement {
  const nameById = new Map(participants.map((p) => [p.id, p.nickname ?? p.name]));
  const lines: StatementLine[] = [];

  const sharedTxs = transactions.filter(
    (t) => t.isShared && t.type === 'expense' && t.deletedAt === null,
  );

  for (const tx of sharedTxs) {
    const payerId = tx.paidByParticipantId ?? ownerId;
    const txShares = shares.filter(
      (s) =>
        s.transactionId === tx.id &&
        s.deletedAt === null &&
        s.confirmationStatus !== 'rejected',
    );

    for (const share of txShares) {
      if (share.participantId === payerId) continue;
      const base = {
        transactionId: tx.id,
        sessionId: tx.sessionId,
        description: tx.description,
        category: tx.category,
        subcategoryId: tx.subcategoryId,
        occurredAt: tx.date,
        amountCents: share.shareAmountCents,
        confirmationStatus: share.confirmationStatus,
        isPaid: share.isPaid,
        // DEC-402 (G3): expense location rides with the line (display-only).
        placeLabel: tx.placeLabel,
        latitude: tx.latitude,
        longitude: tx.longitude,
        placeId: tx.placeId,
        // DEC-414 (G6): the "moved from {name}" trail rides with the line.
        // DEC-451: fall back to the carried name when the origin person does
        // not exist on THIS device (moved-in debt) or was removed later.
        reassignedFromId: share.reassignedFrom ?? null,
        reassignedFromName: share.reassignedFrom
          ? (nameById.get(share.reassignedFrom) ?? share.reassignedFromName ?? null)
          : (share.reassignedFromName ?? null),
      };
      if (share.participantId === participantId) {
        lines.push({
          ...base,
          kind: 'owes',
          counterpartyId: payerId,
          counterpartyName: nameById.get(payerId) ?? payerId,
        });
      } else if (payerId === participantId) {
        lines.push({
          ...base,
          kind: 'is_owed',
          counterpartyId: share.participantId,
          counterpartyName: nameById.get(share.participantId) ?? share.participantId,
        });
      }
    }
  }

  lines.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const ownSettlements = settlements.filter(
    (s) =>
      s.deletedAt === null &&
      (s.debtorParticipantId === participantId || s.creditorParticipantId === participantId),
  );

  const confirmedNet = sumCents(
    lines
      .filter((l) => l.confirmationStatus === 'confirmed')
      .map((l) => (l.kind === 'owes' ? -l.amountCents : l.amountCents)),
  );
  const settlementNet = sumCents(
    ownSettlements.map((s) =>
      s.debtorParticipantId === participantId ? s.amountCents : -s.amountCents,
    ),
  );

  return {
    participantId,
    lines,
    settlements: ownSettlements,
    netCents: confirmedNet + settlementNet,
  };
}

/**
 * DEC-394 (G4 · S-EGO-PEOPLE) — narrow a participant's statement to the lines and
 * settlements that involve ONE counterparty (the owner). Opening a person in
 * "Pessoas" then shows only what is between THEM and me — never a line about a
 * debt they have with a third party that I merely recorded. The net is recomputed
 * from the kept confirmed lines + settlements, so it equals that person's
 * `ownerPairwiseBalances` entry (same sign: negative = they owe).
 */
export function filterStatementToCounterparty(
  statement: ParticipantStatement,
  counterpartyId: string,
): ParticipantStatement {
  const lines = statement.lines.filter((l) => l.counterpartyId === counterpartyId);
  const settlements = statement.settlements.filter(
    (s) =>
      s.debtorParticipantId === counterpartyId || s.creditorParticipantId === counterpartyId,
  );
  const confirmedNet = sumCents(
    lines
      .filter((l) => l.confirmationStatus === 'confirmed')
      .map((l) => (l.kind === 'owes' ? -l.amountCents : l.amountCents)),
  );
  const settlementNet = sumCents(
    settlements.map((s) =>
      s.debtorParticipantId === statement.participantId ? s.amountCents : -s.amountCents,
    ),
  );
  return {
    participantId: statement.participantId,
    lines,
    settlements,
    netCents: confirmedNet + settlementNet,
  };
}

/** Net balance per participant: positive = is owed money, negative = owes money. */
export function calculateParticipantBalances(debts: DebtEntry[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const debt of debts) {
    balances.set(debt.debtorId, (balances.get(debt.debtorId) ?? 0) - debt.amountCents);
    balances.set(debt.creditorId, (balances.get(debt.creditorId) ?? 0) + debt.amountCents);
  }
  return balances;
}

/**
 * DEC-394 (G4 · S-EGO-PEOPLE) — the FAITHFUL pairwise net between the owner and
 * each OTHER person, read straight from confirmed shares + settlements. Unlike
 * `calculateParticipantBalances` (which reads the min-transfer graph, where the
 * owner's debt can be ROUTED through a third party and so land on the wrong
 * person), this keeps only owner↔person edges, so "Pessoas" answers exactly
 * "what is between ME and this person?". Debts between two non-owners are dropped
 * (they live in the third-party registry instead).
 *
 * Sign is the PERSON's, matching `PersonView.balanceCents`: `> 0` they receive
 * (the owner owes them), `< 0` they owe the owner.
 *
 * INVARIANCE (A6): `−Σ balances` equals the owner's net in `calculateDebts` /
 * `summarizeOwnerDebts` (the min-transfer preserves every node's net), so the
 * owner's TOTAL is unchanged — only the per-person attribution becomes faithful.
 */
export function ownerPairwiseBalances(
  transactions: Transaction[],
  shares: ParticipantShare[],
  settlements: Settlement[],
  ownerId: string,
): Map<string, number> {
  const balances = new Map<string, number>();
  const add = (pid: string, cents: number) => balances.set(pid, (balances.get(pid) ?? 0) + cents);

  const sharedTxs = transactions.filter(
    (t) => t.isShared && t.type === 'expense' && t.deletedAt === null,
  );
  for (const tx of sharedTxs) {
    const payerId = tx.paidByParticipantId ?? ownerId;
    const txShares = shares.filter(
      (s) =>
        s.transactionId === tx.id &&
        s.deletedAt === null &&
        s.confirmationStatus === 'confirmed',
    );
    for (const share of txShares) {
      if (share.participantId === payerId) continue;
      if (payerId === ownerId && share.participantId !== ownerId) {
        // The sharer owes the owner → from the person's view, they owe.
        add(share.participantId, -share.shareAmountCents);
      } else if (share.participantId === ownerId && payerId !== ownerId) {
        // The owner owes the payer → from the person's view, they receive.
        add(payerId, share.shareAmountCents);
      }
      // else: a debt between two non-owners — outside the owner's pairwise view.
    }
  }

  for (const settlement of settlements) {
    if (settlement.deletedAt !== null) continue;
    if (settlement.creditorParticipantId === ownerId && settlement.debtorParticipantId !== ownerId) {
      // The person paid the owner → their debt shrinks (balance rises).
      add(settlement.debtorParticipantId, settlement.amountCents);
    } else if (
      settlement.debtorParticipantId === ownerId &&
      settlement.creditorParticipantId !== ownerId
    ) {
      // The owner paid the person → what they are owed shrinks (balance falls).
      add(settlement.creditorParticipantId, -settlement.amountCents);
    }
  }

  return balances;
}

/**
 * B5 — from a freshly-resolved set of shares, the distinct non-owner
 * participants who now owe a positive amount. These are the people the owner
 * should nudge to open their shared `/s` link so the split lands on the other
 * phone. Owner shares, zero/negative shares, soft-deleted shares and unknown or
 * soft-deleted participants are excluded. The result preserves the order of
 * `participants` so the nudge reads predictably.
 */
export function collectSplitNotifyTargets(
  shares: ParticipantShare[],
  participants: Participant[],
  ownerId: string,
): Participant[] {
  const owedParticipantIds = new Set<string>();
  for (const share of shares) {
    if (share.deletedAt !== null) continue;
    if (share.participantId === ownerId) continue;
    if (share.shareAmountCents <= 0) continue;
    owedParticipantIds.add(share.participantId);
  }
  return participants.filter(
    (participant) =>
      participant.deletedAt === null &&
      !participant.isOwner &&
      owedParticipantIds.has(participant.id),
  );
}

/* ── DEC-414 (G6): move a debt between people by reassigning shares ─────── */

/**
 * DEC-414 (G6 · Â-DEBT-TRACEABLE): a share may be MOVED to another person ONLY
 * when it is an open, confirmed, unpaid, live debt. DEC-451 dropped the old
 * "source must not be P2P-connected" block (DEC-430): moving is allowed from
 * anyone — when the source IS connected, their device receives an informative
 * `debt_move` instead of being silently desynced (Â-MOVE-VISIBLE-BOTH-SIDES).
 */
export function isShareReassignable(
  share: Pick<ParticipantShare, 'deletedAt' | 'confirmationStatus' | 'isPaid'>,
): boolean {
  return share.deletedAt === null && share.confirmationStatus === 'confirmed' && !share.isPaid;
}

/**
 * DEC-430 (Field v2 D05) → DEC-451 (D07): why a person is — or ISN'T — a DIRECT
 * destination when moving a debt. The owner and the source person are never
 * candidates (`null`). A LOCAL person is `eligible` (device-local reassignment).
 * A P2P-connected peer whose mailbox we can reach is `connected_movable`: the
 * move applies locally AND a `debt_move` envelope updates their device with
 * provenance (Julio's lock — instant, never silent). A connected peer we hold
 * NO key for stays `connected_peer` — we cannot update their device, so the UI
 * keeps the honest explanation + the accept-first charge path (hide-never-delete).
 * Pure so the sheet and its tests share one source of truth for eligibility.
 */
export type MoveDestinationStatus = 'eligible' | 'connected_movable' | 'connected_peer';

export function classifyMoveDestination(input: {
  isOwner: boolean;
  isSource: boolean;
  isLocal: boolean;
  /** True when we hold the peer's public key (their mailbox is reachable). */
  hasMailboxKey: boolean;
}): MoveDestinationStatus | null {
  if (input.isOwner || input.isSource) return null;
  if (input.isLocal) return 'eligible';
  return input.hasMailboxKey ? 'connected_movable' : 'connected_peer';
}

/**
 * DEC-414 (G6): the pure reassignment — flip each given share's `participantId` to
 * the recipient and stamp `reassignedFrom` with the origin (for the "moved from
 * {name}" trail and undo). DEC-451 also stamps `reassignedFromName` so the trail
 * survives the origin person's later removal and travels to connected devices.
 * Amounts are NEVER touched, so the owner's TOTAL pairwise net is INVARIANT —
 * only the per-person holder changes. Sync metadata is bumped by the repository
 * on persist (`markUpdated`), so this function stays pure.
 */
export function reassignShares(
  shares: ParticipantShare[],
  fromParticipantId: string,
  toParticipantId: string,
  fromParticipantName: string,
): ParticipantShare[] {
  return shares.map((share) => ({
    ...share,
    participantId: toParticipantId,
    reassignedFrom: fromParticipantId,
    reassignedFromName: fromParticipantName,
  }));
}

/**
 * DEC-414 (G6): undo a move — send the shares back to their origin and clear the
 * trail. Restores the exact pre-move holder; amounts untouched (net invariant).
 */
export function revertReassignedShares(
  shares: ParticipantShare[],
  fromParticipantId: string,
): ParticipantShare[] {
  return shares.map((share) => ({
    ...share,
    participantId: fromParticipantId,
    reassignedFrom: null,
    reassignedFromName: null,
  }));
}

/**
 * DEC-418 (G7 · Â-PERSON-HIDE-NEVER-BREAK) — can this person be removed without
 * orphaning a debt? Only when they are FULLY out of the debt graph: their
 * owner-pairwise net is exactly 0 AND they appear in no open debt edge (owner OR
 * third-party). Hiding anyone still owing/owed would corrupt the ledger, so the UI
 * blocks removal and asks to settle first. Pure — reused by the remove flow + tests.
 */
export function isParticipantSettled(
  participantId: string,
  ownerPairwise: Map<string, number>,
  debts: DebtEntry[],
): boolean {
  if ((ownerPairwise.get(participantId) ?? 0) !== 0) return false;
  return !debts.some(
    (d) =>
      (d.debtorId === participantId || d.creditorId === participantId) && d.amountCents !== 0,
  );
}

/**
 * DEC-414 (G6): create the audit record for a completed move. The shares remain
 * the source of truth; this log groups one move action for history + one-tap undo.
 */
export function createDebtMovement(
  tripId: string,
  fromParticipantId: string,
  toParticipantId: string,
  shareIds: string[],
  amountCents: number,
): DebtMovement {
  return {
    ...createSyncMetadata(),
    tripId,
    fromParticipantId,
    toParticipantId,
    shareIds,
    amountCents,
    movedAt: new Date().toISOString(),
    undoneAt: null,
  };
}
