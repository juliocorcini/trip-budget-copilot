import { describe, it, expect } from 'vitest';
import {
  calculateSessionTotal,
  getSessionPercentUsed,
  getProgressiveAlerts,
  getOutingZone,
  getNextDrinkMessageKind,
  calculateNextDrinkImpact,
  contextUsesDrinkPrice,
  endSession,
} from '@/domain/outing';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

const mkTx = (id: string, amount: number): Transaction => ({
  ...meta, id,
  tripId: 'trip-1', phaseId: 'ph-1', budgetPoolId: 'pool-1',
  walletId: null, sessionId: 'sess-1', type: 'expense',
  amountCents: amount, personalCostCents: amount, currency: 'EUR',
  baseCurrencyAmountCents: amount, exchangeRate: null,
  category: 'bar', subcategoryId: null, placeLabel: null, latitude: null, longitude: null, placeId: null, description: 'drink', date: '2026-07-01T22:00:00.000Z',
  isShared: false, paidByParticipantId: null, activityProfileId: null,
  isSpecialOccasion: false, excludeFromLearning: false,
  sourceWalletId: null, targetWalletId: null, settlementId: null,
  adjustmentReason: null, notes: null,
});

const session: Session = {
  ...meta, id: 'sess-1',
  tripId: 'trip-1', phaseId: 'ph-1', budgetPoolId: 'pool-1',
  activityProfileId: 'prof-1', status: 'active', name: 'Bar night',
  targetCents: 1500, ceilingCents: 2500, maxCents: 3500,
  startedAt: '2026-07-01T21:00:00.000Z', endedAt: null,
  quickAddValuesCents: [300, 500, 700], avgDrinkPriceCents: 500,
  firedAlertPercents: [], overMaxConfirmedAt: null,
  notes: null,
};

describe('calculateSessionTotal', () => {
  it('sums session expenses', () => {
    expect(calculateSessionTotal([mkTx('t1', 500), mkTx('t2', 700)])).toBe(1200);
  });

  it('ignores deleted', () => {
    const txs = [mkTx('t1', 500), { ...mkTx('t2', 700), deletedAt: '2026-01-01T00:00:00.000Z' }];
    expect(calculateSessionTotal(txs)).toBe(500);
  });
});

describe('getSessionPercentUsed', () => {
  it('calculates percentage', () => {
    expect(getSessionPercentUsed(1250, 2500)).toBe(50);
  });

  it('returns 0 for null limit', () => {
    expect(getSessionPercentUsed(1000, null)).toBe(0);
  });
});

// DEC-117 (R-08): alerts re-anchored on the zones (target 1500 / ceiling 2500 / max 3500).
describe('getProgressiveAlerts', () => {
  it('returns no alerts below half the target', () => {
    const alerts = getProgressiveAlerts(500, session);
    expect(alerts).toHaveLength(0);
  });

  it('fires the warning the moment the TARGET is crossed', () => {
    const alerts = getProgressiveAlerts(1600, session);
    expect(alerts.map((a) => a.message)).toEqual(['halfway', 'over_target']);
    expect(alerts.find((a) => a.message === 'over_target')?.type).toBe('warning');
  });

  it('does not fire over_target at exactly the target', () => {
    const alerts = getProgressiveAlerts(1500, session);
    expect(alerts.map((a) => a.message)).toEqual(['halfway']);
  });

  it('fires danger past the ceiling', () => {
    const alerts = getProgressiveAlerts(2600, session);
    expect(alerts.find((a) => a.message === 'over_ceiling')?.type).toBe('danger');
  });

  it('fires critical at the max', () => {
    const alerts = getProgressiveAlerts(3500, session);
    expect(alerts.find((a) => a.message === 'at_max')?.type).toBe('critical');
  });

  it('uses distinct stable ids for firedAlertPercents dedupe', () => {
    const alerts = getProgressiveAlerts(3600, session);
    expect(alerts.map((a) => a.percent)).toEqual([50, 100, 150, 200]);
  });
});

// DEC-117 (R-08): zones change AT the target, not near the max.
describe('getOutingZone', () => {
  it('stays under_target up to and including the target', () => {
    expect(getOutingZone(1500, 1500, 2500, 3500)).toBe('under_target');
  });

  it('crossing the target immediately changes the zone', () => {
    expect(getOutingZone(1501, 1500, 2500, 3500)).toBe('over_target');
  });

  it('crossing the ceiling moves to over_ceiling', () => {
    expect(getOutingZone(2501, 1500, 2500, 3500)).toBe('over_ceiling');
  });

  it('crossing the max moves to over_max', () => {
    expect(getOutingZone(3501, 1500, 2500, 3500)).toBe('over_max');
  });
});

// DEC-117 (R-08): the inviting copy only appears while the next drink fits the TARGET.
describe('getNextDrinkMessageKind', () => {
  it('fits_target while the next drink stays inside the target', () => {
    expect(getNextDrinkMessageKind(1000, 350, 1500)).toBe('fits_target');
  });

  it('crosses_target when the next drink would cross the target', () => {
    expect(getNextDrinkMessageKind(1200, 350, 1500)).toBe('crosses_target');
  });

  it('over_target once the target is already crossed', () => {
    expect(getNextDrinkMessageKind(1600, 350, 1500)).toBe('over_target');
  });
});

describe('calculateNextDrinkImpact', () => {
  it('calculates impact correctly', () => {
    const result = calculateNextDrinkImpact(2000, 500, 2500);
    expect(result.afterCents).toBe(2500);
    expect(result.percentAfter).toBe(100);
    expect(result.exceedsCeiling).toBe(false);
  });

  it('detects ceiling breach', () => {
    const result = calculateNextDrinkImpact(2200, 500, 2500);
    expect(result.exceedsCeiling).toBe(true);
  });
});

describe('endSession', () => {
  it('sets status to completed', () => {
    const ended = endSession(session);
    expect(ended.status).toBe('completed');
    expect(ended.endedAt).toBeTruthy();
  });
});

// FB-16 (DEC-281): the average-drink-price question is only relevant to a
// drink-centric context. A "market"/"transport" outing must not ask for it.
describe('contextUsesDrinkPrice', () => {
  it('is true for drink-centric contexts', () => {
    expect(contextUsesDrinkPrice('bar')).toBe(true);
    expect(contextUsesDrinkPrice('nightlife')).toBe(true);
    expect(contextUsesDrinkPrice('club')).toBe(true);
    expect(contextUsesDrinkPrice('night')).toBe(true);
  });

  it('is false for non-drink contexts (the field-feedback bug)', () => {
    expect(contextUsesDrinkPrice('market')).toBe(false);
    expect(contextUsesDrinkPrice('transport')).toBe(false);
    expect(contextUsesDrinkPrice('gifts')).toBe(false);
    expect(contextUsesDrinkPrice('restaurant')).toBe(false);
    expect(contextUsesDrinkPrice('entertainment')).toBe(false);
    expect(contextUsesDrinkPrice('other')).toBe(false);
  });

  it('is false for null/undefined/empty category', () => {
    expect(contextUsesDrinkPrice(null)).toBe(false);
    expect(contextUsesDrinkPrice(undefined)).toBe(false);
    expect(contextUsesDrinkPrice('')).toBe(false);
  });
});
