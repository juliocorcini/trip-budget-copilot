import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { TripPilotDB } from '@/data/db/database';
import { SCHEMA_V13 } from '@/data/db/schema';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'dev-1',
};

const link = (id: string, poolId: string, phaseId: string, deletedAt: string | null = null) => ({
  ...meta,
  id,
  budgetPoolId: poolId,
  phaseId,
  futureFloorCents: null,
  deletedAt,
});

const tx = (
  id: string,
  over: { phaseId: string; budgetPoolId: string | null; sessionId?: string | null; deletedAt?: string | null },
) => ({
  ...meta,
  id,
  tripId: 'trip-1',
  walletId: null,
  sessionId: over.sessionId ?? null,
  type: 'expense',
  amountCents: 1000,
  personalCostCents: null,
  currency: 'EUR',
  baseCurrencyAmountCents: 1000,
  exchangeRate: null,
  category: 'lodging',
  description: id,
  date: '2026-06-20T12:00:00.000Z',
  isShared: false,
  ...over,
  deletedAt: over.deletedAt ?? null,
});

/**
 * DEC-452 data heal: pre-fix expenses were stamped with "the phase active
 * today" even when their fund belonged to another phase (the eurotrip-hotel
 * bug). v14 re-stamps standalone transactions to their fund's single linked
 * phase — and touches NOTHING else.
 */
describe('Dexie v14 migration (DEC-452 — pool ⇒ phase heal)', () => {
  it('re-stamps mis-attributed standalone expenses; leaves sessions/globals/deleted alone', async () => {
    const dbName = `MigrationV14-${Date.now()}`;
    const v13db = new Dexie(dbName);
    v13db.version(13).stores(SCHEMA_V13);
    await v13db.open();

    await v13db.table('budgetPoolPhaseLinks').bulkAdd([
      link('l-burgos', 'pool-burgos', 'phase-burgos'),
      link('l-eurotrip', 'pool-eurotrip', 'phase-eurotrip'),
      // A legacy pool linked to TWO phases — ambiguous, must not re-stamp.
      link('l-legacy-1', 'pool-legacy', 'phase-burgos'),
      link('l-legacy-2', 'pool-legacy', 'phase-eurotrip'),
      // A dead link must not count: this pool resolves via its live link only.
      link('l-dead', 'pool-eurotrip', 'phase-burgos', '2026-06-01T00:00:00.000Z'),
    ]);
    await v13db.table('transactions').bulkAdd([
      // THE bug: eurotrip-fund hotel stamped with the active (Burgos) phase.
      tx('tx-hotel', { phaseId: 'phase-burgos', budgetPoolId: 'pool-eurotrip' }),
      // Already consistent — must stay byte-identical.
      tx('tx-ok', { phaseId: 'phase-burgos', budgetPoolId: 'pool-burgos' }),
      // Global pot (no links): the expense keeps its own phase.
      tx('tx-pot', { phaseId: 'phase-burgos', budgetPoolId: 'pool-tomorrowland' }),
      // Ambiguous legacy pool: untouched.
      tx('tx-legacy', { phaseId: 'phase-burgos', budgetPoolId: 'pool-legacy' }),
      // Outing item: follows its session, never re-stamped individually.
      tx('tx-outing', { phaseId: 'phase-burgos', budgetPoolId: 'pool-eurotrip', sessionId: 'sess-1' }),
      // Deleted rows are never rewritten.
      tx('tx-deleted', {
        phaseId: 'phase-burgos',
        budgetPoolId: 'pool-eurotrip',
        deletedAt: '2026-06-30T00:00:00.000Z',
      }),
      // No fund at all: untouched.
      tx('tx-no-pool', { phaseId: 'phase-burgos', budgetPoolId: null }),
    ]);
    v13db.close();

    const db = new TripPilotDB(dbName);
    await db.open();
    try {
      const byId = new Map((await db.transactions.toArray()).map((t) => [t.id, t]));
      expect(byId.get('tx-hotel')!.phaseId).toBe('phase-eurotrip'); // healed
      expect(byId.get('tx-ok')!.phaseId).toBe('phase-burgos');
      expect(byId.get('tx-pot')!.phaseId).toBe('phase-burgos');
      expect(byId.get('tx-legacy')!.phaseId).toBe('phase-burgos');
      expect(byId.get('tx-outing')!.phaseId).toBe('phase-burgos');
      expect(byId.get('tx-deleted')!.phaseId).toBe('phase-burgos');
      expect(byId.get('tx-no-pool')!.phaseId).toBe('phase-burgos');
      // The heal never moves a cent.
      const cents = [...byId.values()].reduce((s, t) => s + t.amountCents, 0);
      expect(cents).toBe(7000);
    } finally {
      db.close();
      await Dexie.delete(dbName);
    }
  });
});
