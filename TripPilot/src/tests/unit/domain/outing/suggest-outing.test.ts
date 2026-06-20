import { describe, it, expect } from 'vitest';
import {
  evaluateOutingSuggestion,
  OUTING_SUGGESTION_MIN_COUNT,
} from '@/domain/outing';
import { createExpenseTransaction } from '@/domain/transactions';
import type { Transaction } from '@/domain/types/transaction';

const NOW = '2026-06-19T22:00:00.000Z';

/** Minutes before NOW → an ISO timestamp. */
function minsAgo(min: number): string {
  return new Date(Date.parse(NOW) - min * 60_000).toISOString();
}

function mkTx(opts: {
  category?: string | null;
  createdAt?: string;
  deleted?: boolean;
  type?: Transaction['type'];
} = {}): Transaction {
  const tx = createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    amountCents: 2000,
    currency: 'EUR',
    category: opts.category === undefined ? 'bar' : (opts.category as string),
    description: 'test',
    isShared: false,
    exchangeRate: null,
  });
  return {
    ...tx,
    type: opts.type ?? tx.type,
    createdAt: opts.createdAt ?? minsAgo(5),
    deletedAt: opts.deleted ? minsAgo(1) : null,
  };
}

describe('evaluateOutingSuggestion', () => {
  it('does not fire below the minimum count', () => {
    const txs = [mkTx({ category: 'bar', createdAt: minsAgo(10) }), mkTx({ category: 'restaurant', createdAt: minsAgo(5) })];
    const res = evaluateOutingSuggestion(txs, { nowIso: NOW });
    expect(OUTING_SUGGESTION_MIN_COUNT).toBe(3);
    expect(res.active).toBe(false);
    expect(res.count).toBe(2);
  });

  it('fires when N bar/restaurant expenses land inside the window', () => {
    const txs = [
      mkTx({ category: 'bar', createdAt: minsAgo(40) }),
      mkTx({ category: 'restaurant', createdAt: minsAgo(20) }),
      mkTx({ category: 'bar', createdAt: minsAgo(5) }),
    ];
    const res = evaluateOutingSuggestion(txs, { nowIso: NOW });
    expect(res.active).toBe(true);
    expect(res.count).toBe(3);
    expect(res.sinceIso).toBe(minsAgo(40));
  });

  it('ignores expenses older than the window', () => {
    const txs = [
      mkTx({ category: 'bar', createdAt: minsAgo(200) }),
      mkTx({ category: 'bar', createdAt: minsAgo(180) }),
      mkTx({ category: 'restaurant', createdAt: minsAgo(160) }),
    ];
    // Default window is 150 min — all three fall outside it.
    const res = evaluateOutingSuggestion(txs, { nowIso: NOW });
    expect(res.active).toBe(false);
    expect(res.count).toBe(0);
  });

  it('only counts bar/restaurant categories', () => {
    const txs = [
      mkTx({ category: 'bar', createdAt: minsAgo(30) }),
      mkTx({ category: 'market', createdAt: minsAgo(20) }),
      mkTx({ category: 'transport', createdAt: minsAgo(10) }),
      mkTx({ category: 'restaurant', createdAt: minsAgo(5) }),
    ];
    const res = evaluateOutingSuggestion(txs, { nowIso: NOW });
    expect(res.count).toBe(2);
    expect(res.active).toBe(false);
  });

  it('skips deleted records and non-expense types', () => {
    const txs = [
      mkTx({ category: 'bar', createdAt: minsAgo(30) }),
      mkTx({ category: 'bar', createdAt: minsAgo(20), deleted: true }),
      mkTx({ category: 'restaurant', createdAt: minsAgo(10), type: 'transfer' }),
      mkTx({ category: 'bar', createdAt: minsAgo(5) }),
    ];
    const res = evaluateOutingSuggestion(txs, { nowIso: NOW });
    expect(res.count).toBe(2);
    expect(res.active).toBe(false);
  });

  it('ignores records created in the future (clock skew safety)', () => {
    const txs = [
      mkTx({ category: 'bar', createdAt: minsAgo(20) }),
      mkTx({ category: 'bar', createdAt: minsAgo(10) }),
      mkTx({ category: 'restaurant', createdAt: minsAgo(-30) }),
    ];
    const res = evaluateOutingSuggestion(txs, { nowIso: NOW });
    expect(res.count).toBe(2);
    expect(res.active).toBe(false);
  });

  it('respects custom window and minCount', () => {
    const txs = [
      mkTx({ category: 'bar', createdAt: minsAgo(8) }),
      mkTx({ category: 'restaurant', createdAt: minsAgo(4) }),
    ];
    const res = evaluateOutingSuggestion(txs, { nowIso: NOW, windowMinutes: 30, minCount: 2 });
    expect(res.active).toBe(true);
    expect(res.count).toBe(2);
  });

  it('returns inactive for an invalid now timestamp', () => {
    const txs = [mkTx({ category: 'bar' }), mkTx({ category: 'bar' }), mkTx({ category: 'bar' })];
    const res = evaluateOutingSuggestion(txs, { nowIso: 'not-a-date' });
    expect(res.active).toBe(false);
    expect(res.count).toBe(0);
    expect(res.sinceIso).toBeNull();
  });
});
