import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/data/db/database';
import { createPhaseWithBudget } from '@/domain/orchestrators';

// GATE 2 M2.1 (master §3.1, D4): a trecho = a Phase WITH its own dedicated fund.
// The Phase, the linked_phases pool and the 1:1 link must be created in ONE
// atomic transaction so a trecho can never exist without its budget.
async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

describe('createPhaseWithBudget (GATE 2 M2.1)', () => {
  beforeEach(async () => {
    await clearAll();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('atomically persists a Phase, a dedicated linked_phases fund and a 1:1 link', async () => {
    const { phase, pool, link } = await createPhaseWithBudget({
      tripId: 'trip-1',
      name: 'Burgos',
      startDate: '2026-06-06',
      endDate: '2026-07-15',
      order: 0,
      budgetCents: 62_800,
      currency: 'EUR',
    });

    const storedPhase = await db.phases.get(phase.id);
    expect(storedPhase).toBeDefined();
    expect(storedPhase!.name).toBe('Burgos');
    expect(storedPhase!.startDate).toBe('2026-06-06');
    expect(storedPhase!.endDate).toBe('2026-07-15');
    expect(storedPhase!.order).toBe(0);

    const storedPool = await db.budgetPools.get(pool.id);
    expect(storedPool).toBeDefined();
    expect(storedPool!.scope).toBe('linked_phases');
    expect(storedPool!.totalAmountCents).toBe(62_800);
    expect(storedPool!.currency).toBe('EUR');
    expect(storedPool!.name).toBe('Burgos'); // defaults to the trecho name

    const links = await db.budgetPoolPhaseLinks.where('budgetPoolId').equals(pool.id).toArray();
    expect(links).toHaveLength(1);
    expect(links[0]!.id).toBe(link.id);
    expect(links[0]!.phaseId).toBe(phase.id);
    expect(links[0]!.futureFloorCents).toBeNull();
  });

  it('uses an explicit fund name when provided, trimming whitespace', async () => {
    const { pool } = await createPhaseWithBudget({
      tripId: 'trip-1',
      name: 'Eurotrip',
      poolName: '  Eurotrip diário  ',
      startDate: '2026-07-16',
      endDate: '2026-08-04',
      order: 1,
      budgetCents: 67_800,
      currency: 'EUR',
    });
    expect((await db.budgetPools.get(pool.id))!.name).toBe('Eurotrip diário');
  });

  it('rolls back ALL three inserts when any write fails (atomicity / rollback on error)', async () => {
    vi.spyOn(db.budgetPoolPhaseLinks, 'add').mockRejectedValueOnce(new Error('boom'));

    await expect(
      createPhaseWithBudget({
        tripId: 'trip-1',
        name: 'Volta',
        startDate: '2026-08-05',
        endDate: '2026-08-16',
        order: 2,
        budgetCents: 13_100,
        currency: 'EUR',
      }),
    ).rejects.toThrow();

    vi.restoreAllMocks();
    expect(await db.phases.count()).toBe(0);
    expect(await db.budgetPools.count()).toBe(0);
    expect(await db.budgetPoolPhaseLinks.count()).toBe(0);
  });
});
