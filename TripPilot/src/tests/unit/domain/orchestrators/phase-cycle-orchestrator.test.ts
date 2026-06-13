import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { applyPhaseLeftover } from '@/domain/orchestrators';
import { createBudgetPool } from '@/domain/budget';
import { createDefaultAppSettings, APP_SETTINGS_ID } from '@/data/db/seed';
import type { BudgetPoolScope } from '@/domain/types/common';

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

function mkPool(name: string, scope: BudgetPoolScope, totalAmountCents: number) {
  return createBudgetPool({ tripId: 'trip-1', name, scope, totalAmountCents, currency: 'EUR' });
}

async function seedSettings(): Promise<void> {
  await db.appSettings.put({ ...createDefaultAppSettings(), id: APP_SETTINGS_ID });
}

describe('applyPhaseLeftover (M10 — ÂNCORA 13)', () => {
  beforeEach(async () => {
    await clearAll();
    await seedSettings();
  });

  it('carry_next marks the phase handled and leaves pools/envelopes untouched', async () => {
    const pool = mkPool('Diário', 'linked_phases', 100_000);
    await db.budgetPools.add(pool);

    await applyPhaseLeftover({
      endedPhaseId: 'p1',
      sourcePoolId: pool.id,
      amountCents: 12_000,
      destination: 'carry_next',
      targetPoolId: null,
      reserveName: 'unused',
    });

    expect((await db.budgetPools.get(pool.id))!.totalAmountCents).toBe(100_000);
    expect(await db.envelopes.count()).toBe(0);
    expect((await db.appSettings.get(APP_SETTINGS_ID))!.phaseLeftoverHandled).toContain('p1');
  });

  it('reserve creates a protected_reserve envelope without changing pool totals', async () => {
    const pool = mkPool('Diário', 'linked_phases', 100_000);
    await db.budgetPools.add(pool);

    await applyPhaseLeftover({
      endedPhaseId: 'p1',
      sourcePoolId: pool.id,
      amountCents: 12_000,
      destination: 'reserve',
      targetPoolId: null,
      reserveName: 'Sobra de Lisboa',
    });

    expect((await db.budgetPools.get(pool.id))!.totalAmountCents).toBe(100_000);
    const envelopes = await db.envelopes.toArray();
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]!.kind).toBe('protected_reserve');
    expect(envelopes[0]!.amountCents).toBe(12_000);
    expect(envelopes[0]!.budgetPoolId).toBe(pool.id);
  });

  it('shopping moves money between pools preserving the trip total', async () => {
    const source = mkPool('Diário', 'linked_phases', 100_000);
    const target = mkPool('Compras', 'global', 5_000);
    await db.budgetPools.bulkAdd([source, target]);
    const totalBefore = source.totalAmountCents + target.totalAmountCents;

    await applyPhaseLeftover({
      endedPhaseId: 'p1',
      sourcePoolId: source.id,
      amountCents: 12_000,
      destination: 'shopping',
      targetPoolId: target.id,
      reserveName: 'unused',
    });

    const [storedSource, storedTarget] = await Promise.all([
      db.budgetPools.get(source.id),
      db.budgetPools.get(target.id),
    ]);
    expect(storedSource!.totalAmountCents).toBe(88_000);
    expect(storedTarget!.totalAmountCents).toBe(17_000);
    expect(storedSource!.totalAmountCents + storedTarget!.totalAmountCents).toBe(totalBefore);
    expect((await db.appSettings.get(APP_SETTINGS_ID))!.phaseLeftoverHandled).toContain('p1');
  });

  it('applying twice for the same phase never duplicates the handled marker', async () => {
    const pool = mkPool('Diário', 'linked_phases', 100_000);
    await db.budgetPools.add(pool);

    await applyPhaseLeftover({
      endedPhaseId: 'p1',
      sourcePoolId: pool.id,
      amountCents: 0,
      destination: 'carry_next',
      targetPoolId: null,
      reserveName: 'unused',
    });
    await applyPhaseLeftover({
      endedPhaseId: 'p1',
      sourcePoolId: pool.id,
      amountCents: 0,
      destination: 'carry_next',
      targetPoolId: null,
      reserveName: 'unused',
    });

    const handled = (await db.appSettings.get(APP_SETTINGS_ID))!.phaseLeftoverHandled;
    expect(handled.filter((id) => id === 'p1')).toHaveLength(1);
  });
});
