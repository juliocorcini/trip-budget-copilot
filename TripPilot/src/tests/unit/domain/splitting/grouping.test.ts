import { describe, it, expect } from 'vitest';
import { groupSharedExpenses, groupStatementLines } from '@/domain/splitting';
import type { StatementLine } from '@/domain/splitting';
import type { Transaction } from '@/domain/types/transaction';

/**
 * DEC-206 (device-test 2026-06-20): settle-up GROUPING. A 40-item receipt import
 * created 40 separate shared-expense lines, making the screen unreadable. These
 * pure helpers collapse same-`sessionId` expenses into ONE event while leaving
 * standalone expenses untouched. The math (totals/net) must stay exact.
 */

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

const mkTx = (
  id: string,
  amountCents: number,
  date: string,
  sessionId: string | null,
): Transaction => ({
  ...meta,
  id,
  tripId: 'trip-1',
  phaseId: 'ph-1',
  budgetPoolId: 'pool-1',
  walletId: null,
  sessionId,
  type: 'expense',
  amountCents,
  personalCostCents: null,
  currency: 'EUR',
  baseCurrencyAmountCents: amountCents,
  exchangeRate: null,
  category: 'food',
  subcategoryId: null,
  placeLabel: null,
  latitude: null,
  longitude: null,
  placeId: null,
  description: `item ${id}`,
  date,
  isShared: true,
  paidByParticipantId: 'bruno',
  activityProfileId: null,
  isSpecialOccasion: false,
  excludeFromLearning: false,
  sourceWalletId: null,
  targetWalletId: null,
  settlementId: null,
  adjustmentReason: null,
  notes: null,
});

const mkLine = (
  transactionId: string,
  kind: StatementLine['kind'],
  amountCents: number,
  date: string,
  sessionId: string | null,
): StatementLine => ({
  kind,
  transactionId,
  sessionId,
  description: `item ${transactionId}`,
  category: 'food',
  subcategoryId: null,
  occurredAt: date,
  amountCents,
  counterpartyId: 'bruno',
  counterpartyName: 'Bruno',
  confirmationStatus: 'confirmed',
});

describe('groupSharedExpenses', () => {
  it('collapses a multi-item receipt session into one event and keeps standalones separate', () => {
    const txs = [
      mkTx('a', 500, '2026-07-01T10:00:00.000Z', 'sess-1'),
      mkTx('b', 700, '2026-07-01T10:05:00.000Z', 'sess-1'),
      mkTx('c', 300, '2026-07-01T10:10:00.000Z', 'sess-1'),
      mkTx('solo', 1200, '2026-07-02T09:00:00.000Z', null),
    ];
    const groups = groupSharedExpenses(txs);
    expect(groups).toHaveLength(2);

    // Newest-first: the standalone (Jul 2) leads, then the session (Jul 1).
    const [first, second] = groups;
    expect(first!.key).toBe('solo');
    expect(first!.count).toBe(1);
    expect(first!.sessionId).toBeNull();

    expect(second!.key).toBe('session:sess-1');
    expect(second!.sessionId).toBe('sess-1');
    expect(second!.count).toBe(3);
    // Total must be the exact sum of the three items — never altered by grouping.
    expect(second!.totalCents).toBe(1500);
    // Items sorted newest-first inside the event.
    expect(second!.transactions.map((t) => t.id)).toEqual(['c', 'b', 'a']);
  });

  it('does not create an "event" for a session with a single item', () => {
    const groups = groupSharedExpenses([mkTx('only', 900, '2026-07-01T10:00:00.000Z', 'sess-x')]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.sessionId).toBeNull();
    expect(groups[0]!.key).toBe('only');
    expect(groups[0]!.count).toBe(1);
  });

  it('returns an empty list for no transactions', () => {
    expect(groupSharedExpenses([])).toEqual([]);
  });
});

describe('groupStatementLines', () => {
  it('nets a mixed receipt session and keeps the sign correct', () => {
    const lines: StatementLine[] = [
      mkLine('a', 'owes', 500, '2026-07-01T10:00:00.000Z', 'sess-1'),
      mkLine('b', 'owes', 700, '2026-07-01T10:05:00.000Z', 'sess-1'),
      mkLine('c', 'is_owed', 200, '2026-07-01T10:10:00.000Z', 'sess-1'),
      mkLine('solo', 'owes', 400, '2026-07-03T09:00:00.000Z', null),
    ];
    const groups = groupStatementLines(lines);
    expect(groups).toHaveLength(2);

    const solo = groups.find((g) => g.key === 'solo')!;
    expect(solo.count).toBe(1);
    expect(solo.netCents).toBe(-400);

    const event = groups.find((g) => g.key === 'session:sess-1')!;
    expect(event.count).toBe(3);
    expect(event.owesCents).toBe(1200);
    expect(event.isOwedCents).toBe(200);
    // net = is_owed − owes = 200 − 1200 = −1000 (you owe €10 net for the event).
    expect(event.netCents).toBe(-1000);
    expect(event.counterpartyName).toBe('Bruno');
  });

  it('keeps a single-item session as a standalone line', () => {
    const groups = groupStatementLines([
      mkLine('x', 'owes', 999, '2026-07-01T10:00:00.000Z', 'sess-1'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.sessionId).toBeNull();
    expect(groups[0]!.netCents).toBe(-999);
  });
});
