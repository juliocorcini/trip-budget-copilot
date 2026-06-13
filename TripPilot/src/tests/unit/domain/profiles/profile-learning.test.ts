import { describe, it, expect } from 'vitest';
import {
  computeProfileOccasionAverages,
  detectValueSuggestion,
  markValueSuggestionDismissed,
} from '@/domain/profiles';
import { createExpenseTransaction } from '@/domain/transactions';
import { createSyncMetadata } from '@/utils/entity-factory';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';

// E7 (M18/M19) — in-trip learning suggestions. Session = 1 occasion (DEC-115);
// special/excluded items never teach (DEC-006); the engine only proposes.

const mkProfile = (overrides: Partial<ActivityProfile> = {}): ActivityProfile => ({
  ...createSyncMetadata(),
  tripId: 'trip-1',
  name: 'Bar',
  category: 'bar',
  iconName: null,
  color: null,
  typicalValueCents: 1500,
  safeValueCents: 2000,
  confidence: 'low',
  dataPointCount: 0,
  expectedFrequencyPerPhase: null,
  isCustom: false,
  defaultTargetCents: null,
  defaultCeilingCents: null,
  defaultMaxCents: null,
  defaultAvgDrinkPriceCents: null,
  quickAddValuesCents: null,
  notes: null,
  ...overrides,
});

const mkSession = (
  id: string,
  activityProfileId: string | null,
  endedAt: string | null,
): Session => ({
  ...createSyncMetadata(),
  id,
  tripId: 'trip-1',
  phaseId: 'phase-1',
  budgetPoolId: 'pool-1',
  activityProfileId,
  status: endedAt ? 'completed' : 'active',
  name: 'Outing',
  targetCents: null,
  ceilingCents: null,
  maxCents: null,
  startedAt: '2026-01-01T00:00:00.000Z',
  endedAt,
  quickAddValuesCents: [],
  avgDrinkPriceCents: null,
  firedAlertPercents: [],
  overMaxConfirmedAt: null,
  notes: null,
});

const mkTx = (
  sessionId: string | null,
  amountCents: number,
  profileId: string | null,
  overrides: Partial<Transaction> = {},
): Transaction => ({
  ...createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'phase-1',
    budgetPoolId: 'pool-1',
    walletId: null,
    amountCents,
    currency: 'EUR',
    category: 'bar',
    description: 'item',
    sessionId,
    activityProfileId: profileId,
  }),
  ...overrides,
});

describe('computeProfileOccasionAverages (M18 — DEC-115)', () => {
  it('counts a session ONCE — a 9-drink night is one occasion, not nine', () => {
    const sessions = [
      mkSession('s1', 'bar', '2026-01-03T22:00:00.000Z'),
      mkSession('s2', 'bar', '2026-01-04T22:00:00.000Z'),
      mkSession('s3', 'bar', '2026-01-05T22:00:00.000Z'),
    ];
    // Each night = 9 drinks × 500 = 4500 (one sample), not 500 nine times.
    const txs = sessions.flatMap((s) =>
      Array.from({ length: 9 }, () => mkTx(s.id, 500, 'bar')),
    );

    const averages = computeProfileOccasionAverages({ sessions, transactions: txs });
    expect(averages).toHaveLength(1);
    expect(averages[0]!.profileId).toBe('bar');
    expect(averages[0]!.sampleCount).toBe(3);
    expect(averages[0]!.averageCents).toBe(4500);
  });

  it('excludes special and excluded items from the occasion total (DEC-006)', () => {
    const sessions = [mkSession('s1', 'bar', '2026-01-03T22:00:00.000Z')];
    const txs = [
      mkTx('s1', 3000, 'bar'),
      mkTx('s1', 9000, 'bar', { isSpecialOccasion: true }),
      mkTx('s1', 4000, 'bar', { excludeFromLearning: true }),
    ];
    const averages = computeProfileOccasionAverages({ sessions, transactions: txs });
    expect(averages[0]!.averageCents).toBe(3000);
  });

  it('keeps only the most recent five occasions per profile', () => {
    const sessions = Array.from({ length: 7 }, (_, i) =>
      mkSession(`s${i}`, 'bar', `2026-01-0${i + 1}T22:00:00.000Z`),
    );
    // Oldest two are 1000; the five most recent are 5000 → average 5000.
    const txs = sessions.map((s, i) => mkTx(s.id, i < 2 ? 1000 : 5000, 'bar'));
    const averages = computeProfileOccasionAverages({ sessions, transactions: txs });
    expect(averages[0]!.sampleCount).toBe(5);
    expect(averages[0]!.averageCents).toBe(5000);
  });

  it('ignores open sessions and standalone (no-session) expenses', () => {
    const sessions = [
      mkSession('s1', 'bar', null), // still open
      mkSession('s2', 'bar', '2026-01-04T22:00:00.000Z'),
    ];
    const txs = [
      mkTx('s1', 9999, 'bar'), // open session — ignored
      mkTx('s2', 4000, 'bar'),
      mkTx(null, 8888, 'bar'), // standalone — ignored
    ];
    const averages = computeProfileOccasionAverages({ sessions, transactions: txs });
    expect(averages).toHaveLength(1);
    expect(averages[0]!.sampleCount).toBe(1);
    expect(averages[0]!.averageCents).toBe(4000);
  });
});

describe('detectValueSuggestion (M19 — ÂNCORA 8/12)', () => {
  const threeNights = (profileId: string): Session[] => {
    return [1, 2, 3].map((n) => mkSession(`${profileId}-s${n}`, profileId, `2026-01-0${n}T22:00:00.000Z`));
  };
  const threeNightTxs = (sessions: Session[], amountCents: number): Transaction[] =>
    sessions.map((s) => mkTx(s.id, amountCents, s.activityProfileId));

  it('fires when the real average diverges far enough from the typical', () => {
    const profile = mkProfile({ id: 'bar', typicalValueCents: 1500 });
    const sessions = threeNights('bar');
    const suggestion = detectValueSuggestion({
      profiles: [profile],
      sessions,
      transactions: threeNightTxs(sessions, 2200),
      dismissedProfileIds: [],
    });
    expect(suggestion).not.toBeNull();
    expect(suggestion!.suggestedTypicalCents).toBe(2200);
    expect(suggestion!.suggestedSafeCents).toBe(Math.round(2200 * 1.3));
    expect(suggestion!.currentTypicalCents).toBe(1500);
    expect(suggestion!.sampleCount).toBe(3);
  });

  it('stays silent when the gap is below the absolute or ratio thresholds', () => {
    // Δ100 < 500c floor.
    const small = mkProfile({ id: 'bar', typicalValueCents: 2000 });
    const sSmall = threeNights('bar');
    expect(
      detectValueSuggestion({
        profiles: [small],
        sessions: sSmall,
        transactions: threeNightTxs(sSmall, 2100),
        dismissedProfileIds: [],
      }),
    ).toBeNull();

    // Δ1500 ≥ 500c but ratio 0.15 < 0.2.
    const ratio = mkProfile({ id: 'mkt', typicalValueCents: 10000 });
    const sRatio = threeNights('mkt');
    expect(
      detectValueSuggestion({
        profiles: [ratio],
        sessions: sRatio,
        transactions: threeNightTxs(sRatio, 11500),
        dismissedProfileIds: [],
      }),
    ).toBeNull();
  });

  it('needs at least three occasions before proposing', () => {
    const profile = mkProfile({ id: 'bar', typicalValueCents: 1500 });
    const sessions = [
      mkSession('bar-s1', 'bar', '2026-01-01T22:00:00.000Z'),
      mkSession('bar-s2', 'bar', '2026-01-02T22:00:00.000Z'),
    ];
    const txs = sessions.map((s) => mkTx(s.id, 3000, 'bar'));
    expect(
      detectValueSuggestion({ profiles: [profile], sessions, transactions: txs, dismissedProfileIds: [] }),
    ).toBeNull();
  });

  it('never re-proposes a dismissed profile (ÂNCORA 12)', () => {
    const profile = mkProfile({ id: 'bar', typicalValueCents: 1500 });
    const sessions = threeNights('bar');
    expect(
      detectValueSuggestion({
        profiles: [profile],
        sessions,
        transactions: threeNightTxs(sessions, 2200),
        dismissedProfileIds: ['bar'],
      }),
    ).toBeNull();
  });

  it('proposes the MOST divergent profile when several diverge', () => {
    const bar = mkProfile({ id: 'bar', typicalValueCents: 1500 }); // → 2000, ratio .33
    const market = mkProfile({ id: 'mkt', typicalValueCents: 1000 }); // → 2000, ratio 1.0
    const barSessions = threeNights('bar');
    const mktSessions = threeNights('mkt');
    const suggestion = detectValueSuggestion({
      profiles: [bar, market],
      sessions: [...barSessions, ...mktSessions],
      transactions: [...threeNightTxs(barSessions, 2000), ...threeNightTxs(mktSessions, 2000)],
      dismissedProfileIds: [],
    });
    expect(suggestion!.profileId).toBe('mkt');
  });
});

describe('markValueSuggestionDismissed', () => {
  it('appends once and is idempotent', () => {
    expect(markValueSuggestionDismissed([], 'bar')).toEqual(['bar']);
    expect(markValueSuggestionDismissed(['bar'], 'bar')).toEqual(['bar']);
    expect(markValueSuggestionDismissed(['bar'], 'mkt')).toEqual(['bar', 'mkt']);
  });
});
