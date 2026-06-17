import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { createBudgetPoolWithPhaseLinks } from '@/domain/orchestrators';

// B13 (DEC-067): the fund + its phase links must be created in one atomic
// transaction (FundsPage used to do it in separate repo calls → orphan-pool /
// partial-links risk). These lock the contract the page now relies on.
async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

describe('createBudgetPoolWithPhaseLinks (B13 — DEC-067)', () => {
  beforeEach(async () => {
    await clearAll();
  });

  it('persists a linked_phases pool and one link per phase, with floors normalized', async () => {
    const pool = await createBudgetPoolWithPhaseLinks({
      tripId: 'trip-1',
      name: 'Diário',
      scope: 'linked_phases',
      totalAmountCents: 100_000,
      currency: 'EUR',
      phaseLinks: [
        { phaseId: 'p1', floorCents: 5_000 },
        { phaseId: 'p2', floorCents: null },
        { phaseId: 'p3', floorCents: 0 },
        { phaseId: 'p4', floorCents: -10 },
      ],
    });

    const stored = await db.budgetPools.get(pool.id);
    expect(stored).toBeDefined();
    expect(stored!.scope).toBe('linked_phases');
    expect(stored!.totalAmountCents).toBe(100_000);

    const links = await db.budgetPoolPhaseLinks.where('budgetPoolId').equals(pool.id).toArray();
    expect(links).toHaveLength(4);
    const floorByPhase = Object.fromEntries(links.map((l) => [l.phaseId, l.futureFloorCents]));
    expect(floorByPhase['p1']).toBe(5_000); // positive floor kept
    expect(floorByPhase['p2']).toBeNull(); // null stays null
    expect(floorByPhase['p3']).toBeNull(); // zero normalized to null
    expect(floorByPhase['p4']).toBeNull(); // negative normalized to null
  });

  it('creates a global pool with NO links even when phaseLinks are passed', async () => {
    const pool = await createBudgetPoolWithPhaseLinks({
      tripId: 'trip-1',
      name: 'Geral',
      scope: 'global',
      totalAmountCents: 50_000,
      currency: 'EUR',
      phaseLinks: [{ phaseId: 'p1', floorCents: 9_999 }],
    });

    expect(await db.budgetPools.get(pool.id)).toBeDefined();
    expect(await db.budgetPoolPhaseLinks.where('budgetPoolId').equals(pool.id).count()).toBe(0);
  });

  it('returns a pool with a fresh id, the requested fields and a live (not deleted) row', async () => {
    const pool = await createBudgetPoolWithPhaseLinks({
      tripId: 'trip-9',
      name: 'Comida',
      scope: 'linked_phases',
      totalAmountCents: 1_234,
      currency: 'USD',
      phaseLinks: [{ phaseId: 'pX', floorCents: 100 }],
    });

    expect(pool.id).toBeTruthy();
    expect(pool.tripId).toBe('trip-9');
    expect(pool.name).toBe('Comida');
    expect(pool.currency).toBe('USD');
    expect(pool.deletedAt).toBeNull();
  });
});
