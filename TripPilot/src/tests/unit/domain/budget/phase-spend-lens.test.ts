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
 * G3 m1 (DEC-447) + DEC-456 — the PhaseSpendLens over the G2 evidence fixture.
 *
 * DEC-456 (Julio's verdict, 2026-07-03): the phase budget math uses ONLY the
 * phase's own fund. Money attributed to the phase but paid from pots/other
 * funds is INFORMATIVE (`kind: 'info'`) — visible and named, never summed.
 * So the old 884 envelope (which absorbed +302 of pot spends) is now 582:
 *   582 = 628 (configured) − 46 (event reserve); spent from the fund = 300;
 *   free 282 — the SAME free as before (the hero never moved).
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

/** Replays the line arithmetic exactly as the UI renders it — `info` never counts. */
function sumLines(lens: PhaseSpendLens): { envelope: number; free: number } {
  let running = 0;
  let envelope = 0;
  for (const line of lens.lines) {
    if (line.kind === 'info') continue;
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

describe('buildPhaseSpendLens — Julio fixture (detail instant, DEC-456 scope)', () => {
  it('phase-money numbers: 628 configured · 582 envelope · 300 fund spent · 282 free', () => {
    const lens = lensAt(detailInstantTransactions);
    expect(lens.configuredPhaseBudgetCents).toBe(62800); // "a fase tinha 628"
    expect(lens.consumableSpentCents).toBe(30000); // spent FROM the phase fund
    expect(lens.calculatedEnvelopeCents).toBe(58200); // 628 − 46, pots OUT
    expect(lens.freeNowRawCents).toBe(28200); // the hero — unchanged
    expect(lens.tripTotalCents).toBe(73400); // "a aba de gastos mostra 734"
  });

  it('keeps the all-funds attributed total as INFO: 602 = 300 fund + 302 pots', () => {
    const lens = lensAt(detailInstantTransactions);
    expect(lens.attributedSpentCents).toBe(60200);
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

  // DEC-453 (field fix): the informative pot money must NAME its sources.
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

  it('the lines SUM (pots out): 628 − 46 = 582, then − 300 = 282; pots ride as info', () => {
    const lens = lensAt(detailInstantTransactions);
    const { envelope, free } = sumLines(lens);
    expect(envelope).toBe(58200);
    expect(free).toBe(28200);
    // Zero terms are dropped; the pot money is the trailing `info` line:
    expect(lens.lines.map((l) => l.key)).toEqual([
      'configured_budget',
      'event_reserves',
      'calculated_envelope',
      'phase_pool_spent',
      'free_now',
      'other_pools',
    ]);
    expect(lens.lines.find((l) => l.key === 'other_pools')!.kind).toBe('info');
    expect(lens.lines.find((l) => l.key === 'other_pools')!.cents).toBe(30200);
  });
});

describe('buildPhaseSpendLens — DEC-456 invariants', () => {
  it('hero instant: envelope invariant at 582 while free reads 345', () => {
    const lens = lensAt(heroInstantTransactions);
    expect(lens.calculatedEnvelopeCents).toBe(58200);
    expect(lens.freeNowRawCents).toBe(34500);
    sumLines(lens);
  });

  it('THE FIX: a pot spend does NOT grow the envelope anymore (was 947, stays 582)', () => {
    const lens = lensAt([...heroInstantTransactions, potVariantOfLastSpend]);
    expect(lens.calculatedEnvelopeCents).toBe(58200);
    expect(lens.freeNowRawCents).toBe(34500); // pot money never touches the fund free
    expect(lens.otherPoolsCents).toBe(36500); // …but the info section grows honestly
    sumLines(lens);
  });

  it('spending from the fund does not move the envelope either (582 both instants)', () => {
    expect(lensAt(heroInstantTransactions).calculatedEnvelopeCents).toBe(
      lensAt(detailInstantTransactions).calculatedEnvelopeCents,
    );
  });

  it('future-phase hotel paid from the main fund: the paid_other_phases line carries the 132', () => {
    const paidFromMain = [
      ...detailInstantTransactions.filter((tx) => tx.id !== futurePhaseHotel.id),
      hotelFromMainPoolVariant,
    ];
    const lens = lensAt(paidFromMain);
    expect(lens.paidNowOtherPhasesCents).toBe(13200);
    // 628 − 46 − 132 = 450 envelope; − 300 = 150 free.
    expect(lens.calculatedEnvelopeCents).toBe(45000);
    expect(lens.freeNowRawCents).toBe(15000);
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
    // Fund spend is now 700; the floored display envelope differs from the line
    // envelope only here (0 + 700 vs −118 + 700 = 582 — the honest raw sum):
    expect(lens.calculatedEnvelopeCents).toBe(0 + 70000);
    const envelopeLine = lens.lines.find((l) => l.key === 'calculated_envelope')!;
    expect(envelopeLine.cents).toBe(-11800 + 70000);
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

  it('no pot money at all → no info line (zero terms stay noise-free)', () => {
    const onlyFund = detailInstantTransactions.filter((tx) => tx.budgetPoolId === poolMain.id);
    const lens = lensAt(onlyFund);
    expect(lens.otherPoolsCents).toBe(0);
    expect(lens.lines.some((l) => l.kind === 'info')).toBe(false);
    sumLines(lens);
  });
});
