import { describe, it, expect } from 'vitest';
import { buildYesterdayRecap } from '@/domain/dashboard';
import { createPhase } from '@/domain/phases';
import { createExpenseTransaction } from '@/domain/transactions';
import type { Transaction } from '@/domain/types/transaction';

// DEC-129: yesterday recap — allowances reconstructed via the add-back trick.

const phase = createPhase({
  tripId: 'trip-1',
  name: 'Madrid',
  startDate: '2026-06-01',
  endDate: '2026-06-10',
  order: 0,
});

function mkTx(amountCents: number, dayIso: string): Transaction {
  const tx = createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: phase.id,
    budgetPoolId: 'pool-1',
    walletId: null,
    amountCents,
    currency: 'EUR',
    category: 'bar',
    description: 'test',
  });
  return { ...tx, date: `${dayIso}T14:00:00.000Z` };
}

describe('buildYesterdayRecap', () => {
  it('reconstructs yesterday allowance and computes the saved delta', () => {
    // Today 06-05, current free €300. Yesterday spent €30, the day before €20.
    const recap = buildYesterdayRecap({
      freeToSpendCents: 30000,
      todaySpentCents: 1000,
      transactions: [mkTx(1000, '2026-06-05'), mkTx(3000, '2026-06-04'), mkTx(2000, '2026-06-03')],
      phase,
      todayIso: '2026-06-05',
    });

    expect(recap).not.toBeNull();
    expect(recap!.yesterdayIso).toBe('2026-06-04');
    expect(recap!.spentCents).toBe(3000);
    // Start-of-yesterday free = 30000 + 1000 (today) + 3000 (yesterday) = 34000
    // over 7 remaining days (06-04..06-10) = 4857 allowance.
    expect(recap!.allowanceCents).toBe(4857);
    expect(recap!.within).toBe(true);
    expect(recap!.deltaCents).toBe(1857);
  });

  it('counts the streak of consecutive within-plan days ending yesterday', () => {
    const recap = buildYesterdayRecap({
      freeToSpendCents: 30000,
      todaySpentCents: 1000,
      transactions: [mkTx(1000, '2026-06-05'), mkTx(3000, '2026-06-04'), mkTx(2000, '2026-06-03')],
      phase,
      todayIso: '2026-06-05',
    });
    // 06-04 within, 06-03 within, 06-02 and 06-01 spent 0 (also within) = 4 days.
    expect(recap!.streakDays).toBe(4);
  });

  it('flags an over-plan yesterday with the overshoot and zero streak', () => {
    const recap = buildYesterdayRecap({
      freeToSpendCents: 30000,
      todaySpentCents: 1000,
      transactions: [mkTx(1000, '2026-06-05'), mkTx(6000, '2026-06-04')],
      phase,
      todayIso: '2026-06-05',
    });

    // Start-of-yesterday free = 30000 + 1000 + 6000 = 37000 over 7 days = 5286.
    expect(recap!.allowanceCents).toBe(5286);
    expect(recap!.within).toBe(false);
    expect(recap!.deltaCents).toBe(6000 - 5286);
    expect(recap!.streakDays).toBe(0);
  });

  it('returns null when nothing was registered before today', () => {
    const recap = buildYesterdayRecap({
      freeToSpendCents: 30000,
      todaySpentCents: 1000,
      transactions: [mkTx(1000, '2026-06-05')],
      phase,
      todayIso: '2026-06-05',
    });
    expect(recap).toBeNull();
  });

  it('returns null on the first day of the phase', () => {
    const recap = buildYesterdayRecap({
      freeToSpendCents: 30000,
      todaySpentCents: 0,
      transactions: [mkTx(2000, '2026-05-30')],
      phase,
      todayIso: '2026-06-01',
    });
    expect(recap).toBeNull();
  });

  it('ignores deleted transactions', () => {
    const deleted = { ...mkTx(9000, '2026-06-04'), deletedAt: '2026-06-05T00:00:00.000Z' };
    const recap = buildYesterdayRecap({
      freeToSpendCents: 30000,
      todaySpentCents: 0,
      transactions: [deleted, mkTx(1000, '2026-06-04')],
      phase,
      todayIso: '2026-06-05',
    });
    expect(recap!.spentCents).toBe(1000);
  });
});
