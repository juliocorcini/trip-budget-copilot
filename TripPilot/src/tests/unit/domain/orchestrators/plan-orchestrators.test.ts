import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { createPlannedExpense } from '@/domain/orchestrators';
import {
  createBudgetPool,
  createBudgetPoolPhaseLink,
  calculateFreeToSpend,
  createPoolSummary,
} from '@/domain/budget';
import { createExpenseTransaction } from '@/domain/transactions';
import type { BudgetPool } from '@/domain/types/budget-pool';

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

const TRIP = 'trip-1';
const PHASE = 'eurotrip';

/** The canonical Eurotrip trecho: 678 € dedicated budget. */
async function seedEurotrip(): Promise<BudgetPool> {
  const pool = createBudgetPool({
    tripId: TRIP,
    name: 'Eurotrip',
    scope: 'linked_phases',
    totalAmountCents: 67800,
    currency: 'EUR',
  });
  const link = createBudgetPoolPhaseLink(pool.id, PHASE, null);
  await db.budgetPools.add(pool);
  await db.budgetPoolPhaseLinks.add(link);
  return pool;
}

/** Free-to-spend of a trecho pool, reading the live occurrences/purchases. */
async function trechoFreeToSpend(pool: BudgetPool): Promise<number> {
  const [occurrences, plannedPurchases, links, transactions] = await Promise.all([
    db.plannedOccurrences.toArray(),
    db.plannedPurchases.toArray(),
    db.budgetPoolPhaseLinks.where('budgetPoolId').equals(pool.id).toArray(),
    db.transactions.where('budgetPoolId').equals(pool.id).toArray(),
  ]);
  return calculateFreeToSpend(
    pool,
    [],
    transactions,
    links,
    PHASE,
    occurrences,
    plannedPurchases,
  ).freeToSpendCents;
}

const baseInput = (pool: BudgetPool) => ({
  tripId: TRIP,
  currency: 'EUR',
  name: 'X',
  estimatedCostCents: 3500,
  category: 'other',
  startDate: null as string | null,
  endDate: null as string | null,
  phaseId: PHASE,
  phasePoolId: pool.id,
  existingPotId: null as string | null,
});

describe('createPlannedExpense (GATE 4 M4.1/M4.3 — single door routing + funding)', () => {
  beforeEach(clearAll);

  it('dated + phase → a trecho-funded Event that SUBTRACTS from the 678 (M4.3a)', async () => {
    const pool = await seedEurotrip();
    expect(await trechoFreeToSpend(pool)).toBe(67800);

    const res = await createPlannedExpense({
      ...baseInput(pool),
      hasDate: true,
      funding: 'phase',
      name: 'Passeio a Valladolid',
      estimatedCostCents: 3500,
      startDate: '2026-07-20',
    });

    expect(res.outcome).toBe('event_phase');
    expect(res.occurrenceId).not.toBeNull();
    expect(res.createdPotId).toBeNull();

    const occ = await db.plannedOccurrences.get(res.occurrenceId!);
    expect(occ!.kind).toBe('event');
    expect(occ!.budgetPoolId).toBe(pool.id);
    expect(occ!.reservedCents).toBe(3500);
    // The reserve eats from the trecho: 678 − 35 = 643.
    expect(await trechoFreeToSpend(pool)).toBe(64300);
  });

  it('dated + new pot → Tomorrowland Event + a €200 Pote; the trecho is untouched (M4.3b)', async () => {
    const pool = await seedEurotrip();

    const res = await createPlannedExpense({
      ...baseInput(pool),
      hasDate: true,
      funding: 'new_pot',
      name: 'Tomorrowland',
      estimatedCostCents: 20000,
      startDate: '2026-07-23',
      endDate: '2026-07-26',
    });

    expect(res.outcome).toBe('event_new_pot');
    expect(res.createdPotId).not.toBeNull();

    const [pot, occ] = await Promise.all([
      db.budgetPools.get(res.createdPotId!),
      db.plannedOccurrences.get(res.occurrenceId!),
    ]);
    expect(pot!.scope).toBe('global');
    expect(pot!.totalAmountCents).toBe(20000);
    // The pot mirrors the event's date so it follows the same D8 Home visibility.
    expect(pot!.dateStart).toBe('2026-07-23');
    expect(pot!.dateEnd).toBe('2026-07-26');
    // The event is funded by the pot, à parte → no reserve, no trecho deduction.
    expect(occ!.budgetPoolId).toBe(pot!.id);
    expect(occ!.reservedCents).toBeNull();
    expect(await trechoFreeToSpend(pool)).toBe(67800);
  });

  it('dated + existing pot → Event funded by it; spend debits ONLY the pot (M4.3c)', async () => {
    const pool = await seedEurotrip();
    const pot = createBudgetPool({
      tripId: TRIP,
      name: 'Compras pessoais',
      scope: 'global',
      totalAmountCents: 20000,
      currency: 'EUR',
    });
    await db.budgetPools.add(pot);

    const res = await createPlannedExpense({
      ...baseInput(pool),
      hasDate: true,
      funding: 'existing_pot',
      name: 'Show',
      estimatedCostCents: 5000,
      startDate: '2026-07-25',
      existingPotId: pot.id,
    });

    expect(res.outcome).toBe('event_existing_pot');
    expect(res.createdPotId).toBeNull();
    const occ = await db.plannedOccurrences.get(res.occurrenceId!);
    expect(occ!.budgetPoolId).toBe(pot.id);
    expect(occ!.reservedCents).toBeNull();
    // Trecho untouched by the plan.
    expect(await trechoFreeToSpend(pool)).toBe(67800);

    // Now spend €50 on the pot → only the pot's remaining drops.
    const tx = createExpenseTransaction({
      tripId: TRIP,
      phaseId: PHASE,
      budgetPoolId: pot.id,
      walletId: null,
      amountCents: 5000,
      currency: 'EUR',
      category: 'other',
      description: 'Show',
    });
    await db.transactions.add(tx);
    const potTxs = await db.transactions.where('budgetPoolId').equals(pot.id).toArray();
    expect(createPoolSummary(pot, potTxs).remainingCents).toBe(15000);
    expect(await trechoFreeToSpend(pool)).toBe(67800);
  });

  it('undated + phase → a trecho-funded Compra that reserves from the trecho', async () => {
    const pool = await seedEurotrip();

    const res = await createPlannedExpense({
      ...baseInput(pool),
      hasDate: false,
      funding: 'phase',
      name: 'Roupas',
      category: 'shopping',
      estimatedCostCents: 10000,
    });

    expect(res.outcome).toBe('purchase_phase');
    expect(res.purchaseId).not.toBeNull();
    const purchase = await db.plannedPurchases.get(res.purchaseId!);
    expect(purchase!.budgetPoolId).toBe(pool.id);
    expect(purchase!.reservedCents).toBe(10000);
    expect(purchase!.phaseId).toBe(PHASE);
    // 678 − 100 reserved = 578.
    expect(await trechoFreeToSpend(pool)).toBe(57800);
  });

  it('undated + new pot → a standalone dateless Pote, nothing reserved on the trecho', async () => {
    const pool = await seedEurotrip();

    const res = await createPlannedExpense({
      ...baseInput(pool),
      hasDate: false,
      funding: 'new_pot',
      name: 'Compras pessoais',
      estimatedCostCents: 15000,
    });

    expect(res.outcome).toBe('pot');
    expect(res.occurrenceId).toBeNull();
    expect(res.purchaseId).toBeNull();
    const pot = await db.budgetPools.get(res.createdPotId!);
    expect(pot!.scope).toBe('global');
    expect(pot!.totalAmountCents).toBe(15000);
    expect(pot!.dateStart).toBeNull();
    expect(await trechoFreeToSpend(pool)).toBe(67800);
  });

  it('undated + existing pot → a Compra drawing from the Pote, à parte (trecho intact)', async () => {
    const pool = await seedEurotrip();
    const pot = createBudgetPool({
      tripId: TRIP,
      name: 'Compras pessoais',
      scope: 'global',
      totalAmountCents: 20000,
      currency: 'EUR',
    });
    await db.budgetPools.add(pot);

    const res = await createPlannedExpense({
      ...baseInput(pool),
      hasDate: false,
      funding: 'existing_pot',
      name: 'Presentes',
      category: 'shopping',
      estimatedCostCents: 6000,
      existingPotId: pot.id,
    });

    expect(res.outcome).toBe('purchase_existing_pot');
    const purchase = await db.plannedPurchases.get(res.purchaseId!);
    expect(purchase!.budgetPoolId).toBe(pot.id);
    expect(purchase!.reservedCents).toBeNull();
    expect(purchase!.phaseId).toBeNull();
    expect(await trechoFreeToSpend(pool)).toBe(67800);
  });

  it('is atomic: the new pot AND its event both land (or neither)', async () => {
    const pool = await seedEurotrip();
    const res = await createPlannedExpense({
      ...baseInput(pool),
      hasDate: true,
      funding: 'new_pot',
      name: 'Festival',
      estimatedCostCents: 9000,
      startDate: '2026-07-24',
    });
    const [pots, occs] = await Promise.all([
      db.budgetPools.where('scope').equals('global').toArray(),
      db.plannedOccurrences.toArray(),
    ]);
    expect(pots).toHaveLength(1);
    expect(occs).toHaveLength(1);
    expect(occs[0]!.budgetPoolId).toBe(res.createdPotId);
  });
});

describe('GATE 5 (D15 / DEC-315) — Event × Pote/Fundo: a countdown belongs ONLY to an Event', () => {
  beforeEach(clearAll);

  it('a standalone Pote/Fundo carries NO date and creates NO occurrence (never a "faltam X dias")', async () => {
    const pool = await seedEurotrip();
    const res = await createPlannedExpense({
      ...baseInput(pool),
      hasDate: false,
      funding: 'new_pot',
      name: 'Reserva da próxima fase',
      estimatedCostCents: 30000,
    });

    expect(res.outcome).toBe('pot');
    // No occurrence → nothing the home could ever count down to.
    expect(res.occurrenceId).toBeNull();
    const pot = await db.budgetPools.get(res.createdPotId!);
    expect(pot!.dateStart).toBeNull();
    expect(pot!.dateEnd).toBeNull();
  });

  it('an Event always carries a date and a dated occurrence (the only thing that counts down)', async () => {
    const pool = await seedEurotrip();
    const res = await createPlannedExpense({
      ...baseInput(pool),
      hasDate: true,
      funding: 'phase',
      name: 'Passeio',
      estimatedCostCents: 4000,
      startDate: '2026-07-21',
    });

    expect(res.outcome).toBe('event_phase');
    const occ = await db.plannedOccurrences.get(res.occurrenceId!);
    expect(occ!.kind).toBe('event');
    expect(occ!.plannedDate?.slice(0, 10)).toBe('2026-07-21');
  });
});
