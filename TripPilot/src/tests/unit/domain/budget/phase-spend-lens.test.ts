import { describe, it, expect } from 'vitest';
import { buildPhaseSpendLens, calculateFreeToSpend } from '@/domain/budget';
import type { PhaseSpendLens } from '@/domain/budget';
import { filterTransactionsByPool } from '@/domain/transactions';
import type { Transaction } from '@/domain/types/transaction';
import {
  phaseA,
  poolMain,
  poolMainEnvelopes,
  poolMainLinks,
  festivalEvent,
  heroInstantTransactions,
  detailInstantTransactions,
  potVariantOfLastSpend,
  hotelFromMainPoolVariant,
  futurePhaseHotel,
  makeTx,
} from './phase-spend-lens.fixture';

/**
 * G3 m1 (DEC-447) — the PhaseSpendLens over the G2 evidence fixture. The lens
 * must reproduce every number of Julio's report AND its lines must SUM exactly
 * (that is the whole point: arithmetic the user can check on screen).
 */

function lensAt(transactions: Transaction[]): PhaseSpendLens {
  const fts = calculateFreeToSpend(
    poolMain,
    poolMainEnvelopes,
    filterTransactionsByPool(transactions, poolMain.id),
    poolMainLinks,
    phaseA.id,
    [festivalEvent],
    [],
  );
  return buildPhaseSpendLens({
    fts,
    transactions,
    phaseId: phaseA.id,
    poolId: poolMain.id,
  });
}

/** Replays the line arithmetic exactly as the UI renders it. */
function sumLines(lens: PhaseSpendLens): { envelope: number; free: number } {
  let running = 0;
  let envelope = 0;
  for (const line of lens.lines) {
    if (line.kind === 'base') running = line.cents;
    else if (line.kind === 'add') running += line.cents;
    else if (line.kind === 'subtract') running -= line.cents;
    else if (line.key === 'calculated_envelope') {
      envelope = running;
      expect(line.cents).toBe(running);
    } else if (line.key === 'free_now') {
      expect(line.cents).toBe(running);
    }
  }
  return { envelope, free: running };
}

describe('buildPhaseSpendLens — Julio fixture (detail instant)', () => {
  it('reproduces every surface number of the report', () => {
    const lens = lensAt(detailInstantTransactions);
    expect(lens.configuredPhaseBudgetCents).toBe(62800); // "a fase tinha 628"
    expect(lens.attributedSpentCents).toBe(60200); // "gasto 602"
    expect(lens.calculatedEnvelopeCents).toBe(88400); // "orçamento da fase 884"
    expect(lens.tripTotalCents).toBe(73400); // "a aba de gastos mostra 734"
    expect(lens.freeNowRawCents).toBe(28200);
  });

  it('decomposes the attributed spent by pool: 300 consumable + 302 from pots', () => {
    const lens = lensAt(detailInstantTransactions);
    expect(lens.consumableSpentCents).toBe(30000);
    expect(lens.otherPoolsCents).toBe(30200);
    expect(lens.reservedEventCents).toBe(4600);
    expect(lens.paidNowOtherPhasesCents).toBe(0);
  });

  it('exposes the gross list scopes: 734 trip-wide, 602 phase, 132 other phases', () => {
    const lens = lensAt(detailInstantTransactions);
    expect(lens.phaseGrossCents).toBe(60200);
    expect(lens.otherPhasesGrossCents).toBe(13200);
    expect(lens.otherPhasesGrossCents).toBe(futurePhaseHotel.amountCents);
  });

  // DEC-453 (field fix): "+302 de outras verbas" must NAME its sources.
  it('otherPoolsByPool names each foreign fund and sums exactly to otherPoolsCents', () => {
    const lens = lensAt(detailInstantTransactions);
    expect(lens.otherPoolsByPool).toEqual([{ poolId: 'pool-extras', cents: 30200 }]);

    const noFundSpend = makeTx({ id: 'tx-no-fund', amountCents: 1500, budgetPoolId: null });
    const withNoFund = lensAt([...detailInstantTransactions, noFundSpend]);
    expect(withNoFund.otherPoolsByPool).toEqual([
      { poolId: 'pool-extras', cents: 30200 },
      { poolId: null, cents: 1500 },
    ]);
    const subTotal = withNoFund.otherPoolsByPool.reduce((sum, p) => sum + p.cents, 0);
    expect(subTotal).toBe(withNoFund.otherPoolsCents);
  });

  // DEC-453: gross sums are BASE-currency — pounds never add to euros raw.
  it('a foreign-currency spend enters the gross totals at its base value', () => {
    const foreign = makeTx({
      id: 'tx-foreign-gbp',
      amountCents: 10000, // £100
      currency: 'GBP',
      baseCurrencyAmountCents: 11700, // €117 at the frozen rate
      exchangeRate: 1.17,
    });
    const lens = lensAt([...detailInstantTransactions, foreign]);
    expect(lens.tripTotalCents).toBe(73400 + 11700);
    expect(lens.phaseGrossCents).toBe(60200 + 11700);
  });

  it('the lines SUM: 628 − 46 + 302 = 884, then − 602 = 282', () => {
    const lens = lensAt(detailInstantTransactions);
    const { envelope, free } = sumLines(lens);
    expect(envelope).toBe(88400);
    expect(free).toBe(28200);
    // Zero terms are dropped — no noise rows in this fixture:
    expect(lens.lines.map((l) => l.key)).toEqual([
      'configured_budget',
      'event_reserves',
      'other_pools',
      'calculated_envelope',
      'attributed_spent',
      'free_now',
    ]);
  });
});

describe('buildPhaseSpendLens — anomaly variants stay reconciled', () => {
  it('hero instant: envelope invariant at 884 while free reads 345', () => {
    const lens = lensAt(heroInstantTransactions);
    expect(lens.calculatedEnvelopeCents).toBe(88400);
    expect(lens.freeNowRawCents).toBe(34500);
    sumLines(lens);
  });

  it('pot spend variant: envelope honestly shows 947 and the pot line explains why', () => {
    const lens = lensAt([...heroInstantTransactions, potVariantOfLastSpend]);
    expect(lens.calculatedEnvelopeCents).toBe(94700);
    expect(lens.otherPoolsCents).toBe(36500);
    sumLines(lens);
  });

  it('future-phase hotel paid from the main pool: the paid_other_phases line carries the 132', () => {
    const paidFromMain = [
      ...detailInstantTransactions.filter((tx) => tx.id !== futurePhaseHotel.id),
      hotelFromMainPoolVariant,
    ];
    const lens = lensAt(paidFromMain);
    expect(lens.paidNowOtherPhasesCents).toBe(13200);
    expect(lens.calculatedEnvelopeCents).toBe(75200);
    expect(lens.lines.some((l) => l.key === 'paid_other_phases' && l.kind === 'subtract')).toBe(
      true,
    );
    sumLines(lens);
  });

  it('deficit case: free_now goes SIGNED negative and the sum still holds', () => {
    const blowout = makeTx({ id: 'tx-blowout', amountCents: 40000, date: '2026-07-02T22:00:00.000Z' });
    const lens = lensAt([...detailInstantTransactions, blowout]);
    expect(lens.freeNowRawCents).toBe(-11800);
    const { free } = sumLines(lens);
    expect(free).toBe(-11800);
    // The floored display envelope differs from the line envelope only here:
    expect(lens.calculatedEnvelopeCents).toBe(0 + 100200);
    const envelopeLine = lens.lines.find((l) => l.key === 'calculated_envelope')!;
    expect(envelopeLine.cents).toBe(-11800 + 100200);
  });

  it('refund edge: a net-refund in another phase flips paid_other_phases to an add line', () => {
    const refundOtherPhase = makeTx({
      id: 'tx-refund-b',
      type: 'adjustment',
      amountCents: -2000,
      phaseId: 'phase-b',
      date: '2026-07-01T09:00:00.000Z',
    });
    const lens = lensAt([...detailInstantTransactions, refundOtherPhase]);
    expect(lens.paidNowOtherPhasesCents).toBe(-2000);
    expect(lens.lines.some((l) => l.key === 'paid_other_phases' && l.kind === 'add')).toBe(true);
    sumLines(lens);
  });
});
