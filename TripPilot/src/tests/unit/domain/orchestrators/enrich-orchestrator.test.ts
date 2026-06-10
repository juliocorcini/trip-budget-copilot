import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { enrichTransactionShares } from '@/domain/orchestrators';
import { createExpenseTransaction } from '@/domain/transactions';
import { buildSharesWithPayer, calculatePersonalCost } from '@/domain/splitting';

const OWNER_ID = 'owner-1';
const SISTER_ID = 'sister-1';

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

/** Quick-add transaction as saved BEFORE the stepper (Core Rule: never blocks). */
async function mkSavedQuickAdd(amountCents: number) {
  const tx = createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    amountCents,
    currency: 'EUR',
    category: 'outing',
    description: 'Parral',
    sessionId: 'session-1',
    activityProfileId: null,
  });
  await db.transactions.add(tx);
  return tx;
}

describe('enrichTransactionShares (DEC-078 — post-add stepper)', () => {
  beforeEach(clearAll);

  it('fifty-fifty paid by a third party: shares follow DEC-071 and personal cost halves', async () => {
    const tx = await mkSavedQuickAdd(1000);

    const shares = buildSharesWithPayer({
      transactionId: tx.id,
      amountCents: tx.amountCents,
      participantIds: [OWNER_ID, SISTER_ID],
      paidByParticipantId: SISTER_ID,
      shareType: 'equal',
      customAmountsCents: {},
    });
    await enrichTransactionShares({
      transaction: {
        ...tx,
        isShared: true,
        paidByParticipantId: SISTER_ID,
        walletId: null,
        personalCostCents: calculatePersonalCost(shares, OWNER_ID),
      },
      shares,
    });

    const [storedTx, storedShares] = await Promise.all([
      db.transactions.get(tx.id),
      db.participantShares.toArray(),
    ]);
    expect(storedTx!.isShared).toBe(true);
    expect(storedTx!.paidByParticipantId).toBe(SISTER_ID);
    expect(storedTx!.personalCostCents).toBe(500);
    // Revision bumped — soft delete + revision on every mutation (Anchor 3).
    expect(storedTx!.revision).toBe(tx.revision + 1);

    expect(storedShares).toHaveLength(2);
    const payerShare = storedShares.find((s) => s.participantId === SISTER_ID)!;
    const ownerShare = storedShares.find((s) => s.participantId === OWNER_ID)!;
    expect(payerShare.confirmationStatus).toBe('confirmed');
    expect(payerShare.isPaid).toBe(true);
    expect(ownerShare.confirmationStatus).toBe('pending');
  });

  it('"no split" with third-party payer: full share on the payer, zero personal cost', async () => {
    const tx = await mkSavedQuickAdd(2000);

    const shares = buildSharesWithPayer({
      transactionId: tx.id,
      amountCents: tx.amountCents,
      participantIds: [SISTER_ID],
      paidByParticipantId: SISTER_ID,
      shareType: 'equal',
      customAmountsCents: {},
    });
    await enrichTransactionShares({
      transaction: {
        ...tx,
        isShared: true,
        paidByParticipantId: SISTER_ID,
        walletId: null,
        personalCostCents: calculatePersonalCost(shares, OWNER_ID),
      },
      shares,
    });

    const [storedTx, storedShares] = await Promise.all([
      db.transactions.get(tx.id),
      db.participantShares.toArray(),
    ]);
    // Sister paid everything herself → nothing hits MY budget.
    expect(storedTx!.personalCostCents).toBe(0);
    expect(storedShares).toHaveLength(1);
    expect(storedShares[0]!.shareAmountCents).toBe(2000);
    expect(storedShares[0]!.confirmationStatus).toBe('confirmed');
  });

  it('enrichment without shares (category-only path) still bumps revision atomically', async () => {
    const tx = await mkSavedQuickAdd(500);

    await enrichTransactionShares({ transaction: { ...tx, category: 'bar' }, shares: [] });

    const [storedTx, storedShares] = await Promise.all([
      db.transactions.get(tx.id),
      db.participantShares.toArray(),
    ]);
    expect(storedTx!.category).toBe('bar');
    expect(storedTx!.revision).toBe(tx.revision + 1);
    expect(storedShares).toHaveLength(0);
  });
});
