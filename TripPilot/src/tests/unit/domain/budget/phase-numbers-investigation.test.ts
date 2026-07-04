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
 * Each surface's number is reproduced HERE with the production functions.
 *
 * DEC-456 UPDATE (Julio's field verdict, 2026-07-03 night): the G2 anomalies
 * A/B — the derived "orçamento da fase" silently absorbing POT spends — were
 * ruled a real scope bug ("o pote do Tomorrowland está entrando como valor
 * para fazer o cálculo da fase sendo que ele não deveria"). The production
 * composition is now PHASE MONEY ONLY: budget = pool free + spend from the
 * phase's own fund. This satisfies Â-NUMBERS-EVIDENCE-FIRST — the math change
 * ships WITH the verdict, and this suite now pins the corrected behavior
 * (the old absorbing behavior is asserted as gone).
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

/** DEC-456: spend that counts for the budget — the phase's own fund only. */
function phaseMoneySpentAt(transactions: Transaction[]): number {
  return calculatePoolSpent(
    phaseAttributedTxs(transactions).filter((tx) => tx.budgetPoolId === poolMain.id),
  );
}

/** The production composition (useDashboardModel, DEC-456 scope). */
function insightBudgetAt(transactions: Transaction[]): number {
  const fts = freeToSpendAt(transactions);
  return fts.freeToSpendCents + phaseMoneySpentAt(transactions);
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

describe('G2 investigation — surface 3: insight "orçamento da fase" (was 884, now 582 per DEC-456)', () => {
  it('the derived budget is now PHASE MONEY ONLY: pool free + fund spend = 582', () => {
    const fts = freeToSpendAt(detailInstantTransactions);
    expect(fts.freeToSpendCents).toBe(28200);
    expect(phaseMoneySpentAt(detailInstantTransactions)).toBe(30000);
    expect(insightBudgetAt(detailInstantTransactions)).toBe(58200);
  });

  it('reconciliation identity — the lens lines SUM: 582 = 628 − 46 (event reserve); pots stay OUT', () => {
    expect(62800 - 4600).toBe(58200);
    const fts = freeToSpendAt(detailInstantTransactions);
    expect(fts.eventReservesCents).toBe(4600);
    expect(fts.protectedReserveCents).toBe(0);
    expect(fts.futureFloorCents).toBe(0);
    expect(fts.plannedPurchasesCents).toBe(0);
  });

  it('EX-ANOMALY A (still true, now honest): spending €63 from the fund does not move the budget', () => {
    expect(insightBudgetAt(heroInstantTransactions)).toBe(58200);
    expect(insightBudgetAt(detailInstantTransactions)).toBe(58200);
    // ...free dropped by exactly those €63, spend rose by them:
    expect(freeToSpendAt(heroInstantTransactions).freeToSpendCents).toBe(34500);
    expect(freeToSpendAt(detailInstantTransactions).freeToSpendCents).toBe(28200);
  });

  it('EX-ANOMALY B FIXED (DEC-456): a pot spend NO LONGER grows the "orçamento da fase"', () => {
    const withPotSpend = [...heroInstantTransactions, potVariantOfLastSpend];
    // Was 94700 before the verdict — the Tomorrowland bug Julio reported.
    expect(insightBudgetAt(withPotSpend)).toBe(58200);
    // free untouched (the pot is another pool)…
    expect(freeToSpendAt(withPotSpend).freeToSpendCents).toBe(34500);
    // …and the pot expense stays visible in the ALL-FUNDS attributed total
    // (the lens shows it as an informative line, never as budget):
    expect(calculatePoolSpent(phaseAttributedTxs(withPotSpend))).toBe(60200);
    expect(phaseMoneySpentAt(withPotSpend)).toBe(23700);
  });

  it('ANOMALY C (kept by design): paying a future-phase hotel FROM the fund shrinks the budget to 450', () => {
    const paidFromMain = [
      ...detailInstantTransactions.filter((tx) => tx.id !== futurePhaseHotel.id),
      hotelFromMainPoolVariant,
    ];
    // Real fund money left the pool — the envelope must shrink (the lens names
    // it on the "pago agora para outras fases" line). 628−46−132 = 450.
    expect(phaseMoneySpentAt(paidFromMain)).toBe(30000);
    expect(freeToSpendAt(paidFromMain).freeToSpendCents).toBe(15000);
    expect(insightBudgetAt(paidFromMain)).toBe(45000);
  });
});

describe('G2 investigation — surface 4: insight "fecha em" (DEC-456 scope)', () => {
  it('projection now runs on phase money: 300 spent → projects 435 vs budget 582', () => {
    const insights = buildDashboardInsights({
      todayDate: TODAY_ISO,
      phase: phaseA,
      phaseTransactions: phaseAttributedTxs(detailInstantTransactions),
      phaseBudgetCents: insightBudgetAt(detailInstantTransactions),
      phaseMoneySpentCents: phaseMoneySpentAt(detailInstantTransactions),
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
    // Day 20 of 29 → 9 effective days remain; €300.00 ÷ 20 = €15.00/day.
    expect(projection!.values).toMatchObject({
      spentCents: 30000,
      budgetCents: 58200,
      daysElapsed: 20,
      daysRemaining: 9,
      perDayCents: 1500,
      projectedCents: 43500,
      over: 0,
      diffCents: 14700,
    });
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

  it('PROOF: hero 345 can NEVER co-display with budget 582 + fund spent 300 (hero ≤ 582 − 300 = 282)', () => {
    // At any single instant, hero = max(0, free − planReserved) ≤ free, and
    // insightBudget − phaseMoneySpent = free (DEC-456 identity). So at the
    // detail instant the hero is bounded by 282.00 — the reported 345 is from
    // ANOTHER instant.
    const fts = freeToSpendAt(detailInstantTransactions);
    const bound =
      insightBudgetAt(detailInstantTransactions) - phaseMoneySpentAt(detailInstantTransactions);
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
