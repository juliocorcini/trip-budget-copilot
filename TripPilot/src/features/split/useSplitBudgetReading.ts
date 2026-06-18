import { useMemo } from 'react';
import { useAppData } from '@/hooks/useAppData';
import { resolveActivePhase, localDateString } from '@/domain/dates';
import { calculateFreeToSpend } from '@/domain/budget';
import { filterTransactionsByPool, calculateSpentOnDate } from '@/domain/transactions';
import { calculateTodayFreeBudget } from '@/domain/phases';
import { simulateContextualSpend, type ContextualSimulation } from '@/domain/forecasting';

/**
 * T1/§11.2 — the budget bridge for a bill split. Before the owner registers
 * "their part", we read it through the SAME contextual simulator the rest of the
 * app uses (DEC-116), so "minha parte" carries the honest "cabe no teto de hoje;
 * sobram €X" verdict instead of a bare number. The split has no category/event
 * target, so it runs against the free margin + today's allowance (`target:other`
 * → free_impact / daily_fits / daily_days / exceeds_free). `myBaseCents` is the
 * owner's slice ALREADY converted to the trip base currency (E8). Returns null
 * until the trip/phase/pool are loaded or when the slice is non-positive.
 */
export function useSplitBudgetReading(myBaseCents: number): ContextualSimulation | null {
  const { trip, phases, pools, links, envelopes, transactions, occurrences, plannedPurchases } = useAppData();

  return useMemo<ContextualSimulation | null>(() => {
    if (!trip || myBaseCents <= 0) return null;
    const activePhase = resolveActivePhase(phases);
    const primaryPool = pools.find((p) => p.scope === 'linked_phases') ?? pools[0] ?? null;
    if (!activePhase || !primaryPool) return null;

    const poolTransactions = filterTransactionsByPool(transactions, primaryPool.id);
    const fts = calculateFreeToSpend(
      primaryPool,
      envelopes.filter((e) => e.budgetPoolId === primaryPool.id),
      poolTransactions,
      links.filter((l) => l.budgetPoolId === primaryPool.id),
      activePhase.id,
      occurrences,
      plannedPurchases,
    );

    const todayIso = localDateString(new Date());
    const todayBudget = calculateTodayFreeBudget(
      fts.freeToSpendCents,
      calculateSpentOnDate(poolTransactions, todayIso),
      activePhase,
      todayIso,
    );
    const todayAllowanceCents =
      todayBudget.todayAllowanceCents > 0 ? todayBudget.todayAllowanceCents : null;

    return simulateContextualSpend({
      amountCents: myBaseCents,
      target: { kind: 'other' },
      freeToSpendCents: fts.freeToSpendCents,
      todayAllowanceCents,
      profiles: [],
      events: [],
      planned: [],
    });
  }, [trip, phases, pools, links, envelopes, transactions, occurrences, plannedPurchases, myBaseCents]);
}
