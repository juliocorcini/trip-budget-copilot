import { createExpenseTransaction } from '@/domain/transactions';
import { createCustomShares } from '@/domain/splitting';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { SharedDebtPayload } from './debt-payload';
import type { PaymentDirection } from './payment-payload';

/**
 * DEC-345 (G7) — accept side, PURE. Materialize an accepted shared debt as a
 * shared expense on MY ledger: the SENDER (their linked participant) is the payer;
 * a single CONFIRMED share = my owed amount (I accepted it). `calculateDebts` then
 * reads "I owe {sender} X" — reusing the canonical splitting model, no new math.
 *
 * Not money-from-nothing: this is a REAL new input I explicitly accepted (the
 * accept-first ÂNCORA). Data-invariance holds until accept — the pending inbox item
 * changes no total/balance; only this explicit fold does. The `externalRef`
 * (`debt:<actorId>:<debtId>`) is the idempotency key so a redelivery / re-accept
 * never double-creates the expense.
 */
export function buildExpenseFromSharedDebt(input: {
  debt: SharedDebtPayload;
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  /** The sender's participant on my trip = the payer (creditor). */
  creditorParticipantId: string;
  /** Me = the debtor (the single share). */
  myParticipantId: string;
}): { transaction: Transaction; shares: ParticipantShare[] } {
  const transaction = createExpenseTransaction({
    tripId: input.tripId,
    phaseId: input.phaseId,
    budgetPoolId: input.budgetPoolId,
    // The peer paid — my wallet didn't move (DEC-114 truth-table: other paid).
    walletId: null,
    amountCents: input.debt.amountCents,
    currency: input.debt.currency,
    category: 'other',
    description: input.debt.description,
    date: input.debt.occurredAt ?? undefined,
    isShared: true,
    paidByParticipantId: input.creditorParticipantId,
    // Entirely my cost (my single share is the whole amount).
    personalCostCents: input.debt.amountCents,
    // An externally-shared debt is not my own spending pattern.
    excludeFromLearning: true,
    externalRef: externalRefForDebt(input.debt),
  });
  const shares = createCustomShares(transaction.id, [
    { participantId: input.myParticipantId, amountCents: input.debt.amountCents },
  ]).map((s) => ({ ...s, confirmationStatus: 'confirmed' as const }));
  return { transaction, shares };
}

/** The cross-device idempotency key for an accepted shared debt. */
export function externalRefForDebt(debt: Pick<SharedDebtPayload, 'fromActorId' | 'debtId'>): string {
  return `debt:${debt.fromActorId}:${debt.debtId}`;
}

/**
 * DEC-346 (G7, L8) — payment parties, PURE. Map the announce direction to
 * debtor/creditor on MY trip and whether *I* received the cash (which drives the
 * L8 fund-credit prompt). `paid` = the sender paid me (I'm the creditor → I
 * received); `received` = the sender received from me (I'm the debtor → I did not).
 */
export function resolvePaymentParties(input: {
  direction: PaymentDirection;
  myParticipantId: string;
  peerParticipantId: string;
}): { debtorParticipantId: string; creditorParticipantId: string; iReceived: boolean } {
  if (input.direction === 'paid') {
    return {
      debtorParticipantId: input.peerParticipantId,
      creditorParticipantId: input.myParticipantId,
      iReceived: true,
    };
  }
  return {
    debtorParticipantId: input.myParticipantId,
    creditorParticipantId: input.peerParticipantId,
    iReceived: false,
  };
}
