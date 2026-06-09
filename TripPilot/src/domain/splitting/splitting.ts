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
