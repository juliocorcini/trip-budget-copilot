import { describe, it, expect } from 'vitest';
import { buildFreeToSpendBreakdown, type FreeToSpendResult } from '@/domain/budget';

function makeFts(partial: Partial<FreeToSpendResult>): FreeToSpendResult {
  return {
    freeToSpendCents: 0,
    totalBudgetCents: 0,
    totalSpentCents: 0,
    protectedReserveCents: 0,
    futureFloorCents: 0,
    eventReservesCents: 0,
    allocationsCents: 0,
    ...partial,
  };
}

describe('buildFreeToSpendBreakdown', () => {
  it('lists every non-zero term and reconciles to the free total', () => {
    // 1000 budget − 300 spent − 100 protected − 50 future floor − 40 reserves = 510
    const fts = makeFts({
      totalBudgetCents: 100000,
      totalSpentCents: 30000,
      protectedReserveCents: 10000,
      futureFloorCents: 5000,
      eventReservesCents: 4000,
      freeToSpendCents: 51000,
    });

    const lines = buildFreeToSpendBreakdown(fts);

    expect(lines.map((l) => l.key)).toEqual([
      'budget',
      'spent',
      'protected',
      'future_floor',
      'event_reserves',
      'free',
    ]);

    const base = lines.find((l) => l.kind === 'base')!;
    const subtracted = lines
      .filter((l) => l.kind === 'subtract')
      .reduce((sum, l) => sum + l.cents, 0);
    const total = lines.find((l) => l.kind === 'total')!;

    expect(base.cents - subtracted).toBe(total.cents);
    expect(total.cents).toBe(fts.freeToSpendCents);
  });

  it('drops zero-valued terms so the sheet stays signal, not noise', () => {
    const fts = makeFts({
      totalBudgetCents: 80000,
      totalSpentCents: 20000,
      protectedReserveCents: 0,
      futureFloorCents: 0,
      eventReservesCents: 0,
      freeToSpendCents: 60000,
    });

    const lines = buildFreeToSpendBreakdown(fts);

    expect(lines.map((l) => l.key)).toEqual(['budget', 'spent', 'free']);
    expect(lines.find((l) => l.key === 'free')!.cents).toBe(60000);
  });

  it('shows only the budget and free lines when nothing is spent or reserved', () => {
    const fts = makeFts({ totalBudgetCents: 50000, freeToSpendCents: 50000 });

    const lines = buildFreeToSpendBreakdown(fts);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ key: 'budget', cents: 50000, kind: 'base' });
    expect(lines[1]).toEqual({ key: 'free', cents: 50000, kind: 'total' });
  });

  it('floors free at zero and surfaces the overflow as a deficit line', () => {
    // commitments (700 + 400) exceed the 1000 budget by 100
    const fts = makeFts({
      totalBudgetCents: 100000,
      totalSpentCents: 70000,
      protectedReserveCents: 40000,
      freeToSpendCents: 0,
    });

    const lines = buildFreeToSpendBreakdown(fts);

    const total = lines.find((l) => l.kind === 'total')!;
    const deficit = lines.find((l) => l.kind === 'deficit');

    expect(total.cents).toBe(0);
    expect(deficit).toBeDefined();
    expect(deficit!.key).toBe('deficit');
    expect(deficit!.cents).toBe(10000);
  });

  it('does not emit a deficit line when commitments exactly equal the budget', () => {
    const fts = makeFts({
      totalBudgetCents: 50000,
      totalSpentCents: 50000,
      freeToSpendCents: 0,
    });

    const lines = buildFreeToSpendBreakdown(fts);

    expect(lines.some((l) => l.kind === 'deficit')).toBe(false);
    expect(lines.find((l) => l.kind === 'total')!.cents).toBe(0);
  });
});
