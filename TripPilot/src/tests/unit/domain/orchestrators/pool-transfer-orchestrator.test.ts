import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { createBudgetPool } from '@/domain/budget';
import { transferBetweenPools } from '@/domain/orchestrators';

// GATE 2 M2.4 (D5/D14): "remanejar" moves budget between trechos WITHOUT changing
// the trip total — the sum of the two fund totals is invariant.
async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

async function seedPool(name: string, cents: number) {
  const pool = createBudgetPool({
    tripId: 'trip-1',
    name,
    scope: 'linked_phases',
    totalAmountCents: cents,
    currency: 'EUR',
  });
  await db.budgetPools.add(pool);
  return pool;
}

describe('transferBetweenPools (GATE 2 M2.4 — remanejar preserves the trip total)', () => {
  beforeEach(async () => {
    await clearAll();
  });

  it('moves money between two trechos and keeps the SUM invariant', async () => {
    const a = await seedPool('Burgos', 62_800);
    const b = await seedPool('Eurotrip', 67_800);
    const sumBefore = 62_800 + 67_800;

    const res = await transferBetweenPools({
      sourcePoolId: a.id,
      targetPoolId: b.id,
      amountCents: 5_000,
    });
    expect(res).toEqual({ ok: true });

    const a2 = await db.budgetPools.get(a.id);
    const b2 = await db.budgetPools.get(b.id);
    expect(a2!.totalAmountCents).toBe(57_800);
    expect(b2!.totalAmountCents).toBe(72_800);
    expect(a2!.totalAmountCents + b2!.totalAmountCents).toBe(sumBefore);
  });

  it('rejects a non-positive amount without touching the funds', async () => {
    const a = await seedPool('A', 10_000);
    const b = await seedPool('B', 10_000);
    expect(
      await transferBetweenPools({ sourcePoolId: a.id, targetPoolId: b.id, amountCents: 0 }),
    ).toEqual({ ok: false, reason: 'invalid_amount' });
    expect((await db.budgetPools.get(a.id))!.totalAmountCents).toBe(10_000);
    expect((await db.budgetPools.get(b.id))!.totalAmountCents).toBe(10_000);
  });

  it('rejects transferring more than the source holds (never pushes a source negative)', async () => {
    const a = await seedPool('A', 3_000);
    const b = await seedPool('B', 0);
    expect(
      await transferBetweenPools({ sourcePoolId: a.id, targetPoolId: b.id, amountCents: 3_001 }),
    ).toEqual({ ok: false, reason: 'insufficient_funds' });
    expect((await db.budgetPools.get(a.id))!.totalAmountCents).toBe(3_000);
  });

  it('rejects a missing pool or the same pool on both ends', async () => {
    const a = await seedPool('A', 5_000);
    expect(
      await transferBetweenPools({ sourcePoolId: a.id, targetPoolId: 'nope', amountCents: 100 }),
    ).toEqual({ ok: false, reason: 'pool_not_found' });
    expect(
      await transferBetweenPools({ sourcePoolId: a.id, targetPoolId: a.id, amountCents: 100 }),
    ).toEqual({ ok: false, reason: 'invalid_amount' });
  });
});
