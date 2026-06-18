import { describe, it, expect } from 'vitest';
import { getAvailablePoolsForPhase, createPoolSummary } from '@/domain/budget';
import { filterTransactionsByPool } from '@/domain/transactions';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Transaction } from '@/domain/types/transaction';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'dev-1',
};

// Canonical trip (master §7.4): in June (Burgos phase) the traveler spends 50 €
// on the Tomorrowland pot. The pot is owned by the Eurotrip in July, yet the
// money can be parked early; Burgos must stay intact.
const burgosPool: BudgetPool = {
  ...meta,
  id: 'pool-burgos',
  tripId: 'trip-1',
  name: 'Burgos',
  scope: 'linked_phases',
  totalAmountCents: 62800,
  currency: 'EUR',
  notes: null,
  dateStart: null,
  dateEnd: null,
  goalCents: null,
};

const tomorrowlandPot: BudgetPool = {
  ...meta,
  id: 'pot-tmw',
  tripId: 'trip-1',
  name: 'Tomorrowland',
  scope: 'global',
  totalAmountCents: 20000,
  currency: 'EUR',
  notes: null,
  dateStart: '2026-07-23',
  dateEnd: '2026-07-26',
  goalCents: 20000,
};

const burgosLink: BudgetPoolPhaseLink = {
  ...meta,
  id: 'link-burgos',
  budgetPoolId: 'pool-burgos',
  phaseId: 'phase-burgos',
  futureFloorCents: null,
};

const earlySpend: Transaction = {
  ...meta,
  id: 'tx-50',
  tripId: 'trip-1',
  phaseId: 'phase-burgos',
  budgetPoolId: 'pot-tmw',
  walletId: null,
  sessionId: null,
  type: 'expense',
  amountCents: 5000,
  personalCostCents: null,
  currency: 'EUR',
  baseCurrencyAmountCents: 5000,
  exchangeRate: null,
  category: 'festival',
  subcategoryId: null,
  description: 'Tomorrowland pre-spend',
  date: '2026-06-20T12:00:00.000Z',
  isShared: false,
  paidByParticipantId: null,
  activityProfileId: null,
  notes: null,
} as Transaction;

describe('early spend on a pot (GATE 3 / M3.5)', () => {
  it('offers the pot as a conscious choice even while a different trecho is active', () => {
    const available = getAvailablePoolsForPhase([burgosPool, tomorrowlandPot], [burgosLink], 'phase-burgos');
    expect(available.operational.map((p) => p.id)).toEqual(['pool-burgos']);
    // The pot from another trecho is still selectable (no date gating here).
    expect(available.global.map((p) => p.id)).toEqual(['pot-tmw']);
    // One operational pool → it auto-selects, the pot stays a conscious pick.
    expect(available.autoSelectedPoolId).toBe('pool-burgos');
  });

  it('debits only the pot and leaves the active trecho untouched', () => {
    const txs = [earlySpend];
    const potSummary = createPoolSummary(tomorrowlandPot, filterTransactionsByPool(txs, 'pot-tmw'));
    const burgosSummary = createPoolSummary(burgosPool, filterTransactionsByPool(txs, 'pool-burgos'));

    // Pot: 200 € − 50 € = 150 €.
    expect(potSummary.spentCents).toBe(5000);
    expect(potSummary.remainingCents).toBe(15000);
    // Burgos is completely intact (no transaction touched it).
    expect(burgosSummary.spentCents).toBe(0);
    expect(burgosSummary.remainingCents).toBe(62800);
  });
});
