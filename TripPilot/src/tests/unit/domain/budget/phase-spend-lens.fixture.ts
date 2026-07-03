import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Envelope } from '@/domain/types/envelope';
import type { Phase } from '@/domain/types/phase';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
import type { Transaction } from '@/domain/types/transaction';

/**
 * G2 (DEC-447) — fixture mirroring Julio's field report of 2026-07-03 (D03):
 *
 *   "a fase tinha 628, o insight fala fecha em 873, o detalhe fala gasto 602,
 *    o livre hoje fala 345, a aba de gastos mostra 734 (com gasto de coisas
 *    futuras, hotel de outra fase e de outra verba)"
 *
 * The six surfaces reproduce from ONE dataset observed at TWO instants
 * separated by a single €63.00 expense paid from the main verba:
 *
 *   hero instant  (before tx-a9-last-63): free = 345.00 — the hero he saw
 *   detail instant (after  tx-a9-last-63): spent 602.00 · insight budget 884.00
 *                                          · projection ≈873 · list 734.00
 *
 * The reconstructed "orçamento da fase" (884) is INVARIANT across the two
 * instants — spending from the main verba moves free and spent by the same
 * amount — which is exactly why the four numbers could never be reconciled by
 * eye. All amounts are integer cents; every tx is unshared, same-currency
 * (personalCost = amount, exchangeRate null) so gross and personal sums match
 * except where a variant deliberately splits them.
 */

export const TODAY_ISO = '2026-07-03';

const meta = {
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'device-owner',
};

export const TRIP_ID = 'trip-julio';

/** Active phase: day 20 of 29 on TODAY_ISO (Jun 14 → Jul 12). Uniform rhythm. */
export const phaseA: Phase = {
  ...meta,
  id: 'phase-a',
  tripId: TRIP_ID,
  name: 'Lisboa',
  startDate: '2026-06-14',
  endDate: '2026-07-12',
  order: 1,
  rhythmPreset: null,
  peakDays: null,
  notes: null,
};

/** Future phase (starts after today) — the hotel below belongs to it. */
export const phaseB: Phase = {
  ...meta,
  id: 'phase-b',
  tripId: TRIP_ID,
  name: 'Porto',
  startDate: '2026-07-13',
  endDate: '2026-07-20',
  order: 2,
  rhythmPreset: null,
  peakDays: null,
  notes: null,
};

/** Surface 1 — the ONLY configured budget: the main verba, €628.00. */
export const poolMain: BudgetPool = {
  ...meta,
  id: 'pool-main',
  tripId: TRIP_ID,
  name: 'Verba principal',
  scope: 'linked_phases',
  totalAmountCents: 62800,
  currency: 'EUR',
  notes: null,
};

/** A pot ("outra verba") — its phase-attributed spends inflate the 884. */
export const poolExtras: BudgetPool = {
  ...meta,
  id: 'pool-extras',
  tripId: TRIP_ID,
  name: 'Extras',
  scope: 'global',
  totalAmountCents: 40000,
  currency: 'EUR',
  notes: null,
};

/** The lodging verba — the future-phase hotel is paid from here. */
export const poolHotels: BudgetPool = {
  ...meta,
  id: 'pool-hotels',
  tripId: TRIP_ID,
  name: 'Hospedagem',
  scope: 'linked_phases',
  totalAmountCents: 50000,
  currency: 'EUR',
  notes: null,
};

export const poolMainLinks: BudgetPoolPhaseLink[] = [
  { ...meta, id: 'link-main-a', budgetPoolId: 'pool-main', phaseId: 'phase-a', futureFloorCents: null },
  { ...meta, id: 'link-main-b', budgetPoolId: 'pool-main', phaseId: 'phase-b', futureFloorCents: null },
];

/** No envelopes in the reported case (no protected reserve, no allocations). */
export const poolMainEnvelopes: Envelope[] = [];

/**
 * Festival with €46.00 still reserved (no attributed spend yet) — the event
 * reserve that silently separates the configured 628 from the derived 884.
 */
export const festivalEvent: PlannedOccurrence = {
  ...meta,
  id: 'occ-festival',
  tripId: TRIP_ID,
  phaseId: 'phase-a',
  activityProfileId: null,
  budgetPoolId: 'pool-main',
  name: 'Festival',
  plannedDate: '2026-07-08',
  endDate: null,
  kind: 'event',
  estimatedCostCents: 4600,
  reservedCents: 4600,
  isConfirmed: false,
  linkedTransactionId: null,
  linkedSessionId: null,
  notes: null,
};

export function makeTx(overrides: Partial<Transaction> & { id: string }): Transaction {
  return {
    ...meta,
    tripId: TRIP_ID,
    phaseId: 'phase-a',
    budgetPoolId: 'pool-main',
    walletId: null,
    sessionId: null,
    type: 'expense',
    amountCents: 0,
    personalCostCents: null,
    currency: 'EUR',
    baseCurrencyAmountCents: overrides.amountCents ?? 0,
    exchangeRate: null,
    category: 'food',
    subcategoryId: null,
    placeLabel: null,
    latitude: null,
    longitude: null,
    placeId: null,
    description: 'fixture expense',
    date: '2026-06-20T12:00:00.000Z',
    isShared: false,
    paidByParticipantId: null,
    activityProfileId: null,
    isSpecialOccasion: false,
    excludeFromLearning: false,
    sourceWalletId: null,
    targetWalletId: null,
    settlementId: null,
    adjustmentReason: null,
    notes: null,
    ...overrides,
  };
}

/** Main-verba spends attributed to phase A, BEFORE the last €63: €237.00. */
export const mainPoolSpendsBeforeLast: Transaction[] = [
  makeTx({ id: 'tx-a1', amountCents: 4200, date: '2026-06-15T12:00:00.000Z', category: 'food' }),
  makeTx({ id: 'tx-a2', amountCents: 6800, date: '2026-06-17T20:00:00.000Z', category: 'bar' }),
  makeTx({ id: 'tx-a3', amountCents: 3500, date: '2026-06-20T12:00:00.000Z', category: 'transport' }),
  makeTx({ id: 'tx-a4', amountCents: 5200, date: '2026-06-24T13:00:00.000Z', category: 'food' }),
  makeTx({ id: 'tx-a5', amountCents: 4000, date: '2026-06-28T19:00:00.000Z', category: 'culture' }),
];

/** The €63.00 spend separating the hero instant from the detail instant. */
export const lastMainPoolSpend: Transaction = makeTx({
  id: 'tx-a9-last-63',
  amountCents: 6300,
  date: '2026-07-02T21:00:00.000Z',
  category: 'restaurant',
});

/** Pot ("outra verba") spends attributed to phase A: €302.00. */
export const potSpends: Transaction[] = [
  makeTx({ id: 'tx-p1', amountCents: 18000, budgetPoolId: 'pool-extras', date: '2026-06-22T12:00:00.000Z', category: 'shopping' }),
  makeTx({ id: 'tx-p2', amountCents: 12200, budgetPoolId: 'pool-extras', date: '2026-06-30T12:00:00.000Z', category: 'shopping' }),
];

/** The hotel: paid NOW (Jul 1) but belongs to the FUTURE phase + another verba. */
export const futurePhaseHotel: Transaction = makeTx({
  id: 'tx-hotel-future',
  amountCents: 13200,
  budgetPoolId: 'pool-hotels',
  phaseId: 'phase-b',
  date: '2026-07-01T10:00:00.000Z',
  category: 'lodging',
  description: 'Hotel Porto (fase futura, outra verba)',
});

/** Instant at which the hero read €345.00 (before the last €63 landed). */
export const heroInstantTransactions: Transaction[] = [
  ...mainPoolSpendsBeforeLast,
  ...potSpends,
  futurePhaseHotel,
];

/** Instant at which detail/insight/list read 602 / 884 / ≈873 / 734. */
export const detailInstantTransactions: Transaction[] = [
  ...heroInstantTransactions,
  lastMainPoolSpend,
];

/** Variant — the SAME €63 spent from the pot instead of the main verba. */
export const potVariantOfLastSpend: Transaction = makeTx({
  id: 'tx-p9-variant-63',
  amountCents: 6300,
  budgetPoolId: 'pool-extras',
  date: '2026-07-02T21:00:00.000Z',
  category: 'restaurant',
});

/** Variant — the hotel paid from the MAIN verba (still for the future phase). */
export const hotelFromMainPoolVariant: Transaction = makeTx({
  id: 'tx-hotel-from-main',
  amountCents: 13200,
  budgetPoolId: 'pool-main',
  phaseId: 'phase-b',
  date: '2026-07-01T10:00:00.000Z',
  category: 'lodging',
});

/** Variant — a shared €40 dinner where MY cost is €20 (gross ≠ personal). */
export const sharedDinnerVariant: Transaction = makeTx({
  id: 'tx-shared-dinner',
  amountCents: 4000,
  personalCostCents: 2000,
  isShared: true,
  date: '2026-07-01T21:00:00.000Z',
  category: 'restaurant',
});
