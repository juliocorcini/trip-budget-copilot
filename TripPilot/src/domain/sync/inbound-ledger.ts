import { createExpenseTransaction } from '@/domain/transactions';
import { createCustomShares } from '@/domain/splitting';
import type { Transaction } from '@/domain/types/transaction';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { SharedDebtPayload } from './debt-payload';
import type { PaymentDirection } from './payment-payload';
import { externalRefForDebtMoveItem, type DebtMoveItem } from './debt-move-payload';

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
 * DEC-451 (D07) — fold side of a debt MOVE, PURE. Same canonical shape as an
 * accepted shared debt (the mover's participant is the payer; my single
 * CONFIRMED share = the owed amount), with the provenance riding on the share:
 * `reassignedFromName` carries who owed this before (e.g. "Débora"), so my
 * statement of the mover shows "moved from Débora" exactly like the owner's UI
 * (Â-MOVE-VISIBLE-BOTH-SIDES). `reassignedFrom` stays null — the origin person
 * does not exist on MY device; the name is the honest trail. The per-item
 * `externalRef` makes a re-drain of the same move a no-op.
 */
export function buildExpenseFromMovedItem(input: {
  item: DebtMoveItem;
  currency: string;
  fromActorId: string;
  moveId: string;
  /** Who owed this item before the move — the display trail. */
  fromPersonName: string;
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  /** The mover's participant on my trip = the payer (creditor). */
  creditorParticipantId: string;
  /** Me = the debtor (the single share). */
  myParticipantId: string;
}): { transaction: Transaction; shares: ParticipantShare[] } {
  const transaction = createExpenseTransaction({
    tripId: input.tripId,
    phaseId: input.phaseId,
    budgetPoolId: input.budgetPoolId,
    // The mover's side paid — my wallet didn't move (DEC-114 truth-table).
    walletId: null,
    amountCents: input.item.amountCents,
    currency: input.currency,
    category: 'other',
    description: input.item.description,
    date: input.item.occurredAt ?? undefined,
    isShared: true,
    paidByParticipantId: input.creditorParticipantId,
    personalCostCents: input.item.amountCents,
    // A moved-in debt is not my own spending pattern.
    excludeFromLearning: true,
    externalRef: externalRefForDebtMoveItem(input.fromActorId, input.moveId, input.item.moveItemId),
  });
  const shares = createCustomShares(transaction.id, [
    { participantId: input.myParticipantId, amountCents: input.item.amountCents },
  ]).map((s) => ({
    ...s,
    confirmationStatus: 'confirmed' as const,
    reassignedFromName: input.fromPersonName,
  }));
  return { transaction, shares };
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
