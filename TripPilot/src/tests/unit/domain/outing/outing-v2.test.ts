import { describe, it, expect } from 'vitest';
import {
  updateQuickValuesFromItem,
  calculateRoundTotalCents,
  calculateRoundPersonalCents,
  suggestNextPayer,
  projectTimeToCeiling,
} from '@/domain/outing';
import { createParticipant } from '@/domain/splitting';
import { createExpenseTransaction } from '@/domain/transactions';
import type { Participant } from '@/domain/types/participant';
import type { Transaction } from '@/domain/types/transaction';

/* ── E3 (M6): quick-add buttons learn the last value ───────────────────── */

describe('updateQuickValuesFromItem (M6)', () => {
  const base = [300, 500, 700, 1000, 1500];

  it('replaces the closest value with the new item', () => {
    // €4,50 is closest to the €5 button.
    expect(updateQuickValuesFromItem(base, 450)).toEqual([300, 450, 700, 1000, 1500]);
  });

  it('keeps the set size and order', () => {
    const next = updateQuickValuesFromItem(base, 1200);
    expect(next).toHaveLength(base.length);
    // 1200 is closest to 1000.
    expect(next).toEqual([300, 500, 700, 1200, 1500]);
  });

  it('does not duplicate a value already present', () => {
    expect(updateQuickValuesFromItem(base, 500)).toEqual(base);
  });

  it('ignores non-positive amounts and empty sets', () => {
    expect(updateQuickValuesFromItem(base, 0)).toEqual(base);
    expect(updateQuickValuesFromItem([], 500)).toEqual([]);
  });

  it('replaces the single closest on ties by first index', () => {
    // 400 is equidistant from 300 and 500 → first wins (300).
    expect(updateQuickValuesFromItem([300, 500], 400)).toEqual([400, 500]);
  });
});

/* ── E3 (M8): round math ───────────────────────────────────────────────── */

describe('calculateRoundTotalCents / calculateRoundPersonalCents (M8)', () => {
  it('"round of 4" at €5 = €20 total', () => {
    expect(calculateRoundTotalCents(4, 500)).toBe(2000);
  });

  it('paying alone keeps the whole total as personal cost', () => {
    expect(calculateRoundPersonalCents(4, 500, 1)).toBe(2000);
  });

  it('a split round leaves the buyer one equal share per drink', () => {
    // €20 split 4 ways = €5 personal.
    expect(calculateRoundPersonalCents(4, 500, 4)).toBe(500);
    // €20 split 2 ways = €10 personal.
    expect(calculateRoundPersonalCents(4, 500, 2)).toBe(1000);
  });

  it('returns 0 for invalid input', () => {
    expect(calculateRoundTotalCents(0, 500)).toBe(0);
    expect(calculateRoundTotalCents(4, 0)).toBe(0);
    expect(calculateRoundPersonalCents(0, 500, 2)).toBe(0);
  });
});

/* ── E3 (M9): who pays the next round ──────────────────────────────────── */

describe('suggestNextPayer (M9)', () => {
  const owner: Participant = { ...createParticipant('t', 'Me', null), isOwner: true };
  const ana = createParticipant('t', 'Ana', null);
  const bob = createParticipant('t', 'Bob', null);
  const participants = [owner, ana, bob];

  const paidBy = (payerId: string | null): Transaction =>
    createExpenseTransaction({
      tripId: 't',
      phaseId: 'p',
      budgetPoolId: 'pool',
      walletId: null,
      amountCents: 500,
      currency: 'EUR',
      category: 'bar',
      description: 'x',
      paidByParticipantId: payerId,
    });

  it('returns null with fewer than two participants', () => {
    expect(suggestNextPayer([owner], [], owner.id)).toBeNull();
  });

  it('suggests the participant who has paid the fewest (rotation)', () => {
    // Owner already paid once (null payer = owner) → next is the first at zero.
    const next = suggestNextPayer(participants, [paidBy(null)], owner.id);
    expect(next?.id).toBe(ana.id);
  });

  it('moves the rotation forward as people pay', () => {
    const txs = [paidBy(null), paidBy(ana.id)];
    // Owner=1, Ana=1, Bob=0 → Bob is next.
    expect(suggestNextPayer(participants, txs, owner.id)?.id).toBe(bob.id);
  });

  it('ignores deleted items', () => {
    const deleted = { ...paidBy(ana.id), deletedAt: new Date().toISOString() };
    // Only the owner's payment counts → Ana (first at zero).
    expect(suggestNextPayer(participants, [paidBy(null), deleted], owner.id)?.id).toBe(ana.id);
  });
});

/* ── E3 (M10): pace projection to the ceiling ──────────────────────────── */

describe('projectTimeToCeiling (M10)', () => {
  const start = '2026-01-01T20:00:00.000Z';

  it('projects minutes to the ceiling at the current rate', () => {
    // €10 spent in 30 min, ceiling €20 → 30 more minutes.
    const now = '2026-01-01T20:30:00.000Z';
    expect(projectTimeToCeiling(1000, 2000, start, now)).toBe(30);
  });

  it('scales with a faster rate', () => {
    // €15 in 30 min, ceiling €20 → remaining €5 at €0.5/min = 10 min.
    const now = '2026-01-01T20:30:00.000Z';
    expect(projectTimeToCeiling(1500, 2000, start, now)).toBe(10);
  });

  it('returns 0 once the ceiling is reached', () => {
    expect(projectTimeToCeiling(2000, 2000, start, '2026-01-01T20:30:00.000Z')).toBe(0);
  });

  it('returns null when it cannot be estimated', () => {
    expect(projectTimeToCeiling(0, 2000, start, '2026-01-01T20:30:00.000Z')).toBeNull();
    expect(projectTimeToCeiling(1000, 0, start, '2026-01-01T20:30:00.000Z')).toBeNull();
    // No elapsed time → no rate.
    expect(projectTimeToCeiling(1000, 2000, start, start)).toBeNull();
  });
});
