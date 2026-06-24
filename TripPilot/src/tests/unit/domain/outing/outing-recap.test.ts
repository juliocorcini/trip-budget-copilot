import { describe, it, expect } from 'vitest';
import {
  buildOutingRecap,
  recapHeadlineKey,
  formatRecapDuration,
  type OutingRecapOutcome,
} from '@/domain/outing';
import type { Transaction } from '@/domain/types/transaction';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null as string | null,
  revision: 1,
  sourceDeviceId: 'test',
};

const mkTx = (id: string, amount: number): Transaction => ({
  ...meta,
  id,
  tripId: 'trip-1',
  phaseId: 'ph-1',
  budgetPoolId: 'pool-1',
  walletId: null,
  sessionId: 'sess-1',
  type: 'expense',
  amountCents: amount,
  personalCostCents: amount,
  currency: 'EUR',
  baseCurrencyAmountCents: amount,
  exchangeRate: null,
  category: 'bar',
  subcategoryId: null,
  placeLabel: null,
  latitude: null,
  longitude: null,
  placeId: null,
  description: 'drink',
  date: '2026-07-01T22:00:00.000Z',
  isShared: false,
  paidByParticipantId: null,
  activityProfileId: null,
  isSpecialOccasion: false,
  excludeFromLearning: false,
  sourceWalletId: null,
  targetWalletId: null,
  settlementId: null,
  adjustmentReason: null,
  notes: null,
});

const START = '2026-07-01T21:00:00.000Z';
const END_90M = '2026-07-01T22:30:00.000Z';

/**
 * M17-lite (DEC-292) — the closing recap must report the real numbers the user
 * just saw on the review screen: total, rounds, duration, and how it landed vs
 * the target. The outcome drives the warm headline; a vs-target read only makes
 * sense with a real target AND real spend (DEC-173).
 */
describe('buildOutingRecap', () => {
  it('reports total, item count and duration from real data', () => {
    const recap = buildOutingRecap({
      transactions: [mkTx('t1', 1200), mkTx('t2', 800)],
      startedAt: START,
      endedAt: END_90M,
      targetCents: 5000,
    });
    expect(recap.totalCents).toBe(2000);
    expect(recap.itemCount).toBe(2);
    expect(recap.durationMin).toBe(90);
  });

  it('classifies UNDER target (money saved)', () => {
    const recap = buildOutingRecap({
      transactions: [mkTx('t1', 3000)],
      startedAt: START,
      endedAt: END_90M,
      targetCents: 5000,
    });
    expect(recap.outcome).toBe('under');
    expect(recap.vsTargetCents).toBe(2000);
  });

  it('classifies ON target exactly', () => {
    const recap = buildOutingRecap({
      transactions: [mkTx('t1', 5000)],
      startedAt: START,
      endedAt: END_90M,
      targetCents: 5000,
    });
    expect(recap.outcome).toBe('on');
    expect(recap.vsTargetCents).toBe(0);
  });

  it('classifies OVER target', () => {
    const recap = buildOutingRecap({
      transactions: [mkTx('t1', 7000)],
      startedAt: START,
      endedAt: END_90M,
      targetCents: 5000,
    });
    expect(recap.outcome).toBe('over');
    expect(recap.vsTargetCents).toBe(-2000);
  });

  it('has no vs-target read without a target', () => {
    const recap = buildOutingRecap({
      transactions: [mkTx('t1', 3000)],
      startedAt: START,
      endedAt: END_90M,
      targetCents: null,
    });
    expect(recap.outcome).toBe('no_target');
  });

  it('has no vs-target read when nothing was spent (DEC-173)', () => {
    const recap = buildOutingRecap({
      transactions: [],
      startedAt: START,
      endedAt: END_90M,
      targetCents: 5000,
    });
    expect(recap.totalCents).toBe(0);
    expect(recap.itemCount).toBe(0);
    expect(recap.outcome).toBe('no_target');
  });

  it('ignores deleted and non-expense rows in the total', () => {
    const recap = buildOutingRecap({
      transactions: [
        mkTx('t1', 1000),
        { ...mkTx('t2', 5000), deletedAt: '2026-07-01T22:00:00.000Z' },
        { ...mkTx('t3', 9000), type: 'transfer' },
      ],
      startedAt: START,
      endedAt: END_90M,
      targetCents: 5000,
    });
    expect(recap.totalCents).toBe(1000);
    // itemCount is the raw row count shown as "rounds", matching the review chip.
    expect(recap.itemCount).toBe(3);
  });

  it('falls back to the injected clock when the outing is not yet closed', () => {
    const now = new Date('2026-07-01T22:00:00.000Z').getTime();
    const recap = buildOutingRecap({
      transactions: [mkTx('t1', 1000)],
      startedAt: START,
      endedAt: null,
      targetCents: 5000,
      now,
    });
    expect(recap.durationMin).toBe(60);
  });

  it('never returns a negative duration', () => {
    const recap = buildOutingRecap({
      transactions: [mkTx('t1', 1000)],
      startedAt: END_90M,
      endedAt: START,
      targetCents: 5000,
    });
    expect(recap.durationMin).toBe(0);
  });
});

describe('recapHeadlineKey', () => {
  it('maps every outcome to a distinct headline key', () => {
    const outcomes: OutingRecapOutcome[] = ['under', 'on', 'over', 'no_target'];
    const keys = outcomes.map(recapHeadlineKey);
    expect(new Set(keys).size).toBe(outcomes.length);
    keys.forEach((k) => expect(k.startsWith('outing.recap_headline_')).toBe(true));
  });
});

describe('formatRecapDuration', () => {
  it('formats minutes, whole hours and mixed durations', () => {
    expect(formatRecapDuration(0)).toBe('0min');
    expect(formatRecapDuration(45)).toBe('45min');
    expect(formatRecapDuration(60)).toBe('1h');
    expect(formatRecapDuration(90)).toBe('1h30');
    expect(formatRecapDuration(125)).toBe('2h05');
  });
});
