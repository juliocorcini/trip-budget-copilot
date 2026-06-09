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

  return shares.map((s) =>
    s.participantId === input.paidByParticipantId ? { ...s, isPaid: true } : s,
  );
}

export function calculatePersonalCost(
  shares: ParticipantShare[],
  ownerId: string,
): number {
  const ownerShare = shares.find((s) => s.participantId === ownerId);
  return ownerShare?.shareAmountCents ?? 0;
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
    const txShares = shares.filter(
      (s) => s.transactionId === tx.id && s.deletedAt === null,
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

  for (const [pid, balance] of balances) {
    if (balance < 0) {
      const creditors = [...balances.entries()]
        .filter(([, b]) => b > 0)
        .sort((a, b) => b[1] - a[1]);

      let remaining = Math.abs(balance);
      for (const [creditorId, creditorBalance] of creditors) {
        if (remaining <= 0) break;
        const amount = Math.min(remaining, creditorBalance);
        if (amount > 0) {
          debts.push({
            debtorId: pid,
            debtorName: participantMap.get(pid)?.name ?? pid,
            creditorId,
            creditorName: participantMap.get(creditorId)?.name ?? creditorId,
            amountCents: amount,
          });
          remaining -= amount;
        }
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

/**
 * GAP-016 (decision D-C): a shared expense is "pending" while at least one
 * third-party share is not covered by settlements. Once the debtor↔creditor
 * pair has no outstanding debt left, the expense disappears from the card.
 */
export function findPendingSharedTransactions(
  transactions: Transaction[],
  shares: ParticipantShare[],
  participants: Participant[],
  settlements: Settlement[],
  ownerId: string,
): Transaction[] {
  const { debts } = calculateDebts(transactions, shares, participants, settlements, ownerId);
  if (debts.length === 0) return [];

  const owingPairs = new Set(debts.map((d) => `${d.debtorId}->${d.creditorId}`));

  return transactions.filter((tx) => {
    if (!tx.isShared || tx.type !== 'expense' || tx.deletedAt !== null) return false;
    const payerId = tx.paidByParticipantId ?? ownerId;
    return shares.some(
      (s) =>
        s.transactionId === tx.id &&
        s.deletedAt === null &&
        s.participantId !== payerId &&
        owingPairs.has(`${s.participantId}->${payerId}`),
    );
  });
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
