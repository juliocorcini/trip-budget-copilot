import { describe, it, expect } from 'vitest';
import { buildSessionFeed, groupFeedByDay } from '@/features/expenses/expense-feed';
import type { Transaction } from '@/domain/types/transaction';
import type { Session } from '@/domain/types/session';

const tx = (over: Partial<Transaction>): Transaction =>
  ({
    id: 'tx',
    type: 'expense',
    amountCents: 1_000,
    currency: 'EUR',
    sessionId: null,
    date: '2026-06-10T12:00:00.000Z',
    deletedAt: null,
    // DEC-453: feed aggregations sum BASE cents; same-currency rows have
    // base === amount (mirrors createExpenseTransaction), so totals are stable.
    baseCurrencyAmountCents: over.amountCents ?? 1_000,
    ...over,
  }) as unknown as Transaction;

const session = (id: string): Session => ({ id }) as unknown as Session;

describe('buildSessionFeed (DEC-206 rollup + D-BUG-04)', () => {
  it('collapses a browsed session into one entry and keeps standalone tx rows', () => {
    const sessionById = new Map([['s1', session('s1')]]);
    const feed = buildSessionFeed(
      [
        tx({ id: 'a', sessionId: 's1', amountCents: 300 }),
        tx({ id: 'b', sessionId: 's1', amountCents: 700 }),
        tx({ id: 'c', sessionId: null, amountCents: 1_500 }),
      ],
      sessionById,
      true,
    );
    expect(feed).toHaveLength(2);
    const rollup = feed[0];
    expect(rollup?.kind).toBe('session');
    if (rollup?.kind === 'session') {
      expect(rollup.txs).toHaveLength(2);
      expect(rollup.totalCents).toBe(1_000); // 300 + 700
    }
    expect(feed[1]?.kind).toBe('tx');
  });

  it('income (no sessionId) is always a standalone tx entry, never rolled up', () => {
    const sessionById = new Map([['s1', session('s1')]]);
    const feed = buildSessionFeed(
      [
        tx({ id: 'exp', sessionId: 's1' }),
        tx({ id: 'inc', type: 'income', sessionId: null, amountCents: 5_000 }),
      ],
      sessionById,
      true,
    );
    expect(feed).toHaveLength(2);
    const incomeEntry = feed.find((e) => e.kind === 'tx' && e.tx.id === 'inc');
    expect(incomeEntry?.kind).toBe('tx');
  });

  it('does NOT roll up sessions when collapse is off (text search active)', () => {
    const sessionById = new Map([['s1', session('s1')]]);
    const feed = buildSessionFeed(
      [tx({ id: 'a', sessionId: 's1' }), tx({ id: 'b', sessionId: 's1' })],
      sessionById,
      false,
    );
    expect(feed).toHaveLength(2);
    expect(feed.every((e) => e.kind === 'tx')).toBe(true);
  });

  it('F2: a split-commit tx is NEVER rolled up — it stays a standalone gasto even while browsing', () => {
    // A committed split is one Session holding ONE expense (externalRef "split:…")
    // whose detail shows the division. Collapsing it hid that detail in "Todos".
    const sessionById = new Map([['split-sess', session('split-sess')]]);
    const feed = buildSessionFeed(
      [tx({ id: 'split-tx', sessionId: 'split-sess', externalRef: 'split:abc', amountCents: 5_300 })],
      sessionById,
      true,
    );
    expect(feed).toHaveLength(1);
    expect(feed[0]?.kind).toBe('tx');
    if (feed[0]?.kind === 'tx') expect(feed[0].tx.id).toBe('split-tx');
  });

  it('still rolls up genuine receipt/outing sessions alongside a split-commit tx', () => {
    const sessionById = new Map([
      ['receipt', session('receipt')],
      ['split-sess', session('split-sess')],
    ]);
    const feed = buildSessionFeed(
      [
        tx({ id: 'r1', sessionId: 'receipt', amountCents: 300 }),
        tx({ id: 'r2', sessionId: 'receipt', amountCents: 700 }),
        tx({ id: 'split-tx', sessionId: 'split-sess', externalRef: 'split:xyz', amountCents: 2_000 }),
      ],
      sessionById,
      true,
    );
    expect(feed).toHaveLength(2);
    expect(feed[0]?.kind).toBe('session'); // the receipt still collapses
    expect(feed[1]?.kind).toBe('tx'); // the split stays standalone
  });

  it('C01/DEC-296: under a category filter the outing stays ONE row with the FILTERED subtotal', () => {
    // A "Mercado" outing of 1000 (market) + 500 (transport). The list pre-filters
    // to category=market, so only the two market txs reach the feed; collapsing is
    // ON (no text search). The row must be a single session entry whose total is
    // the filtered subtotal (300 + 700 = 1000), NOT the full 1500 — and NOT two
    // loose item rows (the bug). The full total is one tap away on the outing.
    const sessionById = new Map([['mercado', session('mercado')]]);
    const marketOnly = [
      tx({ id: 'arroz', sessionId: 'mercado', amountCents: 300 }),
      tx({ id: 'pao', sessionId: 'mercado', amountCents: 700 }),
    ];
    const feed = buildSessionFeed(marketOnly, sessionById, true);
    expect(feed).toHaveLength(1);
    const rollup = feed[0];
    expect(rollup?.kind).toBe('session');
    if (rollup?.kind === 'session') {
      expect(rollup.txs).toHaveLength(2); // "2 itens nesta categoria"
      expect(rollup.totalCents).toBe(1_000); // filtered subtotal, honest to the filter
    }
  });

  it('C01/DEC-296: a free-text search itemises (collapse off) — the user wants the line', () => {
    const sessionById = new Map([['mercado', session('mercado')]]);
    const feed = buildSessionFeed(
      [
        tx({ id: 'arroz', sessionId: 'mercado', amountCents: 300 }),
        tx({ id: 'queijo', sessionId: 'mercado', amountCents: 700 }),
      ],
      sessionById,
      false, // collapseSessions=false ONLY when there is a text query
    );
    expect(feed).toHaveLength(2);
    expect(feed.every((e) => e.kind === 'tx')).toBe(true);
  });
});

describe('groupFeedByDay (D-BUG-04 invariance)', () => {
  it('income shows in the day but NEVER adds to the subtotal', () => {
    const groups = groupFeedByDay([
      { kind: 'tx', date: '2026-06-10T12:00:00.000Z', tx: tx({ id: 'e', amountCents: 2_000 }) },
      {
        kind: 'tx',
        date: '2026-06-10T13:00:00.000Z',
        tx: tx({ id: 'i', type: 'income', amountCents: 9_000 }),
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.entries).toHaveLength(2); // income IS listed
    expect(groups[0]?.subtotalCents).toBe(2_000); // but only the expense counts
  });

  it('session rollups count toward the subtotal at their total', () => {
    const groups = groupFeedByDay([
      {
        kind: 'session',
        date: '2026-06-10T12:00:00.000Z',
        session: session('s1'),
        txs: [tx({ amountCents: 300 }), tx({ amountCents: 700 })],
        totalCents: 1_000,
      },
      { kind: 'tx', date: '2026-06-10T13:00:00.000Z', tx: tx({ amountCents: 500 }) },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.subtotalCents).toBe(1_500);
  });

  it('a feed with zero income subtotals exactly as the expense sum (ÂNCORA 11)', () => {
    const groups = groupFeedByDay([
      { kind: 'tx', date: '2026-06-10T12:00:00.000Z', tx: tx({ amountCents: 1_200 }) },
      { kind: 'tx', date: '2026-06-10T13:00:00.000Z', tx: tx({ amountCents: 800 }) },
    ]);
    expect(groups[0]?.subtotalCents).toBe(2_000);
  });

  it('splits entries into one group per local day', () => {
    const groups = groupFeedByDay([
      { kind: 'tx', date: '2026-06-10T12:00:00.000Z', tx: tx({ amountCents: 1_000 }) },
      { kind: 'tx', date: '2026-06-09T12:00:00.000Z', tx: tx({ amountCents: 500 }) },
    ]);
    expect(groups).toHaveLength(2);
  });

  // DEC-453: a £100 spend on a EUR trip subtotals at its € base value — the
  // day line never adds pounds to euros raw.
  it('foreign-currency expenses subtotal at their BASE value', () => {
    const groups = groupFeedByDay([
      { kind: 'tx', date: '2026-06-10T12:00:00.000Z', tx: tx({ amountCents: 2_000 }) },
      {
        kind: 'tx',
        date: '2026-06-10T13:00:00.000Z',
        tx: tx({
          id: 'gbp',
          amountCents: 10_000,
          currency: 'GBP',
          baseCurrencyAmountCents: 11_700,
        }),
      },
    ]);
    expect(groups[0]?.subtotalCents).toBe(2_000 + 11_700);
  });
});
