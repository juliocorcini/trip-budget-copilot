import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { deleteBudgetPool, deletePhase, swapPhaseOrder } from '@/domain/orchestrators';
import { resolveShareConfirmation } from '@/domain/orchestrators';
import { createBudgetPool, createBudgetPoolPhaseLink, createEnvelope } from '@/domain/budget';
import { createPhase } from '@/domain/phases';
import { createExpenseTransaction } from '@/domain/transactions';
import { createEqualShares, buildSharesWithPayer } from '@/domain/splitting';

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

function mkPool(name: string) {
  return createBudgetPool({
    tripId: 'trip-1',
    name,
    scope: 'linked_phases',
    totalAmountCents: 100_000,
    currency: 'EUR',
  });
}

function mkPhase(name: string, order: number) {
  return createPhase({
    tripId: 'trip-1',
    name,
    startDate: '2026-06-01',
    endDate: '2026-06-10',
    order,
  });
}

function mkExpense(poolId: string, phaseId: string, overrides: Partial<Parameters<typeof createExpenseTransaction>[0]> = {}) {
  return createExpenseTransaction({
    tripId: 'trip-1',
    phaseId,
    budgetPoolId: poolId,
    walletId: null,
    amountCents: 4000,
    currency: 'EUR',
    category: 'market',
    description: 'Mercado',
    ...overrides,
  });
}

describe('deleteBudgetPool (DEC-080 / FIELD-11)', () => {
  beforeEach(clearAll);

  it('soft-deletes an empty pool and cascades links/envelopes', async () => {
    const pool = mkPool('Diário');
    await db.budgetPools.add(pool);
    await db.budgetPoolPhaseLinks.add(createBudgetPoolPhaseLink(pool.id, 'phase-1'));
    await db.envelopes.add(
      createEnvelope({ budgetPoolId: pool.id, kind: 'allocation', name: 'Bares', amountCents: 5000 }),
    );

    const result = await deleteBudgetPool({ poolId: pool.id, reassignToPoolId: null });
    expect(result.ok).toBe(true);

    const [storedPool, links, envelopes] = await Promise.all([
      db.budgetPools.get(pool.id),
      db.budgetPoolPhaseLinks.toArray(),
      db.envelopes.toArray(),
    ]);
    expect(storedPool!.deletedAt).not.toBeNull();
    expect(links.every((l) => l.deletedAt !== null)).toBe(true);
    expect(envelopes.every((e) => e.deletedAt !== null)).toBe(true);
  });

  it('blocks deletion when the pool has active transactions and no reassign target', async () => {
    const pool = mkPool('Diário');
    await db.budgetPools.add(pool);
    await db.transactions.add(mkExpense(pool.id, 'phase-1'));

    const result = await deleteBudgetPool({ poolId: pool.id, reassignToPoolId: null });
    expect(result).toEqual({ ok: false, reason: 'has_transactions', transactionCount: 1 });

    const storedPool = await db.budgetPools.get(pool.id);
    expect(storedPool!.deletedAt).toBeNull();
  });

  it('reassigns active transactions to another pool before deleting', async () => {
    const poolA = mkPool('Diário');
    const poolB = mkPool('Reserva');
    await db.budgetPools.bulkAdd([poolA, poolB]);
    const tx = mkExpense(poolA.id, 'phase-1');
    await db.transactions.add(tx);

    const result = await deleteBudgetPool({ poolId: poolA.id, reassignToPoolId: poolB.id });
    expect(result.ok).toBe(true);

    const [storedTx, storedPool] = await Promise.all([
      db.transactions.get(tx.id),
      db.budgetPools.get(poolA.id),
    ]);
    expect(storedTx!.budgetPoolId).toBe(poolB.id);
    expect(storedTx!.revision).toBe(tx.revision + 1);
    expect(storedPool!.deletedAt).not.toBeNull();
  });
});

describe('deletePhase (DEC-080 / FIELD-11)', () => {
  beforeEach(clearAll);

  it('never deletes the last phase', async () => {
    const phase = mkPhase('Única', 0);
    await db.phases.add(phase);

    const result = await deletePhase(phase.id);
    expect(result).toEqual({ ok: false, reason: 'last_phase' });
    expect((await db.phases.get(phase.id))!.deletedAt).toBeNull();
  });

  it('blocks deletion when the phase has transactions or sessions', async () => {
    const [a, b] = [mkPhase('Burgos', 0), mkPhase('Madrid', 1)];
    await db.phases.bulkAdd([a, b]);
    await db.transactions.add(mkExpense('pool-1', a.id));

    const result = await deletePhase(a.id);
    expect(result).toEqual({ ok: false, reason: 'has_data', transactionCount: 1, sessionCount: 0 });
    expect((await db.phases.get(a.id))!.deletedAt).toBeNull();
  });

  it('soft-deletes an empty phase and compacts the order of the rest', async () => {
    const [a, b, c] = [mkPhase('Burgos', 0), mkPhase('Madrid', 1), mkPhase('Porto', 2)];
    await db.phases.bulkAdd([a, b, c]);
    await db.budgetPoolPhaseLinks.add(createBudgetPoolPhaseLink('pool-1', b.id));

    const result = await deletePhase(b.id);
    expect(result.ok).toBe(true);

    const [storedB, storedC, links] = await Promise.all([
      db.phases.get(b.id),
      db.phases.get(c.id),
      db.budgetPoolPhaseLinks.toArray(),
    ]);
    expect(storedB!.deletedAt).not.toBeNull();
    expect(storedC!.order).toBe(1);
    expect(links.every((l) => l.deletedAt !== null)).toBe(true);
  });
});

describe('swapPhaseOrder (DEC-080)', () => {
  beforeEach(clearAll);

  it('swaps the order of two phases', async () => {
    const [a, b] = [mkPhase('Burgos', 0), mkPhase('Madrid', 1)];
    await db.phases.bulkAdd([a, b]);

    await swapPhaseOrder(a.id, b.id);

    expect((await db.phases.get(a.id))!.order).toBe(1);
    expect((await db.phases.get(b.id))!.order).toBe(0);
  });
});

describe('resolveShareConfirmation (DEC-071 / FIELD-03)', () => {
  beforeEach(clearAll);

  it('confirms a pending share, optionally adjusting the value', async () => {
    const tx = mkExpense('pool-1', 'phase-1', { isShared: true, paidByParticipantId: 'julio', personalCostCents: 2000 });
    await db.transactions.add(tx);
    const shares = buildSharesWithPayer({
      transactionId: tx.id,
      amountCents: tx.amountCents,
      participantIds: ['julio', 'sis'],
      paidByParticipantId: 'julio',
      shareType: 'equal',
      customAmountsCents: {},
    });
    await db.participantShares.bulkAdd(shares);
    const sisShare = shares.find((s) => s.participantId === 'sis')!;

    await resolveShareConfirmation({
      shareId: sisShare.id,
      status: 'confirmed',
      adjustedAmountCents: 1500,
      ownerId: 'julio',
    });

    const [storedShare, storedTx] = await Promise.all([
      db.participantShares.get(sisShare.id),
      db.transactions.get(tx.id),
    ]);
    expect(storedShare!.confirmationStatus).toBe('confirmed');
    expect(storedShare!.shareAmountCents).toBe(1500);
    // €40 total - €15 confirmed third-party share = €25 personal cost.
    expect(storedTx!.personalCostCents).toBe(2500);
  });

  it('rejecting a share returns its value to the payer personal cost', async () => {
    const tx = mkExpense('pool-1', 'phase-1', { isShared: true, paidByParticipantId: 'julio', personalCostCents: 2000 });
    await db.transactions.add(tx);
    const shares = buildSharesWithPayer({
      transactionId: tx.id,
      amountCents: tx.amountCents,
      participantIds: ['julio', 'sis'],
      paidByParticipantId: 'julio',
      shareType: 'equal',
      customAmountsCents: {},
    });
    await db.participantShares.bulkAdd(shares);
    const sisShare = shares.find((s) => s.participantId === 'sis')!;

    await resolveShareConfirmation({
      shareId: sisShare.id,
      status: 'rejected',
      adjustedAmountCents: null,
      ownerId: 'julio',
    });

    const [storedShare, storedTx] = await Promise.all([
      db.participantShares.get(sisShare.id),
      db.transactions.get(tx.id),
    ]);
    expect(storedShare!.confirmationStatus).toBe('rejected');
    // The €20 rejected share goes back to Julio: full €40 is personal again.
    expect(storedTx!.personalCostCents).toBe(4000);
  });

  it('shares are born payer-confirmed and third-party pending', () => {
    const shares = buildSharesWithPayer({
      transactionId: 'tx-1',
      amountCents: 4000,
      participantIds: ['julio', 'sis'],
      paidByParticipantId: 'julio',
      shareType: 'equal',
      customAmountsCents: {},
    });
    expect(shares.find((s) => s.participantId === 'julio')!.confirmationStatus).toBe('confirmed');
    expect(shares.find((s) => s.participantId === 'sis')!.confirmationStatus).toBe('pending');
    const equal = createEqualShares('tx-2', ['a', 'b'], 1000);
    expect(equal.every((s) => s.confirmationStatus === 'pending')).toBe(true);
  });
});
