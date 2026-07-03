import { describe, it, expect } from 'vitest';
import {
  calculateFreeToSpend,
  calculatePoolSpent,
  calculateTrueFree,
  createPoolSummary,
} from '@/domain/budget';
import { calculateTodayFreeBudget } from '@/domain/phases';
import { buildDashboardInsights } from '@/domain/insights';
import { filterTransactionsByPool } from '@/domain/transactions';
import { sumCents } from '@/domain/money';
import type { Transaction } from '@/domain/types/transaction';
import {
  TODAY_ISO,
  phaseA,
  poolMain,
  poolMainEnvelopes,
  poolMainLinks,
  festivalEvent,
  heroInstantTransactions,
  detailInstantTransactions,
  lastMainPoolSpend,
  potVariantOfLastSpend,
  hotelFromMainPoolVariant,
  sharedDinnerVariant,
  futurePhaseHotel,
} from './phase-spend-lens.fixture';

/**
 * G2 (DEC-447) — evidence suite for Julio's D03 report (2026-07-03):
 * "a fase tinha 628 · o insight fala fecha em 873 · o detalhe fala gasto 602 ·
 *  o livre hoje fala 345 · a aba de gastos mostra 734".
 *
 * Each surface's number is reproduced HERE with the production functions, and
 * the cross-surface anomalies that motivate the G3 PhaseSpendLens are pinned as
 * invariants. Per Â-NUMBERS-EVIDENCE-FIRST this suite is the baseline the G3
 * invariance check runs against: none of these values may change in G3 unless
 * a verdict below says "bug" (none does — every verdict is label/scope).
 */

function freeToSpendAt(transactions: Transaction[]) {
  return calculateFreeToSpend(
    poolMain,
    poolMainEnvelopes,
    filterTransactionsByPool(transactions, poolMain.id),
    poolMainLinks,
    phaseA.id,
    [festivalEvent],
    [],
  );
}

function phaseAttributedTxs(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => tx.phaseId === phaseA.id && tx.deletedAt === null);
}

function insightBudgetAt(transactions: Transaction[]): number {
  const fts = freeToSpendAt(transactions);
  return fts.freeToSpendCents + calculatePoolSpent(phaseAttributedTxs(transactions));
}

describe('G2 investigation — surface 1: configured verba budget ("a fase tinha 628")', () => {
  it('628 is pool.totalAmountCents of the main verba — the only CONFIGURED number', () => {
    expect(poolMain.totalAmountCents).toBe(62800);
    const summary = createPoolSummary(
      poolMain,
      filterTransactionsByPool(detailInstantTransactions, poolMain.id),
    );
    expect(summary.totalCents).toBe(62800);
  });
});

describe('G2 investigation — surface 2: insight detail "gasto até agora" (602)', () => {
  it('602 = personal cost of ALL pools\' transactions attributed to the active phase', () => {
    const spent = calculatePoolSpent(phaseAttributedTxs(detailInstantTransactions));
    expect(spent).toBe(60200);
  });

  it('602 mixes verbas: 300 from the main pool + 302 from the pot', () => {
    const phaseTxs = phaseAttributedTxs(detailInstantTransactions);
    const fromMain = calculatePoolSpent(phaseTxs.filter((tx) => tx.budgetPoolId === 'pool-main'));
    const fromPot = calculatePoolSpent(phaseTxs.filter((tx) => tx.budgetPoolId === 'pool-extras'));
    expect(fromMain).toBe(30000);
    expect(fromPot).toBe(30200);
    expect(fromMain + fromPot).toBe(60200);
  });

  it('hypothesis (c) REFUTED: the future-phase hotel is NOT inside the 602', () => {
    const phaseTxs = phaseAttributedTxs(detailInstantTransactions);
    expect(phaseTxs.some((tx) => tx.id === futurePhaseHotel.id)).toBe(false);
    // Julio's own numbers prove it: list (734) − attributed (602) = exactly the
    // hotel (132). Had the hotel been mis-attributed to phase A, the list and
    // the detail would have matched instead.
    expect(73400 - 60200).toBe(futurePhaseHotel.amountCents);
  });
});

describe('G2 investigation — surface 3: insight "orçamento da fase" (884)', () => {
  it('884 is RECONSTRUCTED: pool-scoped free + phase-scoped spent (not a configured value)', () => {
    const fts = freeToSpendAt(detailInstantTransactions);
    expect(fts.freeToSpendCents).toBe(28200);
    expect(insightBudgetAt(detailInstantTransactions)).toBe(88400);
  });

  it('reconciliation identity — the G3 lens lines SUM: 884 = 628 − 46 (event reserve) + 302 (pot spends attributed to the phase)', () => {
    expect(62800 - 4600 + 30200).toBe(88400);
    const fts = freeToSpendAt(detailInstantTransactions);
    expect(fts.eventReservesCents).toBe(4600);
    expect(fts.protectedReserveCents).toBe(0);
    expect(fts.futureFloorCents).toBe(0);
    expect(fts.plannedPurchasesCents).toBe(0);
  });

  it('ANOMALY A (label lie): spending €63 from the main verba does NOT move the "orçamento da fase"', () => {
    expect(insightBudgetAt(heroInstantTransactions)).toBe(88400);
    expect(insightBudgetAt(detailInstantTransactions)).toBe(88400);
    // ...even though free dropped by exactly those €63:
    expect(freeToSpendAt(heroInstantTransactions).freeToSpendCents).toBe(34500);
    expect(freeToSpendAt(detailInstantTransactions).freeToSpendCents).toBe(28200);
  });

  it('ANOMALY B (label lie): the SAME €63 spent from the pot GROWS the "orçamento da fase" to 947', () => {
    const withPotSpend = [...heroInstantTransactions, potVariantOfLastSpend];
    expect(insightBudgetAt(withPotSpend)).toBe(94700);
    // free untouched (the pot is another pool)…
    expect(freeToSpendAt(withPotSpend).freeToSpendCents).toBe(34500);
    // …but the attributed spent absorbed the pot expense:
    expect(calculatePoolSpent(phaseAttributedTxs(withPotSpend))).toBe(60200);
  });

  it('ANOMALY C (silent envelope eat): paying the future-phase hotel FROM the main verba shrinks the "orçamento da fase" to 752', () => {
    const paidFromMain = [
      ...detailInstantTransactions.filter((tx) => tx.id !== futurePhaseHotel.id),
      hotelFromMainPoolVariant,
    ];
    // attributed spent unchanged (the hotel still belongs to phase B)…
    expect(calculatePoolSpent(phaseAttributedTxs(paidFromMain))).toBe(60200);
    // …but the pool free dropped by the hotel, so the derived budget shrank:
    expect(freeToSpendAt(paidFromMain).freeToSpendCents).toBe(15000);
    expect(insightBudgetAt(paidFromMain)).toBe(75200);
  });
});

describe('G2 investigation — surface 4: insight "fecha em" (~873)', () => {
  it('projection = spent + (spent ÷ elapsed effective days) × remaining effective days = 872.90', () => {
    const insights = buildDashboardInsights({
      todayDate: TODAY_ISO,
      phase: phaseA,
      phaseTransactions: phaseAttributedTxs(detailInstantTransactions),
      phaseBudgetCents: insightBudgetAt(detailInstantTransactions),
      completedOutingTotalsCents: [],
      debts: [],
      ownerId: 'owner-1',
      occurrences: [festivalEvent],
      categoryRhythm: [],
      nowHour: 12,
      nextPhase: null,
    });
    const projection = insights.find((i) => i.kind === 'phase_projection');
    expect(projection).toBeDefined();
    // Day 20 of 29 → 9 effective days remain; €602.00 ÷ 20 = €30.10/day.
    expect(projection!.values).toMatchObject({
      spentCents: 60200,
      budgetCents: 88400,
      daysElapsed: 20,
      daysRemaining: 9,
      perDayCents: 3010,
      projectedCents: 87290,
      over: 0,
      diffCents: 1110,
    });
    // 87290 ≈ the reported "873" (the card renders €872,90; Julio rounded).
    expect(projection!.tone).toBe('positive');
  });
});

describe('G2 investigation — surface 5: hero "livre" (345)', () => {
  it('345 was the hero at the instant BEFORE the last €63 main-verba spend', () => {
    const fts = freeToSpendAt(heroInstantTransactions);
    expect(fts.freeToSpendCents).toBe(34500);
    // No scenario plan in the reported case → trueFree (the hero) equals free.
    const trueFree = calculateTrueFree(fts.freeToSpendCents, 0, 0);
    expect(trueFree.trueFreeCents).toBe(34500);
  });

  it('PROOF: hero 345 can NEVER co-display with budget 884 + spent 602 (hero ≤ 884 − 602 = 282)', () => {
    // At any single instant, hero = max(0, free − planReserved) ≤ free, and
    // insightBudget − attributedSpent = free. So at the 884/602 instant the
    // hero is bounded by 282.00 — the reported 345 is from ANOTHER instant.
    const fts = freeToSpendAt(detailInstantTransactions);
    const bound = insightBudgetAt(detailInstantTransactions) - 60200;
    expect(fts.freeToSpendCents).toBe(bound);
    expect(bound).toBe(28200);
    const hero = calculateTrueFree(fts.freeToSpendCents, 0, 0).trueFreeCents;
    expect(hero).toBeLessThanOrEqual(bound);
    expect(34500).toBeGreaterThan(bound);
  });

  it('the DAILY hero row ("posso gastar hoje") is a third scope again: €28.20 at the detail instant', () => {
    const fts = freeToSpendAt(detailInstantTransactions);
    const trueFree = calculateTrueFree(fts.freeToSpendCents, 0, 0);
    // No spend today (Jul 3); 10 uniform days remain incl. today → 282 ÷ 10.
    const today = calculateTodayFreeBudget(trueFree.trueFreeCents, 0, phaseA, TODAY_ISO);
    expect(today.todayAllowanceCents).toBe(2820);
    expect(today.freeTodayCents).toBe(2820);
  });
});

describe('G2 investigation — surface 6: expense list total (734)', () => {
  it('734 = GROSS amountCents of every expense in the trip (all phases, all verbas)', () => {
    const expenses = detailInstantTransactions.filter(
      (tx) => tx.type === 'expense' && tx.deletedAt === null,
    );
    expect(sumCents(expenses.map((tx) => tx.amountCents))).toBe(73400);
  });

  it('the G1 phase scope (default = active phase) brings the list total to 602', () => {
    const scoped = detailInstantTransactions.filter(
      (tx) => tx.type === 'expense' && tx.deletedAt === null && tx.phaseId === phaseA.id,
    );
    expect(sumCents(scoped.map((tx) => tx.amountCents))).toBe(60200);
  });

  it('FLAG (latent divergence): the list sums GROSS amounts while budget spent uses PERSONAL cost', () => {
    const withShared = [...detailInstantTransactions, sharedDinnerVariant];
    const phaseExpenses = withShared.filter(
      (tx) => tx.type === 'expense' && tx.deletedAt === null && tx.phaseId === phaseA.id,
    );
    const listTotal = sumCents(phaseExpenses.map((tx) => tx.amountCents));
    const budgetSpent = calculatePoolSpent(phaseExpenses);
    // A shared €40 dinner (my share €20) makes the SAME scope diverge by €20:
    expect(listTotal).toBe(60200 + 4000);
    expect(budgetSpent).toBe(60200 + 2000);
    expect(listTotal - budgetSpent).toBe(2000);
  });

  it('the €63 lastMainPoolSpend is the exact delta between the two reported instants', () => {
    expect(lastMainPoolSpend.amountCents).toBe(6300);
    expect(
      freeToSpendAt(heroInstantTransactions).freeToSpendCents -
        freeToSpendAt(detailInstantTransactions).freeToSpendCents,
    ).toBe(6300);
  });
});
