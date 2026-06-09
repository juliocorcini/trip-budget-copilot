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

export function suggestSimplifiedSettlements(debts: DebtEntry[]): DebtEntry[] {
  return debts.filter((d) => d.amountCents > 0);
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

/** Net balance per participant: positive = is owed money, negative = owes money. */
export function calculateParticipantBalances(debts: DebtEntry[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const debt of debts) {
    balances.set(debt.debtorId, (balances.get(debt.debtorId) ?? 0) - debt.amountCents);
    balances.set(debt.creditorId, (balances.get(debt.creditorId) ?? 0) + debt.amountCents);
  }
  return balances;
}
