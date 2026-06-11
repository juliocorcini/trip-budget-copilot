import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Participant } from '@/domain/types/participant';
import type { Settlement } from '@/domain/types/settlement';
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

  // DEC-114 + DEC-071: the OWNER registers the expense, so their own share is
  // born confirmed — the debt to the payer exists immediately in /shared.
  const shares = built.map((s) =>
    s.participantId === input.ownerId && s.confirmationStatus === 'pending'
      ? { ...s, confirmationStatus: 'confirmed' as const }
      : s,
  );

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

export function createSettlement(
  tripId: string,
  debtorId: string,
  creditorId: string,
  amountCents: number,
  currency: string,
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
        description: tx.description,
        category: tx.category,
        subcategoryId: tx.subcategoryId,
        occurredAt: tx.date,
        amountCents: share.shareAmountCents,
        confirmationStatus: share.confirmationStatus,
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

/** Net balance per participant: positive = is owed money, negative = owes money. */
export function calculateParticipantBalances(debts: DebtEntry[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const debt of debts) {
    balances.set(debt.debtorId, (balances.get(debt.debtorId) ?? 0) - debt.amountCents);
    balances.set(debt.creditorId, (balances.get(debt.creditorId) ?? 0) + debt.amountCents);
  }
  return balances;
}
